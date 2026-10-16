# Changelog — Smart Resource Management V4

## État : partiellement implémenté (Phases 0–5 code, Phase 6 tests partiels)

### Backend

- `resourceManagementService.js` — board, capacité, éligibilité, historique.
- `resourceRoutes.js` — API `/api/resources/*`.
- `resourceService.js` — durcissement statuts, SSE bus, `markBedCleaning`.
- `capacityService.js` — compteur lits prêts strict.
- `workflowOrchestratorService.js` — alerte salle sans équipe complète.
- `workflowRoutes.js` — board enrichi.

### Frontend

- `BedPlanPanel` — KPI disponibles / nettoyage, filtres, pas de « libre » pour `cleaning`.
- `ResourceDetailsDrawer`, `EligibleResourcePicker`, `api/resources.js`, `resourceUtils.js`.
- `ChiefDashboardPage` — drawer ressource sur le plan lits.

### Documentation

- `docs/v4-resource-*.md` (audit, architecture, RBAC, tests, runbook, changelog).

### Décisions CHU requises

- Matrice nettoyage / maintenance.
- Seuils alerte durée nettoyage.

### Prochaines étapes recommandées

- Intégrer `EligibleResourcePicker` dans le drawer visite / modal infirmier.
- Test RM-01 concurrence automatisé.
- Seuil configurable nettoyage long (workflow_settings).
