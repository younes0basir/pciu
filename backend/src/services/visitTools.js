const {
  registerVisit,
  callVisit,
  placeVisit,
  startConsultation,
  updateConsultation,
  closeVisit,
  returnVisit,
} = require('./visitService');
const { recordTriage } = require('./triageService');
const { transferResource } = require('./resourceService');

/**
 * Stable tool surface for orchestrator / AI Action Gateway.
 * Same domain services as the HTTP API — see docs/AGENT-VISIT-TOOLS.md.
 */
function createVisitTools(actorUser, actionContext = {}) {
  const ctx = actionContext;
  return {
    register: (data) => registerVisit(data, actorUser, ctx),
    call: (visitId) => callVisit(visitId, actorUser, ctx),
    place: (visitId, bedId) => placeVisit(visitId, bedId, actorUser, ctx),
    start: (visitId, data) => startConsultation(visitId, actorUser, data, ctx),
    fill: (visitId, data) => updateConsultation(visitId, data, actorUser, ctx),
    triage: (visitId, data) => recordTriage(visitId, data, actorUser, ctx),
    transfer: (visitId, bedId) => transferResource(visitId, bedId, actorUser, ctx),
    close: (visitId, data) => closeVisit(visitId, data, actorUser, ctx),
    return: (visitId, data) => returnVisit(visitId, data, actorUser, ctx),
  };
}

module.exports = { createVisitTools };
