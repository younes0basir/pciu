# RBAC — Ressources V4

## Capacités existantes réutilisées

| Action | Capacité / rôle | Endpoint |
|--------|-----------------|----------|
| Placement / transfert | `place` (nurse, chief, doctor selon `roles.js`) | `POST /visits/:id/place`, `POST /care/visits/:id/transfer` |
| Confirmer nettoyage | `place` | `POST /resources/:id/confirm-ready`, `/care/resources/:id/confirm-ready` |
| Maintenance / blocage | `place` | `POST /resources/:id/operational-status` |
| Lecture board | nurse, doctor, chief, receptionist | `GET /resources/board` |
| Éligibilité | `place` | `GET /resources/eligible` |

## À valider avec le CHU

- Rôle autorisé pour **confirmer nettoyage** (aujourd’hui aligné sur `place`).
- Rôle pour **maintenance / hors service** (aujourd’hui `place` ; chef seul ?).
- Périmètre salle pour infirmiers (filtrage dossier patient vs ressource seule).

## Admin informatique

Aucun droit clinique ajouté ; `admin` n’a pas `place` par défaut.
