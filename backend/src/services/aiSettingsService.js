const { query } = require('../config/db');
const { getAiEnvConfig, clampMode } = require('../config/aiEnv');

const DEFAULT_FLAGS = {
  documentation: false,
  triage: false,
  triageShadow: false,
  bedFlow: false,
  capacity: false,
};

async function ensureSettingsRow() {
  const flagsJson = JSON.stringify(DEFAULT_FLAGS);
  try {
    await query(
      `INSERT INTO service_ai_settings (id, mode, agent_flags, service_enabled)
       VALUES (1, 'disabled', $1::jsonb, false)
       ON CONFLICT (id) DO NOTHING`,
      [flagsJson],
    );
  } catch (error) {
    if (error.code !== '42703') throw error;
    await query(
      `INSERT INTO service_ai_settings (id, mode, agent_flags)
       VALUES (1, 'disabled', $1::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [flagsJson],
    );
  }
}

async function getServiceAiSettings() {
  await ensureSettingsRow();
  const result = await query('SELECT * FROM service_ai_settings WHERE id = 1');
  const row = result.rows[0];
  const agentFlags = { ...DEFAULT_FLAGS, ...(row.agent_flags || {}) };
  const serviceEnabled =
    row.service_enabled != null
      ? Boolean(row.service_enabled)
      : row.mode != null && row.mode !== 'disabled';
  return {
    mode: row.mode,
    serviceEnabled,
    agentFlags,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function resolveStoredMode(dbMode, envMaxMode) {
  let mode = dbMode === 'disabled' || dbMode == null ? 'collaborative' : dbMode;
  return clampMode(mode, envMaxMode);
}

function computeEffectiveMode(env, db) {
  if (!env.infraReady) return 'disabled';
  if (!db.serviceEnabled) return 'disabled';
  return resolveStoredMode(db.mode, env.maxMode);
}

async function getEffectiveAiSettings() {
  const env = getAiEnvConfig();
  const db = await getServiceAiSettings();
  const effectiveMode = computeEffectiveMode(env, db);
  return {
    platformEnabled: env.infraReady,
    platformKillSwitch: env.opsKillSwitch,
    chiefCanEnable: env.chiefCanEnable,
    envMaxMode: env.maxMode,
    envEnabledFlag: env.enabledFlag,
    serviceEnabled: db.serviceEnabled,
    requestedMode: db.mode,
    effectiveMode,
    agentFlags: db.agentFlags,
    updatedAt: db.updatedAt,
  };
}

async function patchServiceAiSettings(patch, actorUser) {
  const env = getAiEnvConfig();
  if (!env.infraReady) {
    throw {
      status: 503,
      message: env.opsKillSwitch
        ? 'IA coupée au niveau ops (AI_OPS_KILL_SWITCH).'
        : 'Infrastructure IA indisponible (clé NIM manquante ou AI_CHIEF_CAN_ENABLE=false).',
    };
  }

  const current = await getServiceAiSettings();
  let nextServiceEnabled =
    patch.serviceEnabled != null ? Boolean(patch.serviceEnabled) : current.serviceEnabled;
  let nextMode =
    patch.mode != null ? clampMode(patch.mode, env.maxMode) : current.mode;
  const nextFlags =
    patch.agentFlags != null
      ? { ...current.agentFlags, ...patch.agentFlags }
      : current.agentFlags;

  if (patch.serviceEnabled === true && nextMode === 'disabled') {
    nextMode = clampMode('collaborative', env.maxMode);
  }

  if (patch.mode != null && patch.mode !== 'disabled') {
    nextServiceEnabled = true;
  }

  if (patch.agentFlags != null && Object.values(patch.agentFlags).some(Boolean)) {
    nextServiceEnabled = true;
    if (nextMode === 'disabled') {
      nextMode = clampMode('collaborative', env.maxMode);
    }
  }

  let modeToSave = nextMode === 'disabled' ? clampMode('collaborative', env.maxMode) : nextMode;
  if (!nextServiceEnabled) {
    modeToSave = 'disabled';
  }

  const flagsJson = JSON.stringify(nextFlags);
  const reviewerId = actorUser?.id ?? null;

  const result = await query(
    `UPDATE service_ai_settings
     SET mode = $1,
         agent_flags = $2::jsonb,
         service_enabled = $3,
         updated_by = $4,
         updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [modeToSave, flagsJson, nextServiceEnabled, reviewerId],
  );

  if (result.rowCount === 0) {
    throw { status: 500, message: 'Réglages IA introuvables (service_ai_settings).' };
  }

  return getEffectiveAiSettingsFromRow(result.rows[0], env);
}

function getEffectiveAiSettingsFromRow(row, env = getAiEnvConfig()) {
  const agentFlags = { ...DEFAULT_FLAGS, ...(row.agent_flags || {}) };
  const db = {
    mode: row.mode,
    serviceEnabled:
      row.service_enabled != null
        ? Boolean(row.service_enabled)
        : row.mode != null && row.mode !== 'disabled',
  };
  const requestedMode =
    db.serviceEnabled && (row.mode === 'disabled' || row.mode == null)
      ? resolveStoredMode(row.mode, env.maxMode)
      : row.mode;
  return {
    platformEnabled: env.infraReady,
    platformKillSwitch: env.opsKillSwitch,
    chiefCanEnable: env.chiefCanEnable,
    envMaxMode: env.maxMode,
    envEnabledFlag: env.enabledFlag,
    serviceEnabled: db.serviceEnabled,
    requestedMode,
    effectiveMode: computeEffectiveMode(env, db),
    agentFlags,
    updatedAt: row.updated_at,
  };
}

const AGENT_LABELS = {
  documentation: 'Documentation',
  triage: 'Triage',
  triageShadow: 'Triage shadow',
  bedFlow: 'Routage lits',
  capacity: 'Charge',
};

function assertAgentEnabled(settings, flagKey) {
  if (!settings.platformEnabled) {
    throw {
      status: 503,
      message: 'Infrastructure IA indisponible (clé NIM ou configuration serveur).',
    };
  }
  if (!settings.serviceEnabled || settings.effectiveMode === 'disabled') {
    throw {
      status: 503,
      message:
        'Assistance IA désactivée pour le service. Le chef de service doit l’activer dans l’onglet « Mode IA ».',
    };
  }
  if (!settings.agentFlags[flagKey]) {
    const label = AGENT_LABELS[flagKey] || flagKey;
    throw {
      status: 403,
      message: `Agent « ${label} » non activé. Cochez-le dans l’onglet « Mode IA » (dashboard chef).`,
    };
  }
}

function describeAgentAvailability(settings, flagKey) {
  if (!settings.platformEnabled) {
    return 'Infrastructure IA indisponible.';
  }
  if (!settings.serviceEnabled || settings.effectiveMode === 'disabled') {
    return 'Activez « Assistance IA sur le service » dans Mode IA (chef).';
  }
  if (!settings.agentFlags[flagKey]) {
    const label = AGENT_LABELS[flagKey] || flagKey;
    return `Activez l’agent « ${label} » dans Mode IA (chef).`;
  }
  return null;
}

module.exports = {
  getServiceAiSettings,
  getEffectiveAiSettings,
  patchServiceAiSettings,
  assertAgentEnabled,
  describeAgentAvailability,
};
