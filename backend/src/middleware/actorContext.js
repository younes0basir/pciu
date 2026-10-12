const { normalizeActionContext } = require('../services/visitEventService');

function attachActorContext(req, _res, next) {
  const headerActorType = req.headers['x-actor-type'];
  const headerAgentRunId = req.headers['x-agent-run-id'];
  const headerIdempotencyKey = req.headers['idempotency-key'];

  req.actionContext = normalizeActionContext({
    actorType: headerActorType,
    agentRunId: headerAgentRunId,
    idempotencyKey: headerIdempotencyKey,
  });

  next();
}

function getActionContext(req) {
  return req.actionContext ?? normalizeActionContext({});
}

module.exports = {
  attachActorContext,
  getActionContext,
};
