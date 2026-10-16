# PICU V4 — Rapport de tests Supervision

## Commandes exécutées (2026-10-14)

| Commande | Résultat |
|----------|----------|
| `cd backend && npm run test:supervision` | **PASS** (1/1) |
| `cd backend && npm run test:v4` | **PASS** (3/3, DB Neon configurée) |
| `cd frontend && npm run build` | **PASS** (Vite build OK) |

## Non exécuté

- Tests E2E navigateur chef (alertes, acquittement concurrent, SSE reconnect) — à planifier Playwright.
- Benchmark latence API sur 200 visites fictives — non mesuré dans cette passe.
- Migration `20261014_supervision_command_center.sql` sur votre instance : **à lancer** via `npm run migrate:v4` si pas encore appliquée.

## Scénarios couverts par tests automatisés

- Seuils delay non approuvés → règle non configurée (`ruleConfigured`).
- Lit `cleaning` non assignable ; turnover → cleaning ; transition directe vers `ready` interdite.

## Scénarios manuels recommandés (chef)

1. Dashboard vide → états compacts alertes / goulots.
2. Patient triage → alerte `UNTRIAGED_PATIENT` après évaluation (`POST evaluate-alerts` ou timer 120s).
3. Acquittement alerte → statut `acknowledged`, persistance si condition toujours vraie.
4. Clôture visite → alertes liées `obsolete` après réconciliation.
5. Lit confirmé prêt → alerte turnover résolue.
