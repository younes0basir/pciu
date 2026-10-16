const { withTransaction, query } = require('../config/db');

async function createHandoffRequest(visitId, data, actorUser) {
  const { toUserId, fromScope, toScope, reason } = data || {};
  if (!toUserId) throw { status: 400, message: 'toUserId requis.' };

  return withTransaction(async (client) => {
    const pending = await client.query(
      `SELECT id FROM handoff_requests WHERE visit_id = $1 AND status = 'pending'`,
      [visitId],
    );
    if (pending.rowCount > 0) {
      throw { status: 409, message: 'Une passation est déjà en attente pour cette visite.' };
    }

    const insert = await client.query(
      `INSERT INTO handoff_requests (
         visit_id, from_user_id, to_user_id, from_scope, to_scope, reason, requested_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        visitId,
        actorUser?.id || null,
        toUserId,
        fromScope || null,
        toScope || null,
        reason || null,
        actorUser?.id || null,
      ],
    );

    return mapHandoffRow(insert.rows[0]);
  });
}

async function respondHandoffRequest(handoffId, accept, actorUser, { note } = {}) {
  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT * FROM handoff_requests WHERE id = $1 FOR UPDATE`,
      [handoffId],
    );
    if (res.rowCount === 0) throw { status: 404, message: 'Passation introuvable.' };

    const row = res.rows[0];
    if (row.status !== 'pending') {
      throw { status: 409, message: 'Passation déjà traitée.' };
    }
    if (Number(row.to_user_id) !== Number(actorUser.id)) {
      throw { status: 403, message: 'Seul le destinataire peut accepter ou refuser.' };
    }

    const status = accept ? 'accepted' : 'declined';
    await client.query(
      `UPDATE handoff_requests
       SET status = $2, responded_by = $3, responded_at = NOW(), reason = COALESCE($4, reason)
       WHERE id = $1`,
      [handoffId, status, actorUser.id, note || null],
    );

    const updated = await client.query(`SELECT * FROM handoff_requests WHERE id = $1`, [handoffId]);
    return mapHandoffRow(updated.rows[0]);
  });
}

async function listHandoffsForVisit(visitId) {
  const res = await query(
    `SELECT * FROM handoff_requests WHERE visit_id = $1 ORDER BY requested_at DESC`,
    [visitId],
  );
  return res.rows.map(mapHandoffRow);
}

function mapHandoffRow(row) {
  return {
    id: Number(row.id),
    visitId: Number(row.visit_id),
    fromUserId: row.from_user_id ? Number(row.from_user_id) : null,
    toUserId: row.to_user_id ? Number(row.to_user_id) : null,
    fromScope: row.from_scope,
    toScope: row.to_scope,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
  };
}

module.exports = {
  createHandoffRequest,
  respondHandoffRequest,
  listHandoffsForVisit,
};
