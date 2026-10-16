const { query, withTransaction } = require('../config/db');

async function upsertOpenAlert(client, alert) {
  const {
    alertType,
    severity = 'medium',
    visitId = null,
    bedId = null,
    dedupeKey,
    reasonCode = null,
    explanation = null,
    responsibleRole = null,
    metadata = {},
  } = alert;

  const existing = await client.query(
    `SELECT id, status FROM operational_alerts
     WHERE dedupe_key = $1 AND status IN ('open', 'acknowledged')
     LIMIT 1`,
    [dedupeKey],
  );

  if (existing.rowCount > 0) {
    await client.query(
      `UPDATE operational_alerts
       SET explanation = COALESCE($2, explanation),
           severity = $3,
           metadata = metadata || $4::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, explanation, severity, JSON.stringify(metadata)],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO operational_alerts (
       alert_type, severity, status, visit_id, bed_id, dedupe_key,
       reason_code, explanation, responsible_role, metadata
     ) VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [
      alertType,
      severity,
      visitId,
      bedId,
      dedupeKey,
      reasonCode,
      explanation,
      responsibleRole,
      JSON.stringify(metadata),
    ],
  );
  return inserted.rows[0].id;
}

async function logAlertEvent(client, alertId, eventType, actorId, metadata = {}) {
  try {
    await client.query(
      `INSERT INTO operational_alert_events (alert_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [alertId, actorId || null, eventType, JSON.stringify(metadata)],
    );
  } catch {
    // Table may be absent before supervision migration — audit optional.
  }
}

async function listAlerts({ status = 'open', limit = 100, severity = null } = {}) {
  const allowed = ['open', 'acknowledged', 'resolved', 'obsolete', 'active', 'all'];
  const st = allowed.includes(status) ? status : 'open';
  const params = [];
  const clauses = [];
  if (st === 'active') {
    clauses.push(`oa.status IN ('open', 'acknowledged')`);
  } else if (st !== 'all') {
    params.push(st);
    clauses.push(`oa.status = $${params.length}`);
  }
  if (severity) {
    params.push(severity);
    clauses.push(`oa.severity = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(Math.min(200, Math.max(1, limit)));
  const limitIdx = params.length;

  const res = await query(
    `SELECT oa.*, v.public_code
     FROM operational_alerts oa
     LEFT JOIN visits v ON v.id = oa.visit_id
     ${where}
     ORDER BY
       CASE oa.severity
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       oa.created_at DESC
     LIMIT $${limitIdx}`,
    params,
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    alertType: row.alert_type,
    severity: row.severity,
    status: row.status,
    visitId: row.visit_id ? Number(row.visit_id) : null,
    publicCode: row.public_code,
    bedId: row.bed_id ? Number(row.bed_id) : null,
    dedupeKey: row.dedupe_key,
    reasonCode: row.reason_code,
    explanation: row.explanation,
    responsibleRole: row.responsible_role,
    source: row.source,
    metadata: row.metadata,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  }));
}

async function acknowledgeAlert(alertId, actorUser) {
  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE operational_alerts
       SET status = 'acknowledged',
           acknowledged_by = $2,
           acknowledged_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [alertId, actorUser?.id || null],
    );
    if (res.rowCount === 0) {
      throw { status: 409, message: 'Alerte introuvable ou déjà traitée.' };
    }
    await logAlertEvent(client, alertId, 'acknowledged', actorUser?.id || null, {});
    return res.rows[0];
  });
}

async function resolveAlert(alertId, actorUser, { note } = {}) {
  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE operational_alerts
       SET status = 'resolved',
           resolved_by = $2,
           resolved_at = NOW(),
           metadata = metadata || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND status IN ('open', 'acknowledged')
       RETURNING *`,
      [alertId, actorUser?.id || null, JSON.stringify({ resolveNote: note || null })],
    );
    if (res.rowCount === 0) {
      throw { status: 409, message: 'Alerte introuvable ou déjà résolue.' };
    }
    await logAlertEvent(client, alertId, 'resolved', actorUser?.id || null, { note: note || null });
    return res.rows[0];
  });
}

/** Mark alerts obsolete when visit closed; auto-resolve when dedupe no longer active. */
async function reconcileOperationalAlerts(client) {
  await client.query(
    `UPDATE operational_alerts oa
     SET status = 'obsolete',
         resolved_at = COALESCE(resolved_at, NOW()),
         metadata = metadata || '{"resolveReason":"visit_closed"}'::jsonb,
         updated_at = NOW()
     WHERE oa.status IN ('open', 'acknowledged')
       AND oa.visit_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM visits v
         WHERE v.id = oa.visit_id AND v.closed_at IS NOT NULL
       )`,
  );

  await client.query(
    `UPDATE operational_alerts oa
     SET status = 'resolved',
         resolved_at = NOW(),
         metadata = metadata || '{"resolveReason":"condition_cleared"}'::jsonb,
         updated_at = NOW()
     WHERE oa.status IN ('open', 'acknowledged')
       AND oa.alert_type = 'UNTRIAGED_PATIENT'
       AND oa.visit_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM visits v
         WHERE v.id = oa.visit_id
           AND v.closed_at IS NULL
           AND v.care_stage IN ('registered', 'triage_pending')
       )`,
  );

  await client.query(
    `UPDATE operational_alerts oa
     SET status = 'resolved',
         resolved_at = NOW(),
         metadata = metadata || '{"resolveReason":"condition_cleared"}'::jsonb,
         updated_at = NOW()
     WHERE oa.status IN ('open', 'acknowledged')
       AND oa.alert_type = 'REASSESSMENT_DUE'
       AND oa.visit_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM visits v
         WHERE v.id = oa.visit_id AND v.closed_at IS NULL
       )`,
  );

  await client.query(
    `UPDATE operational_alerts oa
     SET status = 'resolved',
         resolved_at = NOW(),
         metadata = metadata || '{"resolveReason":"bed_ready"}'::jsonb,
         updated_at = NOW()
     WHERE oa.status IN ('open', 'acknowledged')
       AND oa.alert_type = 'BED_TURNOVER_PENDING'
       AND oa.bed_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM beds b
         WHERE b.id = oa.bed_id AND b.operational_status = 'ready'
       )`,
  );
}

module.exports = {
  upsertOpenAlert,
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
  reconcileOperationalAlerts,
  logAlertEvent,
};
