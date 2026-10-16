const { withTransaction } = require('../config/db');
const { syncDeterministicAlerts } = require('./workflowOrchestratorService');
const { reconcileOperationalAlerts } = require('./operationalAlertService');

let evalInFlight = null;
let lastEvalAt = null;

async function evaluateOperationalAlerts() {
  if (evalInFlight) return evalInFlight;

  evalInFlight = (async () => {
    await withTransaction(async (client) => {
      await syncDeterministicAlerts(client);
      await reconcileOperationalAlerts(client);
    });
    lastEvalAt = new Date().toISOString();
  })().finally(() => {
    evalInFlight = null;
  });

  return evalInFlight;
}

function getLastAlertEvaluationAt() {
  return lastEvalAt;
}

module.exports = {
  evaluateOperationalAlerts,
  getLastAlertEvaluationAt,
};
