const { withTransaction, query } = require('../config/db');
const { transferResource } = require('./resourceService');
const { recordVisitEvent, findIdempotentActionResult } = require('./visitEventService');

async function createTransferRequest(visitId, toBedId, actorUser, actionContext = {}) {
  if (!toBedId) throw { status: 400, message: 'bedId (cible) requis.' };

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const pending = await client.query(
      `SELECT id FROM transfer_requests
       WHERE visit_id = $1 AND status = 'pending'`,
      [visitId],
    );
    if (pending.rowCount > 0) {
      throw { status: 409, message: 'Un transfert est déjà en préparation pour cette visite.' };
    }

    const current = await client.query(
      `SELECT bed_id FROM bed_assignments WHERE visit_id = $1 AND released_at IS NULL`,
      [visitId],
    );

    const insert = await client.query(
      `INSERT INTO transfer_requests (visit_id, from_bed_id, to_bed_id, requested_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [visitId, current.rows[0]?.bed_id || null, toBedId, actorUser?.id || null],
    );

    const row = insert.rows[0];
    const result = {
      transferRequestId: Number(row.id),
      visitId: Number(visitId),
      fromBedId: row.from_bed_id ? Number(row.from_bed_id) : null,
      toBedId: Number(row.to_bed_id),
      status: row.status,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'transfer_requested',
      fromStatus: null,
      toStatus: null,
      metadata: result,
      actionResult: result,
    });

    return result;
  });
}

async function confirmTransferRequest(transferRequestId, actorUser, actionContext = {}) {
  const reqRes = await query(`SELECT * FROM transfer_requests WHERE id = $1`, [transferRequestId]);
  if (reqRes.rowCount === 0) throw { status: 404, message: 'Demande de transfert introuvable.' };

  const req = reqRes.rows[0];
  if (req.status !== 'pending') {
    throw { status: 409, message: `Transfert déjà ${req.status}.` };
  }

  const transferResult = await transferResource(
    req.visit_id,
    req.to_bed_id,
    actorUser,
    actionContext,
  );

  await query(
    `UPDATE transfer_requests
     SET status = 'confirmed', confirmed_by = $2, confirmed_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [transferRequestId, actorUser?.id || null],
  );

  const result = { transferRequestId: Number(transferRequestId), ...transferResult, status: 'confirmed' };

  await withTransaction(async (client) => {
    await recordVisitEvent(client, {
      visitId: req.visit_id,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'transfer_confirmed',
      fromStatus: null,
      toStatus: null,
      metadata: result,
      actionResult: result,
    });
  });

  return result;
}

async function cancelTransferRequest(transferRequestId, actorUser, { reason } = {}, actionContext = {}) {
  return withTransaction(async (client) => {
    const reqRes = await client.query(
      `SELECT * FROM transfer_requests WHERE id = $1 FOR UPDATE`,
      [transferRequestId],
    );
    if (reqRes.rowCount === 0) throw { status: 404, message: 'Demande de transfert introuvable.' };

    const req = reqRes.rows[0];
    if (req.status !== 'pending') {
      throw { status: 409, message: `Impossible d'annuler un transfert ${req.status}.` };
    }

    await client.query(
      `UPDATE transfer_requests
       SET status = 'cancelled', cancelled_by = $2, cancelled_at = NOW(), cancel_reason = $3
       WHERE id = $1`,
      [transferRequestId, actorUser?.id || null, reason || null],
    );

    const result = { transferRequestId: Number(transferRequestId), status: 'cancelled' };

    await recordVisitEvent(client, {
      visitId: req.visit_id,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'transfer_cancelled',
      fromStatus: null,
      toStatus: null,
      metadata: { ...result, reason: reason || null },
      actionResult: result,
    });

    return result;
  });
}

async function getPendingTransferForVisit(visitId) {
  const res = await query(
    `SELECT * FROM transfer_requests WHERE visit_id = $1 AND status = 'pending' ORDER BY requested_at DESC LIMIT 1`,
    [visitId],
  );
  return res.rows[0] || null;
}

module.exports = {
  createTransferRequest,
  confirmTransferRequest,
  cancelTransferRequest,
  getPendingTransferForVisit,
};
