const { getEffectiveAiSettings } = require('../../services/aiSettingsService');
const { generateDocumentationSummary } = require('../agents/documentation-agent');
const { recommendTriage } = require('../agents/triage-agent');
const { recommendBedFlow } = require('../agents/bed-flow-agent');
const { analyzeCapacity } = require('../agents/capacity-agent');
const { listRecommendations, getRunById } = require('../observability/ai-audit');
const { query } = require('../../config/db');

async function routeIntent({ intent, visitId }) {
  const settings = await getEffectiveAiSettings();
  if (settings.effectiveMode === 'disabled') {
    throw { status: 503, message: 'AI disabled.' };
  }

  switch (intent) {
    case 'documentation':
      return generateDocumentationSummary(visitId);
    case 'triage':
      return recommendTriage(visitId, { shadow: false });
    case 'bed_flow':
      return recommendBedFlow(visitId);
    case 'capacity':
      return analyzeCapacity();
    default:
      throw { status: 400, message: `Unknown intent: ${intent}` };
  }
}

async function synthesizeVisit(visitId) {
  const runs = await query(
    `SELECT * FROM agent_runs WHERE visit_id = $1 ORDER BY started_at DESC LIMIT 10`,
    [visitId],
  );
  const recommendations = await listRecommendations({ visitId, limit: 10 });
  return {
    visitId: Number(visitId),
    runs: runs.rows.map((r) => ({
      id: r.id,
      agentType: r.agent_type,
      status: r.status,
      startedAt: r.started_at,
    })),
    recommendations,
  };
}

async function getRunSummary(runId) {
  const run = await getRunById(runId);
  if (!run) throw { status: 404, message: 'Run not found.' };
  const recommendations = await query(
    `SELECT * FROM agent_recommendations WHERE agent_run_id = $1 ORDER BY created_at DESC`,
    [runId],
  );
  return { run, recommendations: recommendations.rows };
}

module.exports = {
  routeIntent,
  synthesizeVisit,
  getRunSummary,
};
