const {
  registerVisit,
  callVisit,
  placeVisit,
  startConsultation,
  updateConsultation,
  updateVisitPriority,
  closeVisit,
  returnVisit,
} = require('./visitService');

/**
 * Stable tool surface for future orchestrator / agents.
 * Uses the same visitService transactions and permissions as the HTTP API.
 */
function createVisitTools(actorUser, actionContext = {}) {
  const ctx = actionContext;
  return {
    register: (data) => registerVisit(data, actorUser, ctx),
    call: (visitId) => callVisit(visitId, actorUser, ctx),
    place: (visitId, bedId) => placeVisit(visitId, bedId, actorUser, ctx),
    start: (visitId, data) => startConsultation(visitId, actorUser, data, ctx),
    fill: (visitId, data) => updateConsultation(visitId, data, actorUser, ctx),
    triage: (visitId, data) => updateVisitPriority(visitId, data, actorUser, ctx),
    close: (visitId, data) => closeVisit(visitId, data, actorUser, ctx),
    return: (visitId, data) => returnVisit(visitId, data, actorUser, ctx),
  };
}

module.exports = { createVisitTools };
