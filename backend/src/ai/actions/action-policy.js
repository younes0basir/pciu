const { getAiEnvConfig } = require('../../config/aiEnv');

const AUTO_ALLOWED_TOOLS = new Set([
  'createReassessmentTask',
  'refreshWorklist',
  'raiseOperationalAlert',
]);

const TOOL_RISK = {
  register: 'high',
  call: 'medium',
  place: 'high',
  triage: 'critical',
  start: 'high',
  fill: 'high',
  close: 'critical',
  return: 'medium',
  transfer: 'high',
  createReassessmentTask: 'low',
  refreshWorklist: 'low',
  raiseOperationalAlert: 'low',
};

function getToolRisk(toolName) {
  return TOOL_RISK[toolName] || 'high';
}

function canPropose(effectiveMode) {
  return effectiveMode != null && effectiveMode !== 'disabled';
}

function canExecuteTool(toolName, effectiveMode, { viaApproval = false } = {}) {
  if (effectiveMode === 'disabled') return false;
  if (AUTO_ALLOWED_TOOLS.has(toolName)) {
    return effectiveMode === 'supervised_autonomy' || effectiveMode === 'full_control_simulation';
  }
  if (viaApproval && (effectiveMode === 'collaborative' || effectiveMode === 'supervised_autonomy')) {
    return true;
  }
  if (effectiveMode === 'full_control_simulation') {
    return true;
  }
  return false;
}

function requiresHumanApproval(toolName, effectiveMode) {
  if (AUTO_ALLOWED_TOOLS.has(toolName)) return false;
  if (effectiveMode === 'full_control_simulation') return false;
  return true;
}

function assertSimulationVisitAllowed(isSimulationVisit, effectiveMode) {
  if (effectiveMode !== 'full_control_simulation') return;
  if (!isSimulationVisit) {
    throw {
      status: 403,
      message: 'Full control simulation is only allowed on demo/fictitious visits.',
    };
  }
}

function isAiPlatformEnabled() {
  return getAiEnvConfig().infraReady;
}

module.exports = {
  AUTO_ALLOWED_TOOLS,
  getToolRisk,
  canPropose,
  canExecuteTool,
  requiresHumanApproval,
  assertSimulationVisitAllowed,
  isAiPlatformEnabled,
};
