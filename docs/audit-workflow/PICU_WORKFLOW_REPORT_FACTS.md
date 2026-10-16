# PICU — Faits du rapport (base de vérité)

Document de contrôle qualité : chaque affirmation du rapport doit s'appuyer sur un **fait confirmé**. Ce fichier sépare ce qui est **prouvé** de ce qui est **déduit**, et liste les formulations à proscrire.

---

## 1. Faits confirmés par le code

| Fait | Preuve |
|------|--------|
| Routes montées : `/auth /board /visits /beds /users /chief /clinician /events /metrics /admin /queue /care /ai /workflow /resources` | `backend/src/routes/index.js:30-44` |
| Endpoints d'exécution d'actions IA (`approvals/:id/approve|reject`) protégés par la seule authentification | `backend/src/routes/aiRoutes.js:254-278` |
| Approbation → `executeApprovedAction` → outils (`place|close|triage|transfer`) | `backend/src/ai/actions/action-gateway.js:85-146`, `backend/src/services/visitTools.js:17-30` |
| Secret JWT de repli `super_secret_picu_jwt_key_2026_safe_change` | `backend/src/middleware/auth.js:14` ; `sseAuth.js:18` ; `authService.js:10` |
| `PUBLIC_REGISTER_ROLES` inclut `chief` ; inscription publique délivre un JWT | `backend/src/services/authService.js:7,182-208`, `authRoutes.js:47` |
| Capacités/rôles définis centralement | `backend/src/config/roles.js:1-33` |
| Matrice de transitions `care_stage` = source déclarée | `backend/src/lib/careStage.js:74-82` |
| `visitService` écrit `care_stage`/`status` sans `assertCareStageTransition` | `visitService.js:338-349,506-515,741-752,832-840` |
| `legacyStatusFromCareStage` défini mais jamais appelé | `careStage.js:53-72` (0 usage) |
| Tri worklists : `priority ASC, critical_flag DESC, arrived_at ASC, id ASC` | `backend/src/services/queueService.js:6-8` |
| `releaseBedToTurnover` met le lit en `cleaning` (jamais `ready`) | `backend/src/services/resourceService.js:33-63` |
| `confirmBedReady` exige `cleaning|maintenance` et lit libre | `resourceService.js:256-324` |
| `setOperationalStatus` refuse `ready` (422) | `resourceService.js:200-210` |
| Transfert : `confirmTransferRequest` lit le statut hors transaction puis appelle `transferResource` | `backend/src/services/transferRequestService.js:57-96` |
| `handoffService` n'écrit aucun `visit_events` | `backend/src/services/handoffService.js:3-63` |
| Bus temps réel en mémoire | `backend/src/services/visitEventBus.js:1-24` |
| SSE : auth par en-tête ou `?token=` ; rejeu `sinceId` max 200 ; heartbeat 25 s | `backend/src/routes/eventStreamRoutes.js:8-62` |
| Frontend repli polling 30 s + reconnexion 5 s + curseur sessionStorage | `frontend/src/hooks/useVisitEventStream.js:6-98` |
| CORS ouvert | `backend/src/app.js:11` |
| Jeton SSE dans l'URL | `frontend/src/hooks/useVisitEventStream.js:62,67` |
| `chiefSupervisionRoutes` sans middleware interne | `backend/src/routes/chiefSupervisionRoutes.js` (aucun `router.use`) |
| IA pipeline apply : `requireRole('chief')` sans `assertAiRouteAllowed` | `backend/src/routes/aiRoutes.js:180-192` |
| Bandeau de tests : 4 fichiers, 13 cas | `backend/src/tests/*.test.js` |
| `window.prompt` pour résultat d'examen | `frontend/src/components/workflow/VisitRecordTabs.jsx:267` |
| Comptes de démo en clair | `frontend/src/pages/LoginPage.jsx:4-9` |

## 2. Faits confirmés par la base (introspection read-only)

| Fait | Preuve |
|------|--------|
| 27 tables + 2 vues (`waiting_board`, `bed_board`) | `information_schema` |
| `visits_status_check` = `waiting|placed|in_treatment|discharged|transferred|left_without_seen` | `pg_constraint` |
| `visits_care_stage_check` = 7 états | `pg_constraint` |
| `visits_check` : statut terminal ⇔ `closed_at IS NOT NULL` | `pg_constraint` |
| `beds_operational_status_check` = `ready|cleaning|maintenance|blocked|out_of_service` | `pg_constraint` |
| Index unique partiel `bed_assignments_one_active_per_bed_idx` | `pg_indexes` |
| Index unique partiel `bed_assignments_one_active_per_visit_idx` | `pg_indexes` |
| Index unique partiel `visits_one_active_per_patient_idx` | `pg_indexes` |
| `patients_national_id_unique_idx` | `pg_indexes` |
| `operational_alerts_open_dedupe_idx` | `pg_indexes` |
| **Aucun** index partiel `(visit_id) WHERE status='pending'` sur `transfer_requests`/`handoff_requests` | `pg_indexes` |
| 0 doublon d'affectation active, 0 doublon de visite active (données observées) | `SELECT` de contrôle |
| `JWT_SECRET` et `DATABASE_URL` sont **définis** dans `.env` (présence, sans valeur) | `.env` (booléen) |

## 3. Faits confirmés par exécution de tests

| Fait | Preuve |
|------|--------|
| `supervision-rules.test.js` : 1/1 PASS | exécution `npm run test:supervision` |
| `patient-analytics.test.js` : 4/4 PASS | `node --test` |
| `registration-intelligence.test.js` : 5/5 PASS | `node --test` |

## 4. Faits déduits (non directement exécutés)

- La **course** sur `createTransferRequest`/`createHandoffRequest` est une **hypothèse** fondée sur l'absence de `FOR UPDATE` et d'index unique partiel ; non reproduite par test concurrent.
- Le comportement en **multi-instance** du SSE est déduit de l'implémentation en mémoire ; non testé.
- La **couverture frontend** résulte d'une exploration automatisée et par échantillonnage ; non exhaustive.
- Les fichiers V4 « working tree » sont identifiés comme modifiés/untracked par `git status` ; le détail de chaque diff n'a pas été audité ligne à ligne.

## 5. Points non vérifiés / à valider

- Validité **clinique** des priorités, orientations et seuils de réévaluation (≤60 min par défaut) → validation CHU requise.
- Conformité **réglementaire/confidentialité** et durée de conservation des données.
- Comportement de production réel (charge, volumes, réseau, proxy SSE).
- Politique opérationnelle de remise en service des lits.
- Périmètre d'autonomie IA autorisé.

## 6. Formulations à éviter (non étayées)

- ❌ « Le système empêche toute erreur de parcours » → faux : deux machines à états parallèles (P1-01).
- ❌ « Socket.IO assure le temps réel » → obsolète : SSE (`eventStreamRoutes`).
- ❌ « L'IA exécute automatiquement les placements » → elle recommande ; l'exécution passe par approbation (aujourd'hui insuffisamment contrôlée : P0-03).
- ❌ « La remise en service des lits est automatique » → infirmé : `cleaning → ready` exige `confirm-ready`.
- ❌ « Les seuils de supervision sont actifs » → faux par défaut : seuils non approuvés/désactivés.
- ❌ « 100 % testé » → faux : 10 cas exécutés, 0 test frontend, 0 E2E.
- ❌ « Le schéma est versionné » → faux : aucune migration committée ne crée les tables de base.
- ❌ « Le handoff est tracé » → faux : aucun `visit_events` (P1-03).

## 7. Périmètre et limites de l'audit

- Audit **statique** principalement, + introspection base read-only + 3 suites de tests non destructifs.
- Aucune modification apportée au code, au schéma, à la configuration ou aux données.
- Aucun secret, jeton ou donnée nominative reproduit.
- Les tests destructifs (`v4-safety.test.js`) n'ont **pas** été exécutés.
