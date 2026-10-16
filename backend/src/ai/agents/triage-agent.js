const path = require('path');
const fs = require('fs');
const { buildTriageContext } = require('../context/triage-context-builder');
const { runStructuredAgent } = require('./run-agent');
const { assertAgentEnabled, getEffectiveAiSettings } = require('../../services/aiSettingsService');

const PROMPT_VERSION = 'triage-v1';
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schemas/triage-recommendation.schema.json'), 'utf8'),
);

const SYSTEM_PROMPT = `You are a triage decision support assistant for emergency care.
Suggest priority 1 (most urgent) to 5 (least). Never replace human triage.
Highlight missing information and red flags. French clinical context.
Output must match the JSON schema.`;

async function recommendTriage(visitId, { shadow = false } = {}) {
  const settings = await getEffectiveAiSettings();
  if (shadow) {
    if (!settings.agentFlags.triageShadow && !settings.agentFlags.triage) {
      throw { status: 403, message: 'Triage shadow mode is not enabled.' };
    }
  } else {
    assertAgentEnabled(settings, 'triage');
  }
  const context = await buildTriageContext(visitId);
  return runStructuredAgent({
    agentType: shadow ? 'triage_shadow' : 'triage',
    visitId,
    taskProfile: 'triage',
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: context,
    schema,
    schemaName: 'triage_recommendation',
    recommendationType: 'triage',
  });
}

module.exports = {
  recommendTriage,
};
