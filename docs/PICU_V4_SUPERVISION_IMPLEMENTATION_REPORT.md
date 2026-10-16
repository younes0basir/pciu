# PICU V4 — Rapport d'implémentation Smart Supervision

## Backend

- **Services** : `supervisionProjectionService.js`, `bottleneckDetectionService.js`, `supervisionRulesService.js`, `supervisionAlertSyncService.js`
- **Routes** : `chiefSupervisionRoutes.js` monté sous `/api/chief/supervision`
- **Alertes** : `operationalAlertService` — filtres `active`/`obsolete`, `reconcileOperationalAlerts`, audit `operational_alert_events`
- **Orchestrateur** : `getSupervisionSnapshot()` ne déclenche plus d'écriture alertes
- **Serveur** : évaluation périodique via `SUPERVISION_ALERT_EVAL_INTERVAL_MS` (défaut 120000 ms si `DATABASE_URL` défini)
- **Migration** : `20261014_supervision_command_center.sql` incluse dans `npm run migrate:v4`

## Frontend

- **API** : `frontend/src/api/supervision.js`
- **Hook** : `useSupervisionDashboard.js`
- **Composants** : `CommandCenterHeader`, `OperationalAlertCenter`, `BottleneckPanel`, `TeamCoordinationPanel`
- **Intégration** : `ChiefDashboardPage` — colonne droite alertes + goulots + coordination ; KPI alertes ouvertes

## Décisions

- Seuils de délai clinique **non activés** tant que `approved: false` dans `workflow_settings.supervision_rules_v1`.
- Réévaluation alertes : idempotente (upsert dedupe) + réconciliation auto quand condition disparaît ou visite clôturée.
- Endpoints workflow historiques conservés pour compatibilité.

## Limitations

- Pas de prévision statistique / tendances horaires (données insuffisantes annoncées).
- Pas de modification RBAC infirmier/médecin pour supervision globale (chef seul sur `/chief/supervision`).
- `ActivePatientPipeline` dédié non extrait : pipeline visuel reste worklists + overview legacy.
