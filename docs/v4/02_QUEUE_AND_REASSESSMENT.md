# Phase 2 — Files et réévaluation

## Comportement

- File « À réévaluer » : patients avec **`clinical_priority_validated_at` non null** et dernier `triage_assessments` au-delà du seuil (défaut 60 min, min 15).
- Paramètre : table `workflow_settings` clé `reassessment_interval_minutes`.
- API : `GET /api/workflow/settings/reassessment-minutes`, `PUT` (chief/admin).
- Worklists enrichies : `registrationPriority`, `priorityValidated`, `displayPriority` via `queueService` + `visitPriority.js`.

## Tests

- Couverts indirectement par cohérence SQL ; pas de test E2E automatisé file réévaluation (à ajouter).
