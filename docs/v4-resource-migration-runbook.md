# Runbook migration — Ressources V4

## Prérequis

- Base **isolée** ; `DATABASE_URL` de test.
- Migrations workflow déjà appliquées : `npm run migrate:v4`.

## Cette livraison

**Aucune nouvelle migration SQL** : réutilisation de `resource_status_events`, `operational_alerts`, vues `bed_board`.

## Données historiques

Ne pas passer en masse les lits de `ready` à `cleaning`. Procédure suggérée :

1. Exporter lits avec dernière libération récente et statut `ready`.
2. Revue équipe hygiène / soins.
3. Mise à jour manuelle ciblée ou marquage `cleaning` salle par salle.

## Rollback code

- Retirer montage `resourceRoutes` dans `routes/index.js`.
- Revenir aux versions antérieures de `resourceService.js` / `capacityService.js` si nécessaire.

## Sauvegarde

Snapshot Neon / dump PostgreSQL avant déploiement en préproduction.
