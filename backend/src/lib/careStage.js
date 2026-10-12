/** V3 care_stage values and legacy status sync (see docs/PROCESSUS-URGENCES-V3.md). */

const CARE_STAGES = [
  'registered',
  'triage_pending',
  'waiting_care',
  'in_care',
  'in_observation',
  'disposition_pending',
  'completed',
];

const TERMINAL_LEGACY_STATUSES = new Set([
  'discharged',
  'transferred',
  'left_without_seen',
  'left_before_seen',
  'left_during_care',
  'admitted',
  'other',
]);

const ACTIVE_LEGACY_STATUSES = new Set(['waiting', 'placed', 'in_treatment']);

const ORIENTATIONS = [
  'critical',
  'acute',
  'standard',
  'ambulatory',
  'observation',
  'isolation',
];

const V3_OUTCOMES = [
  'discharged',
  'admitted',
  'transferred',
  'left_before_seen',
  'left_during_care',
  'other',
];

/** Maps legacy `status` to V3 `care_stage` when backfilling. */
function careStageFromLegacyStatus(status) {
  if (status === 'waiting') return 'triage_pending';
  if (status === 'placed') return 'waiting_care';
  if (status === 'in_treatment') return 'in_care';
  if (TERMINAL_LEGACY_STATUSES.has(status)) return 'completed';
  return 'triage_pending';
}

/** Keep legacy status in sync when only care_stage changes (non-terminal). */
function legacyStatusFromCareStage(careStage, currentLegacyStatus) {
  if (careStage === 'completed') {
    return currentLegacyStatus;
  }
  if (careStage === 'in_care' || careStage === 'in_observation') {
    return 'in_treatment';
  }
  if (careStage === 'disposition_pending') {
    return currentLegacyStatus === 'in_treatment' ? 'in_treatment' : 'placed';
  }
  if (ACTIVE_LEGACY_STATUSES.has(currentLegacyStatus) && currentLegacyStatus !== 'waiting') {
    if (careStage === 'waiting_care' || careStage === 'triage_pending') {
      return currentLegacyStatus === 'placed' ? 'placed' : 'waiting';
    }
  }
  if (careStage === 'waiting_care' || careStage === 'triage_pending' || careStage === 'registered') {
    return currentLegacyStatus === 'placed' ? 'placed' : 'waiting';
  }
  return currentLegacyStatus;
}

const ALLOWED_TRANSITIONS = {
  registered: ['triage_pending', 'waiting_care', 'in_care'],
  triage_pending: ['waiting_care', 'in_care', 'completed'],
  waiting_care: ['in_care', 'in_observation', 'disposition_pending', 'completed'],
  in_care: ['in_observation', 'disposition_pending', 'completed', 'waiting_care'],
  in_observation: ['in_care', 'disposition_pending', 'completed', 'waiting_care'],
  disposition_pending: ['completed', 'in_care', 'in_observation'],
  completed: [],
};

function assertCareStageTransition(fromStage, toStage) {
  const from = fromStage || 'triage_pending';
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.includes(toStage)) {
    throw {
      status: 400,
      message: `Transition care_stage interdite : '${from}' → '${toStage}'.`,
    };
  }
}

function isActiveCareStage(careStage) {
  return careStage && careStage !== 'completed';
}

function mapCloseOutcomeToLegacyStatus(outcome) {
  if (outcome === 'left_before_seen') return 'left_without_seen';
  if (outcome === 'left_during_care') return 'left_without_seen';
  if (outcome === 'admitted') return 'discharged';
  return outcome;
}

module.exports = {
  CARE_STAGES,
  ORIENTATIONS,
  V3_OUTCOMES,
  TERMINAL_LEGACY_STATUSES,
  ACTIVE_LEGACY_STATUSES,
  careStageFromLegacyStatus,
  legacyStatusFromCareStage,
  assertCareStageTransition,
  isActiveCareStage,
  mapCloseOutcomeToLegacyStatus,
};
