const { getAiEnvConfig } = require('../../config/aiEnv');

const TASK_PROFILES = {
  documentation: 'reasoning',
  triage: 'reasoning',
  bed_flow: 'fast',
  capacity: 'fast',
  embed: 'embedding',
};

function resolveModel(taskProfile) {
  const config = getAiEnvConfig();
  const key = TASK_PROFILES[taskProfile] || 'reasoning';
  if (key === 'embedding') return config.models.embedding;
  if (key === 'fast') return config.models.fast;
  return config.models.reasoning;
}

module.exports = {
  resolveModel,
};
