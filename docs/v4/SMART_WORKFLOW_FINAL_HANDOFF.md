# PICU V4 Smart Emergency Workflow — passation

## Implémenté

1. **Turnover lits** : fin d’occupation → `cleaning` ; assignation uniquement si `ready` ; confirmation auditée (`resource_status_events`).
2. **Priorité** : `registration_priority` + `clinical_priority_validated_at` ; UI « Non validé ».
3. **Worklists** : métadonnées priorité ; réévaluation sans patients jamais triés.
4. **Coordination** : orchestrateur déterministe, alertes persistées, transferts en 2 temps, handoffs basiques.
5. **API** : préfixe `/api/workflow/*` + `confirm-ready` sous `/api/care`.

## Fichiers clés

- Migration : `backend/migrations/20261014_v4_smart_workflow_foundation.sql`
- Services : `resourceService`, `workflowOrchestratorService`, `operationalAlertService`, `transferRequestService`, `handoffService`
- Routes : `backend/src/routes/workflowRoutes.js`
- Tests : `backend/src/tests/v4-safety.test.js`
- Docs : `docs/v4/00` … `06`

## Non réalisé / validation CHU

- Règles P1–P5 officielles, SLA, protocole escalade vitale hors app.
- Suite de tests d’acceptation complète (15 scénarios backend + E2E frontend).
- Panneau supervision alertes ack/résolution dans l’UI chief.
- Enregistrement différé sans saisie (accueil exige encore motif + priorité signal).

## Démonstration suggérée

1. Enregistrer patient → badge « Non validé ».
2. Triage infirmier → badge validé.
3. Placer, clôturer → lit en nettoyage → **Confirmer prêt** → lit assignable.
4. `GET /api/workflow/supervision` (chef) → recommandations + alertes.
