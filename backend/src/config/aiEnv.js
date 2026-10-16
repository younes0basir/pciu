const AI_MODES = ['disabled', 'collaborative', 'supervised_autonomy', 'full_control_simulation'];

const MODE_RANK = {
  disabled: 0,
  collaborative: 1,
  supervised_autonomy: 2,
  full_control_simulation: 3,
};

function parseBool(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseMode(value, fallback = 'disabled') {
  const mode = String(value ?? fallback).trim();
  return AI_MODES.includes(mode) ? mode : fallback;
}

function normalizeEnvModeToken(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

/** Env AI_MODE = plafond maximal (pas le mode actif du service). */
function resolveMaxMode(apiKey, chiefCanEnable) {
  const token = normalizeEnvModeToken(process.env.AI_MODE);
  const hasKey = Boolean(String(apiKey || '').trim());

  if (token === 'enabled' || token === 'true' || token === 'on' || token === 'yes') {
    return 'collaborative';
  }

  if (token === '' || token === 'disabled' || token === 'false' || token === 'off' || token === 'no') {
    if (chiefCanEnable && hasKey) {
      return 'collaborative';
    }
    return 'disabled';
  }

  const parsed = parseMode(process.env.AI_MODE, '');
  if (!AI_MODES.includes(parsed) || parsed === 'disabled') {
    if (chiefCanEnable && hasKey) {
      return 'collaborative';
    }
    return 'disabled';
  }
  return parsed;
}

function getAiEnvConfig() {
  const apiKey = (process.env.NVIDIA_API_KEY || '').trim();
  const chiefCanEnable = parseBool(process.env.AI_CHIEF_CAN_ENABLE, true);
  const opsKillSwitch = parseBool(process.env.AI_OPS_KILL_SWITCH, false);
  const enabledFlag = parseBool(process.env.AI_ENABLED, false);
  const maxMode = resolveMaxMode(apiKey, chiefCanEnable);
  const baseUrl = (process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const timeoutMs = Math.max(1000, Number(process.env.AI_TIMEOUT_MS) || 20000);
  const maxRetries = Math.max(0, Math.min(3, Number(process.env.AI_MAX_RETRIES) || 1));

  const infraReady =
    !opsKillSwitch &&
    Boolean(apiKey) &&
    (enabledFlag || chiefCanEnable);

  return {
    enabled: infraReady,
    enabledFlag,
    chiefCanEnable,
    opsKillSwitch,
    infraReady,
    maxMode,
    baseUrl,
    apiKey,
    models: {
      fast:
        process.env.AI_FAST_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b',
      reasoning:
        process.env.AI_REASONING_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b',
      embedding:
        process.env.AI_EMBEDDING_MODEL || 'nvidia/nv-embedqa-e5-v5',
    },
    timeoutMs,
    maxRetries,
    circuitBreaker: {
      failureThreshold: Math.max(2, Number(process.env.AI_CB_FAILURE_THRESHOLD) || 5),
      cooldownMs: Math.max(5000, Number(process.env.AI_CB_COOLDOWN_MS) || 60000),
    },
  };
}

function isModeAtMost(mode, ceiling) {
  return (MODE_RANK[mode] ?? 0) <= (MODE_RANK[ceiling] ?? 0);
}

function clampMode(requested, ceiling) {
  const req = parseMode(requested, 'disabled');
  const cap = parseMode(ceiling, 'disabled');
  return isModeAtMost(req, cap) ? req : cap;
}

module.exports = {
  AI_MODES,
  MODE_RANK,
  getAiEnvConfig,
  parseMode,
  isModeAtMost,
  clampMode,
};
