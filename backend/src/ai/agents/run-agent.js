const nim = require('../providers/nim/nim.provider');
const { createRun, completeRun } = require('../observability/ai-audit');
const { proposeRecommendation } = require('../actions/action-gateway');
const { getEffectiveAiSettings } = require('../../services/aiSettingsService');
const { resolveModel } = require('../models/model-router');

async function runStructuredAgent({
  agentType,
  visitId,
  taskProfile,
  promptVersion,
  systemPrompt,
  userPayload,
  schema,
  schemaName,
  recommendationType,
}) {
  const settings = await getEffectiveAiSettings();
  const model = resolveModel(taskProfile);
  const started = Date.now();
  const run = await createRun({
    agentType,
    visitId,
    mode: settings.effectiveMode,
    modelId: model,
    promptVersion,
  });

  try {
    const { parsed, usage } = await nim.structured(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      schema,
      { schemaName, model },
    );

    const recommendation = await proposeRecommendation({
      agentRunId: run.id,
      visitId,
      recommendationType,
      payload: parsed,
      confidence: parsed.confidence ?? null,
    });

    await completeRun(run.id, {
      status: 'completed',
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      latencyMs: Date.now() - started,
    });

    return { runId: run.id, recommendation, output: parsed };
  } catch (error) {
    await completeRun(run.id, {
      status: 'failed',
      latencyMs: Date.now() - started,
      errorCode: error.code || 'AGENT_ERROR',
    });
    throw error;
  }
}

module.exports = {
  runStructuredAgent,
};
