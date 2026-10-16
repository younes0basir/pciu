const { query, withTransaction } = require('../../config/db');

async function createRun({
  agentType,
  visitId = null,
  mode,
  modelId = null,
  promptVersion = null,
}) {
  const result = await query(
    `INSERT INTO agent_runs (
       agent_type, visit_id, mode, model_id, prompt_version, status
     ) VALUES ($1, $2, $3, $4, $5, 'running')
     RETURNING *`,
    [agentType, visitId, mode, modelId, promptVersion],
  );
  return mapRun(result.rows[0]);
}

async function completeRun(runId, { status = 'completed', inputTokens, outputTokens, latencyMs, errorCode } = {}) {
  const result = await query(
    `UPDATE agent_runs
     SET completed_at = NOW(),
         status = $2,
         input_tokens = COALESCE($3, input_tokens),
         output_tokens = COALESCE($4, output_tokens),
         latency_ms = COALESCE($5, latency_ms),
         error_code = $6
     WHERE id = $1
     RETURNING *`,
    [runId, status, inputTokens ?? null, outputTokens ?? null, latencyMs ?? null, errorCode ?? null],
  );
  if (result.rowCount === 0) {
    throw { status: 404, message: 'Agent run not found.' };
  }
  return mapRun(result.rows[0]);
}

async function createRecommendation({
  agentRunId,
  visitId,
  recommendationType,
  payload,
  confidence = null,
}) {
  const result = await query(
    `INSERT INTO agent_recommendations (
       agent_run_id, visit_id, recommendation_type, payload_json, confidence, status
     ) VALUES ($1, $2, $3, $4::jsonb, $5, 'pending')
     RETURNING *`,
    [agentRunId, visitId, recommendationType, JSON.stringify(payload || {}), confidence],
  );
  return mapRecommendation(result.rows[0]);
}

async function getRunById(runId) {
  const result = await query('SELECT * FROM agent_runs WHERE id = $1', [runId]);
  if (result.rowCount === 0) return null;
  return mapRun(result.rows[0]);
}

async function listRecommendations({ visitId, status, limit = 20 }) {
  const clauses = [];
  const params = [];
  if (visitId != null) {
    params.push(visitId);
    clauses.push(`visit_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  params.push(Math.min(100, Math.max(1, limit)));
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM agent_recommendations ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(mapRecommendation);
}

async function updateRecommendationStatus(recommendationId, { status, reviewedBy, humanDecision }) {
  const result = await query(
    `UPDATE agent_recommendations
     SET status = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         human_decision = $4
     WHERE id = $1
     RETURNING *`,
    [recommendationId, status, reviewedBy ?? null, humanDecision ?? null],
  );
  if (result.rowCount === 0) {
    throw { status: 404, message: 'Recommendation not found.' };
  }
  return mapRecommendation(result.rows[0]);
}

async function createAction({
  agentRunId,
  toolName,
  argumentsJson,
  riskLevel,
  requiresApproval = true,
}) {
  const result = await query(
    `INSERT INTO agent_actions (
       agent_run_id, tool_name, arguments_json, risk_level, requires_approval
     ) VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING *`,
    [agentRunId, toolName, JSON.stringify(argumentsJson || {}), riskLevel, requiresApproval],
  );
  return mapAction(result.rows[0]);
}

async function createApprovalRequest(agentActionId) {
  const result = await query(
    `INSERT INTO agent_approvals (agent_action_id) VALUES ($1) RETURNING *`,
    [agentActionId],
  );
  return mapApproval(result.rows[0]);
}

async function decideApproval(approvalId, { reviewerId, decision, comment }) {
  return withTransaction(async (client) => {
    const approvalRes = await client.query(
      `UPDATE agent_approvals
       SET reviewer_id = $2, decision = $3, comment = $4, decided_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [approvalId, reviewerId, decision, comment ?? null],
    );
    if (approvalRes.rowCount === 0) {
      throw { status: 404, message: 'Approval not found.' };
    }
    const approval = mapApproval(approvalRes.rows[0]);
    await client.query(
      `UPDATE agent_actions
       SET approval_status = $2
       WHERE id = $1`,
      [approval.agentActionId, decision],
    );
    return approval;
  });
}

function mapRun(row) {
  return {
    id: row.id,
    agentType: row.agent_type,
    visitId: row.visit_id != null ? Number(row.visit_id) : null,
    mode: row.mode,
    provider: row.provider,
    modelId: row.model_id,
    promptVersion: row.prompt_version,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    latencyMs: row.latency_ms,
    errorCode: row.error_code,
  };
}

function mapRecommendation(row) {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    visitId: row.visit_id != null ? Number(row.visit_id) : null,
    recommendationType: row.recommendation_type,
    payload: row.payload_json,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    humanDecision: row.human_decision,
    createdAt: row.created_at,
  };
}

function mapAction(row) {
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    toolName: row.tool_name,
    arguments: row.arguments_json,
    riskLevel: row.risk_level,
    requiresApproval: row.requires_approval,
    approvalStatus: row.approval_status,
    executionStatus: row.execution_status,
    result: row.result_json,
    createdAt: row.created_at,
    executedAt: row.executed_at,
  };
}

function mapApproval(row) {
  return {
    id: row.id,
    agentActionId: row.agent_action_id,
    reviewerId: row.reviewer_id,
    decision: row.decision,
    comment: row.comment,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
  };
}

module.exports = {
  createRun,
  completeRun,
  createRecommendation,
  getRunById,
  listRecommendations,
  updateRecommendationStatus,
  createAction,
  createApprovalRequest,
  decideApproval,
};
