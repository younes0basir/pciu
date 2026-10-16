const { buildCapacityContext } = require('../context/capacity-context-builder');
const { runStructuredAgent } = require('./run-agent');
const { assertAgentEnabled, getEffectiveAiSettings } = require('../../services/aiSettingsService');

const PROMPT_VERSION = 'capacity-v1';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['level', 'message'],
      },
    },
    suggested_actions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'signals'],
};

const SYSTEM_PROMPT = `Analyze emergency department load from aggregated metrics.
Do not change clinical priorities. Operational suggestions only. French output.`;

async function analyzeCapacity() {
  const settings = await getEffectiveAiSettings();
  assertAgentEnabled(settings, 'capacity');
  const context = await buildCapacityContext();
  return runStructuredAgent({
    agentType: 'capacity',
    visitId: null,
    taskProfile: 'capacity',
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: context,
    schema,
    schemaName: 'capacity_analysis',
    recommendationType: 'capacity',
  });
}

module.exports = {
  analyzeCapacity,
};
