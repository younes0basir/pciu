const { runStructuredAgent } = require('./run-agent');
const { assertAgentEnabled, getEffectiveAiSettings } = require('../../services/aiSettingsService');

const PROMPT_VERSION = 'pipeline-placement-v2';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    placements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          visit_id: { type: 'integer' },
          bed_id: { type: 'integer' },
          rationale: { type: 'string' },
        },
        required: ['visit_id', 'bed_id', 'rationale'],
      },
    },
  },
  required: ['summary', 'placements'],
};

const SYSTEM_PROMPT = `Tu proposes l'affectation aux lits d'un service d'urgences.
Règles obligatoires :
- L'ordre de file est fixe. N1 est placé avant N2, N2 avant N3. Tu ne sautes aucun patient.
- Tu places exactement les patients dont le rang est <= slots, et personne d'autre.
- Chaque lit est utilisé au plus une fois. Utilise uniquement les bedId fournis.
- Les patients au-delà de slots restent en attente. Le premier d'entre eux devient le nouveau N1.
- Chaque lit fourni appartient à une salle qui a déjà un médecin et au moins un infirmier. N'utilise aucun autre lit.
- Choisis le lit selon l'orientation et la zone (critique/SAUV, ambulatoire, surveillance).
- summary et rationale en français, courts, sans inventer de données.`;

async function recommendPipelinePlacement(context) {
  const settings = await getEffectiveAiSettings();
  assertAgentEnabled(settings, 'bedFlow');
  return runStructuredAgent({
    agentType: 'bed_flow_pipeline',
    visitId: null,
    taskProfile: 'bed_flow',
    promptVersion: PROMPT_VERSION,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: context,
    schema,
    schemaName: 'pipeline_placement',
    recommendationType: 'bed_flow_pipeline',
  });
}

module.exports = {
  recommendPipelinePlacement,
};
