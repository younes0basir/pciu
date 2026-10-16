# Rapport de tests — Smart Resource Management

## Commandes exécutées

```bash
cd backend && npm run test:v4
```

**Résultat :** 3/3 pass (2026-10-14)

- `assertBedAssignable rejects cleaning bed`
- `releaseBedToTurnover sets cleaning not ready`
- `setOperationalStatus rejects direct ready transition`

## Scénarios matrice RM (statut)

| ID | Statut |
|----|--------|
| RM-01 | Non automatisé (concurrence manuelle / charge) |
| RM-02 | Couvert par test + `assertBedAssignable` |
| RM-03 | Couvert workflow V4 (`releaseBedToTurnover` sur clôture) |
| RM-04 | Implémenté `transferResource` |
| RM-06–08 | Partiel : API 403/409 ; UI drawer |
| RM-16 | Couvert compteurs `BedPlanPanel` (disponibles vs nettoyage) |
| RM-17 | Couvert `EligibleResourcePicker` + `listEligibleResourcesForVisit` |

## Non exécuté

- E2E Playwright, test concurrence deux sessions (RM-01).
- Migration sur base de production (interdit).
