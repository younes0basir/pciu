const { getEffectiveAiSettings } = require('../../services/aiSettingsService');
const { getAiEnvConfig } = require('../../config/aiEnv');

async function maybeRunShadowTriage(visitId) {
  const env = getAiEnvConfig();
  if (!env.enabled) return;
  const settings = await getEffectiveAiSettings();
  if (!settings.agentFlags.triageShadow) return;
  const { recommendTriage } = require('../agents/triage-agent');
  await recommendTriage(visitId, { shadow: true });
}

module.exports = {
  maybeRunShadowTriage,
};
