const { createVisitTools } = require('../../services/visitTools');
const { getEffectiveAiSettings } = require('../../services/aiSettingsService');
const { isVisitSimulationEligible } = require('../safety/simulation-guard');
const {
  createRecommendation,
  createAction,
  createApprovalRequest,
  decideApproval,
} = require('../observability/ai-audit');
const {
  canPropose,
  canExecuteTool,
  getToolRisk,
  requiresHumanApproval,
  assertSimulationVisitAllowed,
  isAiPlatformEnabled,
} = require('./action-policy');
const { query } = require('../../config/db');

async function proposeRecommendation({
  agentRunId,
  visitId,
  recommendationType,
  payload,
  confidence,
}) {
  if (!isAiPlatformEnabled()) {
    throw { status: 503, message: 'AI platform disabled.' };
  }
  const settings = await getEffectiveAiSettings();
  if (!canPropose(settings.effectiveMode)) {
    throw { status: 403, message: 'AI propose is not allowed in current mode.' };
  }
  return createRecommendation({
    agentRunId,
    visitId,
    recommendationType,
    payload,
    confidence,
  });
}

async function requestToolExecution({
  agentRunId,
  visitId,
  toolName,
  argumentsJson,
  actorUser,
  actionContext = {},
}) {
  if (!isAiPlatformEnabled()) {
    throw { status: 503, message: 'AI platform disabled.' };
  }
  const settings = await getEffectiveAiSettings();
  const simulationOk = visitId ? await isVisitSimulationEligible(visitId) : false;
  assertSimulationVisitAllowed(simulationOk, settings.effectiveMode);

  const riskLevel = getToolRisk(toolName);
  const needsApproval = requiresHumanApproval(toolName, settings.effectiveMode);

  if (!canExecuteTool(toolName, settings.effectiveMode) && needsApproval) {
    throw {
      status: 403,
      message: `Tool execution blocked for '${toolName}' in mode ${settings.effectiveMode}. Use human approval workflow.`,
    };
  }

  const action = await createAction({
    agentRunId,
    toolName,
    argumentsJson,
    riskLevel,
    requiresApproval: needsApproval,
  });

  if (needsApproval) {
    const approval = await createApprovalRequest(action.id);
    return { action, approval, executed: false };
  }

  const result = await executeApprovedAction(action.id, actorUser, actionContext);
  return { action: result.action, executed: true, result: result.result };
}

async function executeApprovedAction(actionId, actorUser, actionContext = {}) {
  const actionRes = await query('SELECT * FROM agent_actions WHERE id = $1', [actionId]);
  if (actionRes.rowCount === 0) {
    throw { status: 404, message: 'Agent action not found.' };
  }
  const row = actionRes.rows[0];
  const settings = await getEffectiveAiSettings();

  if (row.requires_approval && row.approval_status !== 'approved') {
    throw { status: 403, message: 'Action not approved.' };
  }

  const viaApproval = row.requires_approval && row.approval_status === 'approved';
  if (!canExecuteTool(row.tool_name, settings.effectiveMode, { viaApproval })) {
    throw { status: 403, message: 'Execute path not enabled for this mode.' };
  }

  const tools = createVisitTools(actorUser, {
    ...actionContext,
    actorType: actionContext.actorType || 'agent',
    agentRunId: actionContext.agentRunId || row.agent_run_id,
  });

  const fn = tools[row.tool_name];
  if (typeof fn !== 'function') {
    throw { status: 400, message: `Unknown tool: ${row.tool_name}` };
  }

  const args = row.arguments_json || {};
  let result;
  if (row.tool_name === 'register') {
    result = await fn(args);
  } else if (['call', 'place', 'start', 'fill', 'triage', 'close', 'return'].includes(row.tool_name)) {
    const visitId = args.visitId ?? args.visit_id;
    result = await fn(visitId, args.payload ?? args.data ?? args);
  } else {
    result = await fn(args);
  }

  await query(
    `UPDATE agent_actions
     SET execution_status = 'completed', executed_at = NOW(), result_json = $2::jsonb
     WHERE id = $1`,
    [actionId, JSON.stringify(result ?? {})],
  );

  return { action: row, result };
}

async function approveAndExecute(approvalId, reviewerUser, { comment, actionContext } = {}) {
  const approval = await decideApproval(approvalId, {
    reviewerId: reviewerUser.id,
    decision: 'approved',
    comment,
  });
  const actionRes = await query('SELECT * FROM agent_actions WHERE id = $1', [
    approval.agentActionId,
  ]);
  const action = actionRes.rows[0];
  const executed = await executeApprovedAction(action.id, reviewerUser, actionContext);
  return { approval, ...executed };
}

async function rejectApproval(approvalId, reviewerUser, { comment } = {}) {
  const approval = await decideApproval(approvalId, {
    reviewerId: reviewerUser.id,
    decision: 'rejected',
    comment,
  });
  await query(
    `UPDATE agent_actions SET execution_status = 'cancelled' WHERE id = $1`,
    [approval.agentActionId],
  );
  return approval;
}

module.exports = {
  proposeRecommendation,
  requestToolExecution,
  executeApprovedAction,
  approveAndExecute,
  rejectApproval,
};
