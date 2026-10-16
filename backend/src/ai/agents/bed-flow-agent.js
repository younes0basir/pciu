const { buildBedFlowContext } = require('../context/bed-flow-context-builder');
const { runStructuredAgent } = require('./run-agent');
const { assertAgentEnabled, getEffectiveAiSettings } = require('../../services/aiSettingsService');

const PROMPT_VERSION = 'bed-flow-v1';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggested_bed_id: { type: 'integer' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string' },
    alternatives: {
      type: 'array',
      items: { type: 'integer' },
    },
  },
  required: ['suggested_bed_id', 'confidence', 'rationale'],
};

const SYSTEM_PROMPT = `Recommend bed placement for an ED visit using only provided available beds.
Do not invent bed ids. French rationale.`;

async function recommendBedFlow(visitId) {
  const settings = await getEffectiveAiSettings();
  assertAgentEnabled(settings, 'bedFlow');
  const context = await buildBedFlowContext(visitId);
  return runStructuredAgent({
    agentType: 'bed_flow',
    visitId,
    taskProfile: 'bed_flow',
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: context,
    schema,
    schemaName: 'bed_flow_recommendation',
    recommendationType: 'bed_flow',
  });
}

module.exports = {
  recommendBedFlow,
};
