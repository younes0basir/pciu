const ROLE_CAPABILITIES = {
  receptionist: ['register', 'call'],
  nurse: ['place', 'return', 'start', 'fill', 'close', 'triage'],
  doctor: ['start', 'close', 'fill'],
  chief: ['register', 'call', 'place', 'start', 'return', 'close', 'fill'],
  admin: ['manage_users'],
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
