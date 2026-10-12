const { publishVisitEvent } = require('./visitEventBus');

const ACTOR_TYPES = new Set(['user', 'agent', 'system']);

function normalizeActionContext(actionContext = {}) {
  const actorTypeRaw = actionContext.actorType ?? 'user';
  const actorType = ACTOR_TYPES.has(actorTypeRaw) ? actorTypeRaw : 'user';
  const agentRunId = actionContext.agentRunId ?? null;
  const idempotencyKey =
    actionContext.idempotencyKey != null && String(actionContext.idempotencyKey).trim()
      ? String(actionContext.idempotencyKey).trim()
      : null;

  return { actorType, agentRunId, idempotencyKey };
}

function parseActionResult(metadata) {
  if (!metadata) {
    return null;
  }
  if (typeof metadata === 'object' && metadata.actionResult != null) {
    return metadata.actionResult;
  }
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed?.actionResult ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

async function findIdempotentActionResult(client, idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  const existing = await client.query(
    `SELECT metadata
     FROM visit_events
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey],
  );

  if (existing.rowCount === 0) {
    return null;
  }

  return parseActionResult(existing.rows[0].metadata);
}

async function recordVisitEvent(client, params) {
  const {
    visitId,
    actorUserId,
    actionContext,
    eventType,
    fromStatus,
    toStatus,
    metadata = {},
    actionResult,
  } = params;

  const ctx = normalizeActionContext(actionContext);
  const payload = {
    ...metadata,
    ...(actionResult !== undefined ? { actionResult } : {}),
  };

  const inserted = await client.query(
    `INSERT INTO visit_events (
      visit_id,
      actor_user_id,
      actor_type,
      agent_run_id,
      idempotency_key,
      event_type,
      from_status,
      to_status,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    RETURNING id, visit_id, event_type, from_status, to_status, actor_type, agent_run_id, created_at`,
    [
      visitId,
      actorUserId ?? null,
      ctx.actorType,
      ctx.agentRunId,
      ctx.idempotencyKey,
      eventType,
      fromStatus,
      toStatus,
      JSON.stringify(payload),
    ],
  );

  const row = inserted.rows[0];
  const broadcast = {
    id: Number(row.id),
    visitId: Number(row.visit_id),
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorType: row.actor_type,
    agentRunId: row.agent_run_id,
    createdAt: row.created_at,
  };

  publishVisitEvent(broadcast);
  return broadcast;
}

module.exports = {
  findIdempotentActionResult,
  normalizeActionContext,
  recordVisitEvent,
};
