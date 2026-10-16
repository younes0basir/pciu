const { getEffectiveAiSettings } = require('../../services/aiSettingsService');
const { isVisitSimulationEligible } = require('./simulation-guard');

async function assertAiRouteAllowed(req, { visitId } = {}) {
  const settings = await getEffectiveAiSettings();
  if (settings.effectiveMode === 'full_control_simulation' && visitId != null) {
    const ok = await isVisitSimulationEligible(visitId);
    if (!ok) {
      throw {
        status: 403,
        message: 'Full control simulation is limited to demo visits.',
      };
    }
  }
  return settings;
}

module.exports = {
  assertAiRouteAllowed,
};
