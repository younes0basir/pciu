const { getAiEnvConfig } = require('../../../config/aiEnv');

function redactForLog(text) {
  return String(text ?? '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
}

async function nimRequest(path, options = {}) {
  const config = getAiEnvConfig();
  if (!config.enabled) {
    const err = new Error('AI platform disabled');
    err.code = 'AI_DISABLED';
    throw err;
  }
  if (!config.apiKey) {
    const err = new Error('NVIDIA API key not configured');
    err.code = 'AI_MISCONFIGURED';
    throw err;
  }

  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const bodyText = await response.text();
    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = { raw: bodyText.slice(0, 500) };
    }

    if (!response.ok) {
      const err = new Error(
        body?.error?.message || body?.detail || `NIM HTTP ${response.status}`,
      );
      err.code = 'NIM_HTTP_ERROR';
      err.upstreamStatus = response.status;
      err.nimBody = redactForLog(JSON.stringify(body)).slice(0, 400);
      throw err;
    }

    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('NIM request timeout');
      err.code = 'NIM_TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  nimRequest,
  redactForLog,
};
