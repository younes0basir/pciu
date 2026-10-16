const { getAiEnvConfig } = require('../../../config/aiEnv');
const { nimRequest } = require('./nim.client');

const metrics = {
  requests: 0,
  failures: 0,
  lastError: null,
  lastLatencyMs: null,
  circuitOpenUntil: 0,
  consecutiveFailures: 0,
};

function assertCircuit() {
  if (Date.now() < metrics.circuitOpenUntil) {
    const err = new Error('NIM circuit breaker open');
    err.code = 'NIM_CIRCUIT_OPEN';
    throw err;
  }
}

function recordSuccess(latencyMs) {
  metrics.requests += 1;
  metrics.consecutiveFailures = 0;
  metrics.lastLatencyMs = latencyMs;
}

function recordFailure(error) {
  metrics.requests += 1;
  metrics.failures += 1;
  metrics.consecutiveFailures += 1;
  metrics.lastError = {
    code: error.code || 'UNKNOWN',
    message: String(error.message || error).slice(0, 200),
    at: new Date().toISOString(),
  };
  const config = getAiEnvConfig();
  if (metrics.consecutiveFailures >= config.circuitBreaker.failureThreshold) {
    metrics.circuitOpenUntil = Date.now() + config.circuitBreaker.cooldownMs;
    metrics.consecutiveFailures = 0;
  }
}

async function withRetry(fn) {
  const config = getAiEnvConfig();
  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      assertCircuit();
      const started = Date.now();
      const result = await fn();
      recordSuccess(Date.now() - started);
      return result;
    } catch (error) {
      lastError = error;
      if (error.code === 'AI_DISABLED' || error.code === 'AI_MISCONFIGURED') {
        throw error;
      }
      recordFailure(error);
      if (attempt >= config.maxRetries) break;
    }
  }
  throw lastError;
}

async function health() {
  const config = getAiEnvConfig();
  if (!config.enabled) {
    return { status: 'disabled', platformEnabled: false };
  }
  if (!config.apiKey) {
    return { status: 'misconfigured', platformEnabled: true, reason: 'missing_api_key' };
  }
  try {
    await withRetry(() => nimRequest('/models', { method: 'GET' }));
    return {
      status: 'ok',
      platformEnabled: true,
      metrics: getMetrics(),
    };
  } catch (error) {
    return {
      status: 'error',
      platformEnabled: true,
      error: { code: error.code, message: error.message },
      metrics: getMetrics(),
    };
  }
}

function messageTextContent(message) {
  const raw = message?.content;
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return '';
}

function thinkingKwargsForModel(modelId, enableThinking) {
  if (enableThinking) return {};
  const id = String(modelId || '');
  if (!/nemotron|nano|reasoning/i.test(id)) return {};
  return { chat_template_kwargs: { enable_thinking: false } };
}

async function chat(messages, { model, temperature = 0.2, maxTokens = 1024, enableThinking } = {}) {
  const config = getAiEnvConfig();
  const resolvedModel = model || config.models.reasoning;
  const body = {
    model: resolvedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...thinkingKwargsForModel(resolvedModel, enableThinking),
  };
  return withRetry(() =>
    nimRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

async function structured(messages, jsonSchema, options = {}) {
  const schemaName = options.schemaName || 'structured_output';
  const config = getAiEnvConfig();
  const model = options.model || config.models.reasoning;
  const enableThinking = options.enableThinking === true;
  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 2048,
    ...thinkingKwargsForModel(model, enableThinking),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        schema: jsonSchema,
        strict: true,
      },
    },
  };
  const response = await withRetry(() =>
    nimRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
  const content = messageTextContent(response?.choices?.[0]?.message);
  if (!content) {
    const err = new Error('Empty structured response from NIM (reasoning may have consumed the token budget).');
    err.code = 'NIM_EMPTY_STRUCTURED';
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    const err = new Error('Invalid JSON in NIM structured response.');
    err.code = 'NIM_INVALID_JSON';
    err.cause = parseError;
    throw err;
  }
  return {
    parsed,
    usage: response.usage,
    model: response.model,
  };
}

async function embed(input, { model } = {}) {
  const config = getAiEnvConfig();
  const body = {
    model: model || config.models.embedding,
    input,
  };
  return withRetry(() =>
    nimRequest('/embeddings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

function getMetrics() {
  return { ...metrics };
}

module.exports = {
  health,
  chat,
  structured,
  embed,
  getMetrics,
};
