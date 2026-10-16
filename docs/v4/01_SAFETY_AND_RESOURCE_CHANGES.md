# Phase 1 — Sécurité des états et ressources

## Modifications

| Fichier | Changement |
|---------|------------|
| `backend/src/services/resourceService.js` | `assertBedAssignable` refuse tout état ≠ `ready` ; `releaseBedToTurnover` → `cleaning` ; `confirmBedReady` |
| `backend/src/services/visitService.js` | Clôture/retour → turnover ; enregistrement `registration_priority` ; triage patch → `clinical_priority_validated_at` |
| `backend/src/services/careService.js` | `completeVisit` → turnover |
| `backend/src/services/triageService.js` | Validation clinique horodatée |
| `backend/migrations/20261014_v4_smart_workflow_foundation.sql` | Colonnes priorité + vues + tables workflow |
| `backend/src/routes/careRoutes.js` | `POST /care/resources/:bedId/confirm-ready` |
| Frontend | `PriorityBadge` « Non validé », confirm prêt sur lits en nettoyage |

## Tests exécutés

```bash
cd backend && npm run migrate:v4 && npm run test:v4
```

Résultat : **2/2 pass** (`assertBedAssignable` refuse `cleaning`, `releaseBedToTurnover` → `cleaning`).

## Rollback

- Revenir aux versions git des services listés.
- Migration additive : ne pas supprimer les colonnes en prod sans fenêtre planifiée ; les anciennes versions du code ignorent les nouvelles colonnes.
