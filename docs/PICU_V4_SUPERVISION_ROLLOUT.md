# Déploiement — Smart Supervision V4

## Prérequis

1. `npm run migrate:v4` sur environnement cible (additif).
2. Variables : `SUPERVISION_ALERT_EVAL_INTERVAL_MS` (0 pour désactiver le timer).

## Rollback

- Désactiver timer (`SUPERVISION_ALERT_EVAL_INTERVAL_MS=0`).
- Frontend : retrait des composants supervision dans `ChiefDashboardPage` si nécessaire (overview legacy reste).
- Migration SQL : statut `obsolete` et table `operational_alert_events` peuvent rester sans impact négatif.

## Monitoring

- Logs serveur : échecs `Supervision alert evaluation failed`.
- Métriques manuelles : latence `GET /api/chief/supervision/overview`, volume `operational_alerts` par statut.

## Validation CHU avant pilote

- [ ] Approbation explicite des seuils delay dans `supervision_rules_v1`
- [ ] Revue métier des types d'alertes et escalade vitale (hors SMS)
- [ ] Test charge 50–200 visites fictives sur environnement isolé
