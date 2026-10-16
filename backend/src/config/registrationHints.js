/**
 * Règles opérationnelles d'aide à l'enregistrement (non diagnostiques).
 * Revue CHU requise avant extension de la liste de mots-clés.
 */
const HINTS_VERSION = 'v1-accueil-draft';

const CRITICAL_KEYWORD_PATTERNS = [
  { pattern: /arr[êe]t\s+cardiaque|acr|massage\s+cardiaque/i, id: 'kw_cardiac_arrest' },
  { pattern: /d[ée]tresse\s+respiratoire|d[ée]ficit\s+respiratoire|saturation\s+basse/i, id: 'kw_resp_distress' },
  { pattern: /h[ée]morragie\s+massive|h[ée]mat[ée]mese\s+abondante/i, id: 'kw_major_bleeding' },
  { pattern: /inconscient|gc\s*[<≤]\s*8|coma/i, id: 'kw_unconscious' },
  { pattern: /convulsion\s+en\s+cours|status\s+epilepticus/i, id: 'kw_seizure' },
];

const URGENT_ARRIVAL_MODES = ['Ambulance', 'Brancard'];

function buildRegistrationHints({ chiefComplaint = '', arrivalMode = '', registrationPriority = null } = {}) {
  const suggestions = [];
  const complaint = String(chiefComplaint || '').trim();
  const mode = String(arrivalMode || '').trim();
  const priority = registrationPriority != null ? Number(registrationPriority) : null;

  if (URGENT_ARRIVAL_MODES.includes(mode)) {
    suggestions.push({
      type: 'arrival_mode',
      severity: 'info',
      message:
        'Arrivée par transport médicalisé — vérifier le signalement critique et orienter vers le triage sans délai.',
      evidence: { arrivalMode: mode },
    });
  }

  for (const rule of CRITICAL_KEYWORD_PATTERNS) {
    if (complaint && rule.pattern.test(complaint)) {
      suggestions.push({
        type: 'complaint_keyword',
        severity: 'warning',
        message:
          'Motif compatible avec un circuit critique — envisager la case « danger immédiat » ; le triage infirmier reste obligatoire.',
        evidence: { ruleId: rule.id },
      });
      break;
    }
  }

  if (priority != null && priority <= 2 && !complaint) {
    suggestions.push({
      type: 'high_priority_no_complaint',
      severity: 'info',
      message: 'Signalement P1/P2 sans motif saisi — compléter le motif principal avant validation.',
      evidence: { registrationPriority: priority },
    });
  }

  if (priority != null && priority <= 2) {
    suggestions.push({
      type: 'registration_priority_high',
      severity: 'info',
      message:
        'Signalement accueil élevé — ce n’est pas une priorité clinique validée ; l’infirmier de triage confirmera P1–P5.',
      evidence: { registrationPriority: priority },
    });
  }

  return {
    hintsVersion: HINTS_VERSION,
    suggestions,
  };
}

module.exports = {
  HINTS_VERSION,
  buildRegistrationHints,
  CRITICAL_KEYWORD_PATTERNS,
};
