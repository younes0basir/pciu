const { query, withTransaction } = require('../config/db');
const { logVisitAction } = require('../lib/visitActionLogger');
const {
  assertCareStageTransition,
  ORIENTATIONS,
} = require('../lib/careStage');
const {
  findIdempotentActionResult,
  recordVisitEvent,
} = require('./visitEventService');

function normalizeOrientation(value) {
  if (value == null || value === '') return null;
  const o = String(value).trim();
  if (!ORIENTATIONS.includes(o)) {
    throw { status: 400, message: `Orientation invalide : ${o}` };
  }
  return o;
}

async function recordTriage(visitId, data, actorUser, actionContext = {}) {
  const priority = Number(data?.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw { status: 400, message: 'La priorité doit être entre 1 et 5.' };
  }

  const assessmentType = data?.assessmentType || 'initial';
  if (!['initial', 'reassessment', 'escalation'].includes(assessmentType)) {
    throw { status: 400, message: 'Type d’évaluation invalide.' };
  }

  const clinicalNote = data?.clinicalNote != null ? String(data.clinicalNote).trim() : '';
  const reasonForChange = data?.reasonForChange != null ? String(data.reasonForChange).trim() : '';
  const orientation = data?.orientation != null ? normalizeOrientation(data.orientation) : null;
  const vitals = data?.vitals ?? null;

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      `SELECT id, status, care_stage, priority, critical_flag, current_orientation
       FROM visits WHERE id = $1 FOR UPDATE`,
      [visitId],
    );
    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    if (visit.care_stage === 'completed' || visit.status === 'discharged') {
      throw { status: 400, message: 'Visite déjà terminée.' };
    }

    const previousPriority = Number(visit.priority);
    const targetCareStage =
      assessmentType === 'initial' && ['registered', 'triage_pending'].includes(visit.care_stage)
        ? 'waiting_care'
        : visit.care_stage;

    if (targetCareStage !== visit.care_stage) {
      assertCareStageTransition(visit.care_stage, targetCareStage);
    }

    await client.query(
      `INSERT INTO triage_assessments (
        visit_id, priority, assessment_type, clinical_note, vitals, orientation,
        reason_for_change, performed_by, performed_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())`,
      [
        visitId,
        priority,
        assessmentType,
        clinicalNote || null,
        vitals ? JSON.stringify(vitals) : null,
        orientation,
        reasonForChange || null,
        actorUser?.id || null,
      ],
    );

    await client.query(
      `UPDATE visits
       SET priority = $1,
           care_stage = $2,
           current_orientation = COALESCE($3, current_orientation),
           patient_location = COALESCE($4, patient_location),
           updated_at = NOW()
       WHERE id = $5`,
      [
        priority,
        targetCareStage,
        orientation,
        orientation === 'critical' ? 'room' : 'triage',
        visitId,
      ],
    );

    const eventType =
      assessmentType === 'initial' ? 'triage_completed' : 'triage_reassessed';

    const result = {
      visitId,
      priority,
      previousPriority,
      careStage: targetCareStage,
      orientation,
      assessmentType,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType,
      fromStatus: visit.status,
      toStatus: visit.status,
      metadata: {
        previousPriority,
        priority,
        orientation,
        assessmentType,
        clinicalNote: clinicalNote || null,
        reasonForChange: reasonForChange || null,
      },
      actionResult: result,
    });

    if (previousPriority !== priority) {
      await recordVisitEvent(client, {
        visitId,
        actorUserId: actorUser?.id || null,
        actionContext: { ...actionContext, idempotencyKey: null },
        eventType: 'priority_changed',
        fromStatus: visit.status,
        toStatus: visit.status,
        metadata: { previousPriority, priority },
      });
    }

    logVisitAction({
      action: 'triage_record',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function setCriticalFlag(visitId, data, actorUser, actionContext = {}) {
  const critical = Boolean(data?.critical);
  const note = data?.note != null ? String(data.note).trim() : '';

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage, critical_flag FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    await client.query(
      `UPDATE visits
       SET critical_flag = $1,
           current_orientation = CASE WHEN $1 THEN COALESCE(current_orientation, 'critical') ELSE current_orientation END,
           updated_at = NOW()
       WHERE id = $2`,
      [critical, visitId],
    );

    const result = { visitId, criticalFlag: critical };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'critical_flag_set',
      fromStatus: visit.status,
      toStatus: visit.status,
      metadata: { critical, note: note || null },
      actionResult: result,
    });

    return result;
  });
}

async function listTriageHistory(visitId) {
  const result = await query(
    `SELECT ta.*, u.first_name, u.last_name
     FROM triage_assessments ta
     LEFT JOIN users u ON u.id = ta.performed_by
     WHERE ta.visit_id = $1
     ORDER BY ta.performed_at DESC, ta.id DESC`,
    [visitId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    priority: row.priority,
    assessmentType: row.assessment_type,
    clinicalNote: row.clinical_note,
    vitals: row.vitals,
    orientation: row.orientation,
    reasonForChange: row.reason_for_change,
    performedAt: row.performed_at,
    performedByName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
  }));
}

module.exports = {
  recordTriage,
  setCriticalFlag,
  listTriageHistory,
};
