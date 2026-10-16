const { getChiefOverview } = require('../../services/chiefService');

async function buildCapacityContext() {
  const overview = await getChiefOverview();
  return {
    stats: overview.stats,
    pipeline: overview.pipeline,
    stuckAlerts: (overview.stuckAlerts || []).slice(0, 25),
    timestamp: overview.timestamp,
  };
}

module.exports = {
  buildCapacityContext,
};
