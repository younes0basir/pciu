# Phase 6 — Validation

## Preuves

| Critère | Statut |
|---------|--------|
| Lit `cleaning` non assignable | OK — test `v4-safety.test.js` |
| Turnover → `cleaning` | OK — test + code clôture/transfert |
| Remise `ready` explicite | OK — `confirmBedReady` + UI |
| Priorité clinique non auto-modifiée | OK — réévaluation = liste seulement |
| Migration additive appliquée | OK — `npm run migrate:v4` (env dev Neon local `.env`) |
| Rôles RBAC préservés | OK — pas de changement matrice |

## Non exécuté / limites

- Tests 3–15 du cahier maître (concurrence multi-utilisateur, 401/403 E2E, handoff E2E).
- Validation clinique seuils P1–P5 et intervalle réévaluation par le CHU.
- Déploiement production : **non réalisé**.

## Commandes

```bash
cd backend
npm run migrate:v4
npm run test:v4
```
