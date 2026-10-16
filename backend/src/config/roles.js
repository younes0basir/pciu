const ROLE_CAPABILITIES = {
  receptionist: ['register', 'call', 'critical'],
  nurse: [
    'place',
    'return',
    'start',
    'fill',
    'close',
    'triage',
    'critical',
    'ai_documentation',
    'ai_triage_recommend',
    'ai_bed_flow',
  ],
  doctor: ['start', 'close', 'fill', 'ai_documentation', 'ai_triage_recommend'],
  chief: [
    'register',
    'call',
    'place',
    'start',
    'return',
    'close',
    'fill',
    'critical',
    'ai_health',
    'ai_settings',
    'ai_documentation',
    'ai_triage_recommend',
    'ai_bed_flow',
    'ai_capacity',
  ],
  admin: ['manage_users', 'ai_health', 'ai_settings'],
};

const ROLES = Object.keys(ROLE_CAPABILITIES);

function getCapabilities(role) {
  return ROLE_CAPABILITIES[role] || [];
}

function hasCapability(role, capability) {
  const caps = getCapabilities(role);
  return caps.includes(capability);
}

module.exports = {
  ROLES,
  ROLE_CAPABILITIES,
  getCapabilities,
  hasCapability,
};
