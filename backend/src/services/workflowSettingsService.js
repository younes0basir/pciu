const { query } = require('../config/db');

const DEFAULTS = {
  reassessment_interval_minutes: 60,
};

async function getSetting(key) {
  try {
    const res = await query(`SELECT value_json FROM workflow_settings WHERE key = $1`, [key]);
    if (res.rowCount === 0) return DEFAULTS[key] ?? null;
    const raw = res.rows[0].value_json;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') return raw;
    return raw;
  } catch {
    return DEFAULTS[key] ?? null;
  }
}

async function getReassessmentIntervalMinutes() {
  const value = await getSetting('reassessment_interval_minutes');
  const n = Number(value);
  return Number.isFinite(n) && n >= 15 ? n : DEFAULTS.reassessment_interval_minutes;
}

async function updateSetting(key, valueJson, actorUser) {
  const res = await query(
    `INSERT INTO workflow_settings (key, value_json, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value_json = EXCLUDED.value_json,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING key, value_json, updated_at`,
    [key, JSON.stringify(valueJson), actorUser?.id || null],
  );
  return res.rows[0];
}

module.exports = {
  getReassessmentIntervalMinutes,
  getSetting,
  updateSetting,
  DEFAULTS,
};
