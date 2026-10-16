const { getAiEnvConfig, clampMode, parseMode } = require('../config/aiEnv');

process.env.AI_ENABLED = 'false';
process.env.AI_CHIEF_CAN_ENABLE = 'false';
process.env.NVIDIA_API_KEY = '';
process.env.AI_MODE = 'collaborative';
const disabled = getAiEnvConfig();
if (disabled.infraReady !== false) throw new Error('infra should be off without key/chief');

process.env.AI_ENABLED = 'true';
process.env.AI_MODE = 'disabled';
const cfg = getAiEnvConfig();
if (cfg.maxMode !== 'disabled') throw new Error('default mode should be disabled');

if (clampMode('full_control_simulation', 'collaborative') !== 'collaborative') {
  throw new Error('clampMode failed');
}

if (parseMode('invalid', 'disabled') !== 'disabled') {
  throw new Error('parseMode fallback failed');
}

console.log('aiEnv tests ok');
