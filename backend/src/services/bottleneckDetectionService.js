const { getAllWorklists } = require('./queueService');
const { listResourcesWithStatus } = require('./resourceService');
const { buildMeta } = require('./supervisionProjectionService');
const { getEffectiveRules, ruleConfigured, minutesSince } = require('./supervisionRulesService');

function pushSignal(signals, partial) {
  signals.push({
    type: partial.type,
    scope: partial.scope || 'service',
    observedAt: new Date().toISOString(),
    window: partial.window || 'instant',
    numerator: partial.numerator ?? null,
    denominator: partial.denominator ?? null,
    evidence: partial.evidence || {},
    ruleVersion: partial.ruleVersion || 'v4-supervision-draft',
    dataQuality: partial.dataQuality || 'current',
    suggestedOperationalAction: partial.suggestedOperationalAction || null,
    message: partial.message,
  });
}

async function detectBottlenecks({ zoneName = null } = {}) {
  const [worklists, resources, rules] = await Promise.all([
    getAllWorklists(),
    listResourcesWithStatus(),
    getEffectiveRules(),
  ]);

  const filterZone = (rows) => {
    if (!zoneName || zoneName === 'all') return rows;
    return rows.filter((r) => r.zoneName === zoneName);
  };

  const signals = [];
  const now = new Date();

  const triage = filterZone(worklists.triage);
  const care = filterZone(worklists.care);
  const disposition = filterZone(worklists.disposition);
  const exams = filterZone(worklists.exams);

  if (triage.length >= 3) {
    pushSignal(signals, {
      type: 'stage_backlog',
      scope: 'triage',
      numerator: triage.length,
      message: `${triage.length} patient(s) en attente de triage.`,
      evidence: { stage: 'triage', count: triage.length },
      suggestedOperationalAction: 'OPEN_TRIAGE_QUEUE',
    });
  }

  if (care.length >= 3) {
    const readyBeds = resources.filter(
      (b) => b.operationalStatus === 'ready' && !b.occupied && b.isActive !== false,
    ).length;
    pushSignal(signals, {
      type: 'care_wait_pressure',
      scope: 'care',
      numerator: care.length,
      denominator: readyBeds,
      message:
        readyBeds > 0
          ? `${care.length} en attente de soins pour ${readyBeds} lit(s) prêt(s).`
          : `${care.length} en attente de soins — aucun lit prêt.`,
      evidence: { waitingCare: care.length, readyBeds },
      suggestedOperationalAction: readyBeds > 0 ? 'REVIEW_READY_BEDS' : 'OPEN_CAPACITY',
    });
  }

  if (disposition.length >= 2) {
    pushSignal(signals, {
      type: 'disposition_backlog',
      scope: 'disposition',
      numerator: disposition.length,
      message: `${disposition.length} disposition(s) en attente d'exécution.`,
      evidence: { count: disposition.length },
      suggestedOperationalAction: 'OPEN_DISPOSITION_QUEUE',
    });
  }

  if (exams.length >= 2) {
    pushSignal(signals, {
      type: 'exam_backlog',
      scope: 'exams',
      numerator: exams.length,
      message: `${exams.length} examen(s) en attente.`,
      evidence: { count: exams.length },
      suggestedOperationalAction: 'OPEN_EXAMS_QUEUE',
    });
  }

  const cleaningBeds = resources.filter((b) => b.operationalStatus === 'cleaning');
  if (cleaningBeds.length >= 2) {
    pushSignal(signals, {
      type: 'bed_turnover_stock',
      scope: 'capacity',
      numerator: cleaningBeds.length,
      message: `${cleaningBeds.length} lit(s) en nettoyage.`,
      evidence: { cleaningCount: cleaningBeds.length },
      suggestedOperationalAction: 'REVIEW_CLEANING_BEDS',
    });
  }

  if (ruleConfigured(rules.triage_pending_delay)) {
    const threshold = Number(rules.triage_pending_delay.minutes);
    const delayed = triage.filter((r) => minutesSince(r.arrivedAt, now) >= threshold);
    if (delayed.length > 0) {
      pushSignal(signals, {
        type: 'triage_pending_delay',
        scope: 'triage',
        numerator: delayed.length,
        denominator: triage.length,
        window: `${threshold}min`,
        message: `${delayed.length} patient(s) au-delà du seuil triage configuré (${threshold} min).`,
        evidence: { thresholdMinutes: threshold, delayed: delayed.length },
        ruleVersion: rules.rulesVersion,
      });
    }
  }

  if (signals.length === 0) {
    pushSignal(signals, {
      type: 'no_major_bottleneck',
      scope: 'service',
      message: 'Aucun goulot majeur détecté sur la fenêtre instantanée.',
      dataQuality: triage.length + care.length === 0 ? 'low_volume' : 'current',
    });
  }

  return {
    data: { signals, insufficientHistory: true },
    meta: buildMeta(),
  };
}

module.exports = {
  detectBottlenecks,
};
