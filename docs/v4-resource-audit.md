# PICU V4 — Audit gestion des ressources (Phase 0)

**Date :** 2026-10-14  
**Périmètre :** lits, salles, turnover, affectation, transferts, capacité.

## État vérifié dans le dépôt

| Domaine | Fichiers / routes | Constat |
|--------|-------------------|---------|
| Modèle | `beds.operational_status`, `bed_assignments`, `resource_status_events` | Conforme au modèle deux dimensions (occupation dérivée + statut opérationnel) |
| Placement | `visitService.placeVisit` + `assertBedAssignable` | Refuse tout état ≠ `ready` |
| Libération | `visitService`, `careService.completeVisit`, `resourceService.transferResource` | `releaseBedToTurnover` → `cleaning` |
| Remise en service | `resourceService.confirmBedReady`, `POST /api/care/resources/:bedId/confirm-ready` | Transition contrôlée depuis `cleaning` / `maintenance` |
| Board SQL | Vue `bed_board`, `boardService.getBoardSnapshot` | Occupation + statut opérationnel |
| Workflow | `GET /api/workflow/resources/board` | Existe ; enrichi avec métriques |
| Capacité | `capacityService.calculateLoad` | **Écart corrigé :** `ready_free` comptait les lits `cleaning` |
| Patch statut | `PATCH /api/care/resources/:bedId/status` | **Écart corrigé :** passage direct à `ready` interdit |

## Chemins qui assignaient ou remettaient `ready` (inventaire)

- `resourceService.confirmBedReady` — autorisé (confirmation humaine).
- `resourceService.setOperationalStatus` — **bloqué** pour `ready` (422).
- `dbResetService` / seed — environnement démo uniquement.
- `v4-safety.test.js` — restauration après tests.

Aucun chemin de placement ne force plus `cleaning → ready`.

## Écarts document V3 vs code (résolus ou couverts)

1. Lit libéré remis `ready` automatiquement → corrigé (Phase workflow V4).
2. Compteur « lits libres » incluant nettoyage → corrigé UI + `capacityService`.
3. API `/api/resources/*` manquante → ajout `resourceRoutes.js`.

## Risques résiduels (validation CHU)

- Habilitation exacte pour « confirmer nettoyage » : actuellement capacité `place` (infirmier/chef).
- Seuils d’alerte durée nettoyage : non automatisés (pas de valeur clinique inventée).
- Données historiques en `ready` après sortie sans trace de nettoyage : revue manuelle recommandée (runbook).

## Fichiers ciblés par cette évolution

- Backend : `resourceService.js`, `resourceManagementService.js`, `resourceRoutes.js`, `capacityService.js`, `workflowOrchestratorService.js`
- Frontend : `BedPlanPanel.jsx`, `ResourceDetailsDrawer.jsx`, `EligibleResourcePicker.jsx`, `resourceUtils.js`
- Tests : `v4-safety.test.js`
