const { getReassessmentIntervalMinutes, getSetting } = require('./workflowSettingsService');

const RULES_KEY = 'supervision_rules_v1';

const DEFAULT_RULES = {
  rulesVersion: 'v4-supervision-draft',
  reassessment: { enabled: true, source: 'reassessment_interval_minutes' },
  triage_pending_delay: { enabled: false, minutes: null, approved: false },
  care_wait_delay: { enabled: false, minutes: null, approved: false },
  exam_pending_delay: { enabled: false, minutes: null, approved: false },
  disposition_delay: { enabled: false, minutes: null, approved: false },
  bed_turnover_delay: { enabled: false, minutes: null, approved: false },
  capacity_pressure: {
    enabled: true,
    approved: false,
    note: 'Heuristique capacité — validation CHU requise avant pilotage SLA',
  },
};

async function getEffectiveRules() {
  const stored = await getSetting(RULES_KEY);
  const base =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? { ...DEFAULT_RULES, ...stored }
      : { ...DEFAULT_RULES };

  const reassessmentMinutes = await getReassessmentIntervalMinutes();

  return {
    ...base,
    reassessmentIntervalMinutes: reassessmentMinutes,
    generatedAt: new Date().toISOString(),
  };
}

function ruleConfigured(rule) {
  if (!rule || !rule.enabled) return false;
  if (rule.approved === false && rule.minutes != null) return false;
  if (rule.minutes != null && Number(rule.minutes) > 0) return true;
  return rule.enabled && rule.approved === true;
}

function minutesSince(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Math.max(0, Math.round((now.getTime() - t.getTime()) / 60000));
}

module.exports = {
  RULES_KEY,
  DEFAULT_RULES,
  getEffectiveRules,
  ruleConfigured,
  minutesSince,
};
