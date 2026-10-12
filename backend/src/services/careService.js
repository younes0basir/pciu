const { withTransaction } = require('../config/db');
const { logVisitAction } = require('../lib/visitActionLogger');
const {
  assertCareStageTransition,
  V3_OUTCOMES,
  mapCloseOutcomeToLegacyStatus,
} = require('../lib/careStage');
const {
  findIdempotentActionResult,
  recordVisitEvent,
} = require('./visitEventService');
const {
  assertDoctorCanManageVisit,
  assertNurseCanManageVisit,
} = require('./roomAccessService');

async function startObservation(visitId, actorUser, actionContext = {}) {
  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) throw { status: 404, message: 'Visit not found.' };

    const visit = visitRes.rows[0];
    assertCareStageTransition(visit.care_stage, 'in_observation');

    await client.query(
      `UPDATE visits
       SET care_stage = 'in_observation',
           patient_location = 'observation',
           status = 'in_treatment',
           updated_at = NOW()
       WHERE id = $1`,
      [visitId],
    );

    const result = { visitId, careStage: 'in_observation' };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'observation_started',
      fromStatus: visit.status,
      toStatus: 'in_treatment',
      actionResult: result,
    });

    return result;
  });
}

async function endObservation(visitId, actorUser, actionContext = {}) {
  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) throw { status: 404, message: 'Visit not found.' };

    const visit = visitRes.rows[0];
    if (visit.care_stage !== 'in_observation') {
      throw { status: 400, message: 'Le patient n’est pas en observation.' };
    }

    await client.query(
      `UPDATE visits
       SET care_stage = 'in_care',
           patient_location = 'resource',
           updated_at = NOW()
       WHERE id = $1`,
      [visitId],
    );

    const result = { visitId, careStage: 'in_care' };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'observation_ended',
      fromStatus: visit.status,
      toStatus: visit.status,
      actionResult: result,
    });

    return result;
  });
}

async function decideDisposition(visitId, data, actorUser, actionContext = {}) {
  const outcome = data?.outcome;
  if (!outcome || !V3_OUTCOMES.includes(outcome)) {
    throw {
      status: 400,
      message: `Issue invalide. Valeurs : ${V3_OUTCOMES.join(', ')}`,
    };
  }

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) throw { status: 404, message: 'Visit not found.' };

    const visit = visitRes.rows[0];
    if (visit.care_stage === 'completed') {
      throw { status: 400, message: 'Visite déjà terminée.' };
    }

    if (actorUser.role === 'doctor') {
      await assertDoctorCanManageVisit(client, actorUser, visitId);
    } else if (actorUser.role === 'nurse') {
      await assertNurseCanManageVisit(client, actorUser, visitId);
    }

    assertCareStageTransition(visit.care_stage, 'disposition_pending');

    await client.query(
      `UPDATE visits
       SET care_stage = 'disposition_pending',
           outcome = $1,
           disposition_decided_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [outcome, visitId],
    );

    const result = { visitId, outcome, careStage: 'disposition_pending' };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'disposition_decided',
      fromStatus: visit.status,
      toStatus: visit.status,
      metadata: { outcome },
      actionResult: result,
    });

    logVisitAction({
      action: 'disposition',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function completeVisit(visitId, data, actorUser, actionContext = {}) {
  const releaseReason = data?.releaseReason || null;

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage, outcome FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) throw { status: 404, message: 'Visit not found.' };

    const visit = visitRes.rows[0];
    if (visit.care_stage !== 'disposition_pending' && visit.care_stage !== 'completed') {
      assertCareStageTransition(visit.care_stage, 'completed');
    }

    const outcome = visit.outcome || data?.outcome;
    if (!outcome || !V3_OUTCOMES.includes(outcome)) {
      throw { status: 400, message: 'Une décision (outcome) est requise avant clôture.' };
    }

    const legacyStatus = mapCloseOutcomeToLegacyStatus(outcome);

    const bedAssign = await client.query(
      'SELECT bed_id FROM bed_assignments WHERE visit_id = $1 AND released_at IS NULL',
      [visitId],
    );

    await client.query(
      `UPDATE bed_assignments
       SET released_at = NOW(), released_by = $1, release_reason = COALESCE($2, $3)
       WHERE visit_id = $4 AND released_at IS NULL`,
      [actorUser?.id || null, releaseReason, outcome, visitId],
    );

    if (bedAssign.rowCount > 0) {
      const bedId = bedAssign.rows[0].bed_id;
      await client.query(
        `UPDATE beds SET operational_status = 'cleaning' WHERE id = $1`,
        [bedId],
      );
    }

    await client.query(
      `UPDATE consultations SET ended_at = NOW() WHERE visit_id = $1 AND ended_at IS NULL`,
      [visitId],
    );

    await client.query(
      `UPDATE visits
       SET care_stage = 'completed',
           status = $1,
           outcome = $2,
           patient_location = 'discharged',
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [legacyStatus, outcome, visitId],
    );

    const result = { visitId, careStage: 'completed', outcome, status: legacyStatus };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'closed',
      fromStatus: visit.status,
      toStatus: legacyStatus,
      metadata: { outcome, phase: 'complete_departure' },
      actionResult: result,
    });

    return result;
  });
}

module.exports = {
  startObservation,
  endObservation,
  decideDisposition,
  completeVisit,
};
