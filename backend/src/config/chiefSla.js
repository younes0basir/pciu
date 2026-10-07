function readMinutes(envKey, fallback) {
  const raw = process.env[envKey];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CHIEF_SLA = {
  uncalledWaitingMinutes: readMinutes('CHIEF_SLA_UNCALLED_WAITING', 20),
  calledWaitingMinutes: readMinutes('CHIEF_SLA_CALLED_WAITING', 15),
  placedWithoutStartMinutes: readMinutes('CHIEF_SLA_PLACED_WITHOUT_START', 30),
  inTreatmentMinutes: readMinutes('CHIEF_SLA_IN_TREATMENT', 60),
};

const STUCK_LABELS = {
  long_wait_uncalled: 'Attente prolongée (non appelé)',
  called_no_bed: 'Appelé sans mise au lit',
  placed_no_start: 'Au lit sans consultation',
  long_treatment: 'Prise en charge prolongée',
};

function pipelineStageFor(visit) {
  if (visit.status === 'waiting') {
    return visit.callCount > 0 && visit.lastCalledAt ? 'waitingCalled' : 'waitingUncalled';
  }
  if (visit.status === 'placed') return 'placed';
  if (visit.status === 'in_treatment') return 'inTreatment';
  return visit.status;
}

function applyStuckFlags(visit, sla = CHIEF_SLA) {
  let stuckKind = null;
  let stuckLevel = 'none';

  if (visit.status === 'waiting') {
    if (visit.callCount > 0 && visit.lastCalledAt) {
      if (visit.minutesInStep >= sla.calledWaitingMinutes) {
        stuckKind = 'called_no_bed';
        stuckLevel =
          visit.minutesInStep >= sla.calledWaitingMinutes * 2 ? 'critical' : 'warning';
      }
    } else if (visit.minutesSinceArrival >= sla.uncalledWaitingMinutes) {
      stuckKind = 'long_wait_uncalled';
      stuckLevel =
        visit.minutesSinceArrival >= sla.uncalledWaitingMinutes * 2 ? 'critical' : 'warning';
    }
  } else if (visit.status === 'placed') {
    if (visit.minutesInStep >= sla.placedWithoutStartMinutes) {
      stuckKind = 'placed_no_start';
      stuckLevel =
        visit.minutesInStep >= sla.placedWithoutStartMinutes * 2 ? 'critical' : 'warning';
    }
  } else if (visit.status === 'in_treatment') {
    if (visit.minutesInStep >= sla.inTreatmentMinutes) {
      stuckKind = 'long_treatment';
      stuckLevel = visit.minutesInStep >= sla.inTreatmentMinutes * 2 ? 'critical' : 'warning';
    }
  }

  return {
    ...visit,
    pipelineStage: pipelineStageFor(visit),
    stuckKind,
    stuckLevel,
    stuckLabel: stuckKind ? STUCK_LABELS[stuckKind] : null,
  };
}

module.exports = {
  CHIEF_SLA,
  STUCK_LABELS,
  applyStuckFlags,
  pipelineStageFor,
};
