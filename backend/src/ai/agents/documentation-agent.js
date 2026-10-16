const path = require('path');
const fs = require('fs');
const { buildDocumentationContext } = require('../context/documentation-context-builder');
const { runStructuredAgent } = require('./run-agent');
const { assertAgentEnabled, getEffectiveAiSettings } = require('../../services/aiSettingsService');

const PROMPT_VERSION = 'documentation-v1';
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schemas/documentation-summary.schema.json'), 'utf8'),
);

const SYSTEM_PROMPT = `You are a clinical documentation assistant for an emergency department.
Produce a draft summary only. Do not state definitive diagnoses.
Use cautious language. Output must match the JSON schema.
Language: French.`;

async function generateDocumentationSummary(visitId) {
  const settings = await getEffectiveAiSettings();
  assertAgentEnabled(settings, 'documentation');
  const context = await buildDocumentationContext(visitId);
  return runStructuredAgent({
    agentType: 'documentation',
    visitId,
    taskProfile: 'documentation',
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: context,
    schema,
    schemaName: 'documentation_summary',
    recommendationType: 'documentation',
  });
}

module.exports = {
  generateDocumentationSummary,
};
