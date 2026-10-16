const { query, withTransaction } = require('../config/db');
const { logVisitAction } = require('../lib/visitActionLogger');
const { publishVisitEvent } = require('./visitEventBus');
const {
  findIdempotentActionResult,
  recordVisitEvent,
} = require('./visitEventService');

const BLOCKED_OPERATIONAL = ['maintenance', 'blocked', 'out_of_service'];

async function recordBedStatusChange(client, bedId, fromStatus, toStatus, actorUser, note) {
  const inserted = await client.query(
    `INSERT INTO resource_status_events (bed_id, from_status, to_status, actor_user_id, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [bedId, fromStatus, toStatus, actorUser?.id || null, note || null],
  );
  const row = inserted.rows[0];
  publishVisitEvent({
    id: Number(row.id),
    visitId: null,
    eventType: 'resource_status_changed',
    fromStatus,
    toStatus,
    actorType: 'user',
    agentRunId: null,
    createdAt: row.created_at,
    bedId: Number(bedId),
  });
  return row;
}

async function releaseBedToTurnover(client, bedId, actorUser, { note, visitId } = {}) {
  if (!bedId) return null;

  const bedRes = await client.query(
    `SELECT id, operational_status FROM beds WHERE id = $1 FOR UPDATE`,
    [bedId],
  );
  if (bedRes.rowCount === 0) return null;

  const fromStatus = bedRes.rows[0].operational_status;
  if (fromStatus === 'cleaning') {
    return { bedId, operationalStatus: 'cleaning', unchanged: true };
  }

  await client.query(`UPDATE beds SET operational_status = 'cleaning' WHERE id = $1`, [bedId]);
  await recordBedStatusChange(client, bedId, fromStatus, 'cleaning', actorUser, note);

  if (visitId) {
    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext: {},
      eventType: 'bed_turnover_started',
      fromStatus: null,
      toStatus: null,
      metadata: { bedId, fromOperationalStatus: fromStatus, toOperationalStatus: 'cleaning' },
    });
  }

  return { bedId, fromStatus, operationalStatus: 'cleaning' };
}

async function assertBedAssignable(client, bedId) {
  const bedRes = await client.query(
    `SELECT id, label, is_active, operational_status FROM beds WHERE id = $1 FOR UPDATE`,
    [bedId],
  );
  if (bedRes.rowCount === 0 || !bedRes.rows[0].is_active) {
    throw { status: 404, message: 'Ressource introuvable ou inactive.' };
  }
  const bed = bedRes.rows[0];

  if (BLOCKED_OPERATIONAL.includes(bed.operational_status)) {
    throw {
      status: 409,
      message: `Ressource non disponible (état : ${bed.operational_status}).`,
    };
  }
  if (bed.operational_status !== 'ready') {
    throw {
      status: 409,
      message: `Ressource non assignable (état : ${bed.operational_status}). Confirmer la remise en service après nettoyage.`,
    };
  }

  return bed;
}

async function transferResource(visitId, newBedId, actorUser, actionContext = {}) {
  if (!newBedId) {
    throw { status: 400, message: 'newBedId est requis.' };
  }

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }
    const visit = visitRes.rows[0];
    if (visit.care_stage === 'completed') {
      throw { status: 400, message: 'Visite terminée.' };
    }

    const currentAssign = await client.query(
      `SELECT id, bed_id FROM bed_assignments
       WHERE visit_id = $1 AND released_at IS NULL
       FOR UPDATE`,
      [visitId],
    );

    const newBed = await assertBedAssignable(client, newBedId);

    const occupied = await client.query(
      'SELECT visit_id FROM bed_assignments WHERE bed_id = $1 AND released_at IS NULL',
      [newBedId],
    );
    if (occupied.rowCount > 0 && Number(occupied.rows[0].visit_id) !== Number(visitId)) {
      throw { status: 409, message: 'La ressource cible est déjà occupée.' };
    }

    let fromBedId = null;
    if (currentAssign.rowCount > 0) {
      fromBedId = currentAssign.rows[0].bed_id;
      if (Number(fromBedId) === Number(newBedId)) {
        return { visitId, bedId: newBedId, unchanged: true };
      }
      await client.query(
        `UPDATE bed_assignments
         SET released_at = NOW(), released_by = $1, release_reason = 'transfer'
         WHERE id = $2`,
        [actorUser?.id || null, currentAssign.rows[0].id],
      );
    }

    const insert = await client.query(
      `INSERT INTO bed_assignments (visit_id, bed_id, assigned_by, assigned_at, assignment_reason)
       VALUES ($1, $2, $3, NOW(), 'transfer')
       RETURNING *`,
      [visitId, newBedId, actorUser?.id || null],
    );

    if (fromBedId) {
      await releaseBedToTurnover(client, fromBedId, actorUser, {
        note: 'Transfert sortant',
        visitId,
      });
    }

    await client.query(
      `UPDATE visits
       SET patient_location = 'resource',
           status = CASE WHEN status = 'waiting' THEN 'placed' ELSE status END,
           care_stage = CASE WHEN care_stage IN ('triage_pending', 'registered') THEN 'waiting_care' ELSE care_stage END,
           updated_at = NOW()
       WHERE id = $1`,
      [visitId],
    );

    const result = {
      visitId,
      fromBedId,
      bedId: newBedId,
      bedLabel: newBed.label,
      assignedAt: insert.rows[0].assigned_at,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'resource_transferred',
      fromStatus: visit.status,
      toStatus: visit.status === 'waiting' ? 'placed' : visit.status,
      metadata: { fromBedId, toBedId: newBedId },
      actionResult: result,
    });

    logVisitAction({
      action: 'transfer_resource',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function setOperationalStatus(bedId, data, actorUser, actionContext = {}) {
  const toStatus = data?.operationalStatus;
  const allowed = ['cleaning', 'maintenance', 'blocked', 'out_of_service'];
  if (!allowed.includes(toStatus)) {
    if (toStatus === 'ready') {
      throw {
        status: 422,
        message:
          'Utiliser la confirmation de nettoyage (confirm-ready) pour remettre une ressource en service.',
      };
    }
    throw { status: 400, message: 'operationalStatus invalide.' };
  }

  return withTransaction(async (client) => {
    const bedRes = await client.query(
      'SELECT id, operational_status FROM beds WHERE id = $1 FOR UPDATE',
      [bedId],
    );
    if (bedRes.rowCount === 0) {
      throw { status: 404, message: 'Ressource introuvable.' };
    }

    const occupied = await client.query(
      `SELECT visit_id FROM bed_assignments WHERE bed_id = $1 AND released_at IS NULL`,
      [bedId],
    );
    if (occupied.rowCount > 0) {
      throw {
        status: 409,
        message: 'Impossible de modifier l\'état d\'une ressource encore occupée.',
      };
    }

    const fromStatus = bedRes.rows[0].operational_status;
    if (fromStatus === toStatus) {
      return { bedId, fromStatus, operationalStatus: toStatus, unchanged: true };
    }

    await client.query(
      `UPDATE beds SET operational_status = $1 WHERE id = $2`,
      [toStatus, bedId],
    );

    await recordBedStatusChange(client, bedId, fromStatus, toStatus, actorUser, data?.note || null);

    return { bedId, fromStatus, operationalStatus: toStatus };
  });
}

async function markBedCleaning(bedId, data, actorUser) {
  return setOperationalStatus(
    bedId,
    { operationalStatus: 'cleaning', note: data?.note || 'Nettoyage déclaré' },
    actorUser,
  );
}

async function confirmBedReady(bedId, data, actorUser, actionContext = {}) {
  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const bedRes = await client.query(
      `SELECT id, operational_status FROM beds WHERE id = $1 FOR UPDATE`,
      [bedId],
    );
    if (bedRes.rowCount === 0) {
      throw { status: 404, message: 'Ressource introuvable.' };
    }

    const fromStatus = bedRes.rows[0].operational_status;
    const allowedFrom = ['cleaning', 'maintenance'];
    if (!allowedFrom.includes(fromStatus)) {
      throw {
        status: 409,
        message: `Remise en service impossible depuis l'état « ${fromStatus} ».`,
      };
    }

    const occupied = await client.query(
      `SELECT visit_id FROM bed_assignments WHERE bed_id = $1 AND released_at IS NULL`,
      [bedId],
    );
    if (occupied.rowCount > 0) {
      throw { status: 409, message: 'Le lit est encore occupé.' };
    }

    await client.query(`UPDATE beds SET operational_status = 'ready' WHERE id = $1`, [bedId]);
    await recordBedStatusChange(
      client,
      bedId,
      fromStatus,
      'ready',
      actorUser,
      data?.note || 'Nettoyage vérifié',
    );

    const lastVisit = await client.query(
      `SELECT visit_id FROM bed_assignments
       WHERE bed_id = $1
       ORDER BY COALESCE(released_at, assigned_at) DESC NULLS LAST
       LIMIT 1`,
      [bedId],
    );
    const visitId = lastVisit.rows[0]?.visit_id ?? null;
    if (visitId) {
      await recordVisitEvent(client, {
        visitId,
        actorUserId: actorUser?.id || null,
        actionContext,
        eventType: 'bed_ready_confirmed',
        fromStatus: null,
        toStatus: null,
        metadata: {
          bedId: Number(bedId),
          fromOperationalStatus: fromStatus,
          toOperationalStatus: 'ready',
          note: data?.note || null,
        },
        actionResult: { bedId: Number(bedId), operationalStatus: 'ready' },
      });
    }

    return { bedId, fromStatus, operationalStatus: 'ready' };
  });
}

async function listResourcesWithStatus() {
  const result = await query(
    `SELECT
      b.id AS bed_id,
      b.label AS bed_label,
      b.resource_type,
      b.operational_status,
      r.id AS room_id,
      r.name AS room_name,
      z.id AS zone_id,
      z.name AS zone_name,
      z.color AS zone_color,
      ba.visit_id,
      v.public_code,
      v.care_stage,
      v.priority
    FROM beds b
    JOIN rooms r ON r.id = b.room_id
    JOIN zones z ON z.id = r.zone_id
    LEFT JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
    LEFT JOIN visits v ON v.id = ba.visit_id
    WHERE b.is_active AND r.is_active AND z.is_active
    ORDER BY z.display_order, r.display_order, b.display_order, b.label`,
  );

  return result.rows.map((row) => ({
    bedId: row.bed_id,
    bedLabel: row.bed_label,
    resourceType: row.resource_type,
    operationalStatus: row.operational_status,
    occupied: Boolean(row.visit_id),
    visitId: row.visit_id,
    publicCode: row.public_code,
    careStage: row.care_stage,
    priority: row.priority,
    roomId: row.room_id,
    roomName: row.room_name,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    zoneColor: row.zone_color,
  }));
}

module.exports = {
  transferResource,
  setOperationalStatus,
  markBedCleaning,
  confirmBedReady,
  listResourcesWithStatus,
  assertBedAssignable,
  releaseBedToTurnover,
  recordBedStatusChange,
};
