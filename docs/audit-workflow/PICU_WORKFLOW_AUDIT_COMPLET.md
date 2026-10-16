# PICU — Audit complet du workflow des urgences

> Audit en **lecture seule** du dépôt `C:\Users\ken\Documents\upf\pciu` (branche `main`, HEAD `69e2b4c`).
> Sources primaires : code backend/frontend, migrations SQL committées, **introspection read-only** du schéma de la base configurée (`DATABASE_URL` de `backend/.env`), et exécution de tests unitaires non destructifs.
> Date de l'audit : 2026-10-15.
> ⚠️ Aucune modification de code, de schéma, de configuration ou de donnée n'a été effectuée. La base n'a reçu que des requêtes `SELECT`/`information_schema` et les tests unitaires non destructifs.

---

## 0. Synthèse finale (format imposé)

### 0.1 État réel du workflow en 10 lignes

1. Le workflow réel repose sur **deux colonnes parallèles** dans `visits` : `status` legacy (`waiting|placed|in_treatment|discharged|transferred|left_without_seen`, contrainte `visits_status_check`) et `care_stage` V3 (`registered|triage_pending|waiting_care|in_care|in_observation|disposition_pending|completed`).
2. Le socle **n'est pas versionné** : les tables/contraintes de base (`visits`, `patients`, `beds`, `rooms`, `zones`, `users`, `consultations`, `bed_assignments`, `visit_events`) existent en base mais **aucune migration committée ne les crée** ; seules les migrations additives `20261007…20261014` sont présentes.
3. Toutes les transitions métier passent par des **services transactionnels** (`withTransaction`, verrous `FOR UPDATE`) avec idempotence optionnelle via `visit_events.idempotency_key`.
4. La **double affectation de lit est empêchée au niveau base** : index unique partiel `bed_assignments_one_active_per_bed_idx (bed_id) WHERE released_at IS NULL` (et un index jumeau par `visit_id`).
5. La **remise en service d'un lit (`cleaning → ready`) n'est jamais automatique** : `setOperationalStatus` refuse `ready` (422) et `confirmBedReady` exige un état `cleaning|maintenance`.
6. Le temps réel est un **SSE** (`GET /api/events/stream`) adossé à un bus **en mémoire** (mono-processus), avec repli par **polling 30 s** côté frontend.
7. Le triage est **non bloquant** : à l'enregistrement le patient entre en `triage_pending` ; le triage infirmier (`triage_assessments`) est optionnel et une IA « miroir » (shadow) produit des recommandations sans écrire au dossier clinique.
8. La couche V4 (supervision, transferts, handoffs, alertes, IA) est **largement non committée** (working tree dirty) et partiellement implémentée.
9. La sécurité d'autorisation est **fragile** : secret JWT de repli codé en dur, **inscription publique permettant de choisir le rôle `chief`**, et endpoints d'exécution d'actions IA protégés par la seule authentification.
10. Les tests sont **rares** : 4 fichiers `node:test`, 13 cas, dont 3 destructifs (`v4-safety.test.js`) non exécutés en audit ; **0 test frontend**, pas de script de typecheck.

### 0.2 Cinq risques majeurs classés

| Rang | ID | Sévérité | Risque | Preuve |
|------|----|----------|--------|--------|
| 1 | P0-01 | 🔴 Critique | Inscription publique (`POST /api/auth/register`) avec **choix du rôle incluant `chief`** et délivrance immédiate d'un JWT de chef. | `backend/src/routes/authRoutes.js:47`, `backend/src/services/authService.js:7,182-208` |
| 2 | P0-02 | 🔴 Critique | **Secret JWT de repli codé en dur** utilisé si `JWT_SECRET` absent → forge de jetons possible. | `backend/src/middleware/auth.js:14`, `backend/src/middleware/sseAuth.js:18`, `backend/src/services/authService.js:10` |
| 3 | P0-03 | 🔴 Critique | `POST /api/ai/approvals/:id/approve` **sans contrôle de capacité/rôle** exécute des actions réelles (`place|close|triage|transfer`). | `backend/src/routes/aiRoutes.js:254-267`, `backend/src/ai/actions/action-gateway.js:85-146`, `backend/src/services/visitTools.js:17-30` |
| 4 | P1-01 | 🟠 Élevé | **Deux mécanismes de transition parallèles** : `visitService` écrit `care_stage`/`status` par `CASE` sans passer par `assertCareStageTransition`, que seule `careService`/`triageService` utilise. | `backend/src/lib/careStage.js:74-93` vs `backend/src/services/visitService.js:338-349,506-515,741-752` |
| 5 | P1-02 | 🟠 Élevé | `confirmTransferRequest` **non atomique** (statut lu hors transaction, `transferResource` dans une autre transaction) et `createTransferRequest`/`createHandoffRequest` sans verrou de déduplication. | `backend/src/services/transferRequestService.js:57-96`, `handoffService.js:8-14` |

### 0.3 Trois parcours testés / non testés

| Parcours | Statut | Détail |
|----------|--------|--------|
| Règles de supervision (seuil non validé rejeté) | ✅ **Testé (exécuté)** | `supervision-rules.test.js` — 1 cas, PASS |
| Analytique patient (helpers purs) | ✅ **Testé (exécuté)** | `patient-analytics.test.js` — 4 cas, PASS |
| Enregistrement / déduplication patient | 🟡 **Partiellement testé** | `registration-intelligence.test.js` — 5 cas (4 purs + 1 requête DB read-only), PASS |
| Invariants ressource (lit en nettoyage, remise en service) | ⚫ **NON EXÉCUTÉ** | `v4-safety.test.js` mute temporairement de vrais lits → exclu conformément à la règle de non-destructivité |
| Parcours E2E complet accueil→orientation→consultation→clôture | ⚫ **Non testé** | Aucun test automatisé E2E (uniquement `docs/E2E-V3-DEMO.md`, manuel) |
| Double affectation concurrente de lit | 🟡 **Prouvé au niveau schéma** | Index unique partiel en base ; pas de test concurrent automatisé |

### 0.4 Tableau de couverture des modules

| Module | Backend | Frontend | Tests | Statut global |
|--------|---------|----------|-------|---------------|
| Auth / comptes | ✅ `authRoutes`, `userRoutes` | ✅ LoginPage/Admin | ⚫ Aucun | Fonctionnel — risques P0 |
| Enregistrement patient | ✅ `visitService.registerVisit` | ✅ `RegisterPatientModal` | 🟡 Partiel | Fonctionnel |
| Recherche / dédup patient | ✅ `registrationIntelligenceService` | ✅ `useRegistrationFlow` | 🟡 Partiel | Fonctionnel |
| Triage infirmier | ✅ `triageService`, `careRoutes` | ✅ `NurseTriagePanel` | ⚫ Aucun | Fonctionnel |
| File d'attente / worklists | ✅ `queueService`, vues SQL | ✅ `WorklistsPanel` | ⚫ Aucun | Fonctionnel |
| Affectation ressource/lit | ✅ `resourceService`, `resourceManagementService` | ✅ `BedPlanPanel`, `NurseBedMapPanel` | 🟡 Partiel (non exécuté) | Fonctionnel |
| Consultation / clôture | ✅ `visitService`, `careService` | ✅ `ChiefVisitDrawer`, `VisitCareFlowPanel` | ⚫ Aucun | Fonctionnel |
| Transfert / handoff | ✅ `transferRequestService`, `handoffService` | ✅ panneaux workflow | ⚫ Aucun | Partiel (atomicité) |
| Supervision / alertes | ✅ `supervision*Service`, `operationalAlertService` | ✅ `ChiefDashboardPage` | 🟡 1 cas | Partiel |
| IA (triage/flow/doc) | ✅ `src/ai/**` | ✅ panneaux IA | ⚫ Aucun | Shadow/recommandations |
| Temps réel SSE | ✅ `eventStreamRoutes` | ✅ `useVisitEventStream` | ⚫ Aucun | Fonctionnel (mono-instance) |

### 0.5 Plan de remédiation priorisé

1. **P0 — immédiat** : fermer l'inscription publique (ou la restreindre à `receptionist` avec validation admin) ; supprimer le secret JWT de repli et faire échouer le démarrage si `JWT_SECRET` absent ; ajouter `requireCapability('ai_...'|'close'|'place')` + `assertAiRouteAllowed` sur `approvals/approve`.
2. **P1** : unifier la machine à états (`assertCareStageTransition` appliqué dans `visitService`) ; rendre les créations de transfert/handoff atomiques avec index unique partiel `(visit_id) WHERE status='pending'` ; rendre `confirmTransferRequest` transactionnel.
3. **P2** : sortir le jeton SSE du querystring ; restreindre CORS ; ajouter tests d'intégration backend + tests frontend ; commit du schéma de base (migration initiale) ou documenter sa provenance.
4. **P3** : dédupliquer les libellés/`care_stage` côté frontend ; remplacer `window.prompt` ; harmoniser l'UI.

### 0.6 Questions métier à valider avec le CHU

- Valeurs et libellés cliniques de la priorité (1–5) et seuils de réévaluation (≤60 min par défaut, non validés cliniquement).
- Autorisation d'auto-inscription de personnel (dont `chief`) et procédure de validation des comptes.
- Politique de remise en service des lits : qui confirme le nettoyage, et dans quel délai.
- Durée de conservation des `visit_events` et données nominatives ; exigences de confidentialité.
- Périmètre d'autonomie IA autorisé (recommander / exécuter sous approbation / automatique).

---

## 1. Méthode et périmètre

- **Documents de référence secondaires** (non preuves) : `context.md`, `docs/PROCESSUS-URGENCES-V3.md`, `docs/ROADMAP-AGENTS.md`, `PICU_V4_*_AGENT_PROMPT.md`, `CHU_FES_EMERGENCY_PLATFORM_COMPLETE_ANALYSIS.md`.
- **Sources primaires** : code `backend/src`, `frontend/src`, `backend/migrations/*.sql`, introspection `information_schema`/`pg_constraint`/`pg_indexes` (read-only).
- **Exécutions autorisées** : `npm run test:supervision`, `node --test src/tests/patient-analytics.test.js`, `node --test src/tests/registration-intelligence.test.js`.
- **Non exécuté** : `npm run test:v4` (mute des lits réels), tests frontend (inexistants), charge/concurrence.

Légende des statuts : **observé (code)** · **confirmé (base)** · **confirmé (test)** · **déduit** · **non vérifié** · **prévu mais absent**.

---

## 2. Architecture réelle

### 2.1 Stack

| Couche | Technologie | Preuve |
|--------|-------------|--------|
| Backend | Node.js (CommonJS), Express 4.21, `pg` 8.16, `jsonwebtoken`, `helmet`, `cors`, `morgan` | `backend/package.json:18-29` |
| Frontend | React 19 + Vite 8, React Router 7, Tailwind 4, oxlint | `frontend/package.json:12-30` |
| Temps réel | SSE maison (aucune dépendance Socket.IO) | `backend/src/routes/eventStreamRoutes.js`, `frontend/src/hooks/useVisitEventStream.js` |
| Base | PostgreSQL (Neon), 27 tables + 2 vues | introspection `information_schema` |
| IA | NVIDIA NIM (agents `src/ai/**`) | `backend/src/ai/providers/nim/*` |

> Note : `context.md` (§2, §7, §8) référence **Socket.IO**, `AuthContext`/`AppContext`, `RoleDashboard.jsx`, `useDashboardData`, `/api/patients`, `/api/triage`, `resources`/`resource_assignments` : **obsolète**. Le code réel utilise SSE, pas de contextes frontend globaux dédiés, et un modèle `zones/rooms/beds` + `emergency_visits` renommé `visits`.

### 2.2 Montage des routes (`backend/src/routes/index.js:30-44`)

`/api/auth`, `/api/board`, `/api/visits`, `/api/beds`, `/api/users`, `/api/chief`, `/api/clinician`, `/api/events`, `/api/metrics`, `/api/admin`, `/api/queue`, `/api/care`, `/api/ai`, `/api/workflow`, `/api/resources`.

`chiefSupervisionRoutes` **n'est pas monté dans `index.js`** ; il est monté sous `/api/chief/supervision` par `chiefRoutes.js:10-11`, héritant du `authenticateJwt` + `requireRole('chief')` parent.

### 2.3 Modèle de données confirmé (introspection read-only)

- **27 tables** : `agent_actions, agent_approvals, agent_recommendations, agent_runs, bed_assignments, beds, care_tasks, consultations, exams, handoff_requests, operational_alert_events, operational_alerts, patients, protocol_chunks, protocol_documents, resource_status_events, room_team_nurses, room_teams, rooms, service_ai_settings, transfer_requests, triage_assessments, users, visit_events, visits, workflow_settings, zones`.
- **2 vues** : `waiting_board`, `bed_board`.
- **Contraintes clés** (confirmé base) :
  - `visits_status_check` : `waiting|placed|in_treatment|discharged|transferred|left_without_seen`.
  - `visits_check` : `(status ∈ {discharged,transferred,left_without_seen}) = (closed_at IS NOT NULL)`.
  - `visits_care_stage_check`, `visits_outcome_check`, `visits_patient_location_check`, `visits_current_orientation_check`.
  - `beds_operational_status_check` : `ready|cleaning|maintenance|blocked|out_of_service`.
  - `beds_resource_type_check` : `bed|chair|box|triage_station|consultation_station|other`.
- **Index uniques partiels (garde-fous d'intégrité)** :
  - `bed_assignments_one_active_per_bed_idx (bed_id) WHERE released_at IS NULL`.
  - `bed_assignments_one_active_per_visit_idx (visit_id) WHERE released_at IS NULL`.
  - `visits_one_active_per_patient_idx (patient_id) WHERE status IN ('waiting','placed','in_treatment')`.
  - `patients_national_id_unique_idx (upper(btrim(national_id))) WHERE national_id IS NOT NULL`.
  - `operational_alerts_open_dedupe_idx (dedupe_key) WHERE status IN ('open','acknowledged')`.
- **Pas d'index partiel** sur `transfer_requests(visit_id)` ni `handoff_requests(visit_id)` pour `status='pending'` (voir P1-02).

---

## 3. Parcours patient AS-IS

### 3.1 Tableau de transitions (format demandé)

| # | État avant | Déclencheur | Acteur habilité | Endpoint | Service | Conditions | Transaction | État après | Événement SSE | UI impactée | Preuve |
|---|-----------|-------------|-----------------|----------|---------|------------|-------------|-----------|---------------|-------------|--------|
| 1 | (aucune visite active) | Enregistrement | `register` (receptionist, chief) | `POST /api/visits/register` | `visitService.registerVisitTransaction` | `firstName`,`lastName`,`priority 1-5`,`chiefComplaint` ; pas de visite active | Oui | `status=waiting`,`care_stage=triage_pending`,`patient_location=waiting_area` | `registered` | Accueil | `visitService.js:36-203`, `visitRoutes.js:73-80` |
| 2 | `waiting` | Recherche patient | `register` | `GET /api/visits/register/preflight` | `registrationIntelligenceService` | CIN normalisé | Non (read) | idem | — | Accueil | `visitRoutes.js:27-40`, `registrationIntelligenceService.js:5-76` |
| 3 | `triage_pending/registered` | Triage initial | `triage` (nurse, chief) | `POST /api/care/visits/:id/triage` | `triageService.recordTriage` | `priority 1-5`, `assessmentType∈{initial,reassessment,escalation}` ; transition `assertCareStageTransition` | Oui | `care_stage=waiting_care` (si initial), `clinical_priority_validated_at` posé | `triage_completed` (+`priority_changed` si changement) | Nurse | `careRoutes.js:105-117`, `triageService.js:21-156` |
| 4 | `waiting`, `triage_pending` | Ajustement priorité (legacy) | `triage` | `PATCH /api/visits/:id/priority` | `visitService.updateVisitPriority` | status `waiting` + care_stage ∈ {triage_pending,waiting_care,registered} | Oui | `priority`, `care_stage=waiting_care` | `triage_validated` | Nurse | `visitRoutes.js:122-134`, `visitService.js:872-974` |
| 5 | `waiting` | Appel patient | `call` | `POST /api/visits/:id/call` | `visitService.callVisit` | `status='waiting'` | Oui | `last_called_at`,`call_count+1` (status inchangé) | `called` | Accueil | `visitRoutes.js:84-91`, `visitService.js:205-268` |
| 6 | `waiting` | Placement lit | `place` (nurse, chief) | `POST /api/visits/:id/place` | `visitService.placeVisit` | lit `is_active` + `operational_status='ready'` + libre + visite sans lit | Oui (verrous `beds FOR UPDATE`) | `status=placed`,`care_stage=waiting_care`,`patient_location=resource` | `placed` | Nurse | `visitRoutes.js:95-103`, `visitService.js:270-380` |
| 7 | `waiting` (care) | Orientation auto (V4) | `place` | `POST /api/workflow/visits/:id/transfer-requests` puis confirm | `transferRequestService` → `transferResource` | lit cible prêt + libre | Partiel (voir P1-02) | `resource_transferred` | Workflow | `workflowRoutes.js:103-134`, `transferRequestService.js:5-96` |
| 8 | `placed`/`in_treatment`/`waiting(care)` | Début consultation | `start` (doctor, nurse salle) | `POST /api/visits/:id/start` | `visitService.startConsultation` | lit actif **sauf** `critical_flag` en `triage_pending` ; attribution médecin | Oui | `status=in_treatment`,`care_stage=in_care`,`care_started_at` | `consultation_started` | Doctor/Nurse | `visitRoutes.js:107-119`, `visitService.js:443-551` |
| 9 | `in_treatment` | Mise à jour consultation | `fill` | `PATCH /api/visits/:id/consultation` | `visitService.updateConsultation` | consultation ouverte ; médecin = titulaire (ou chef/nurse salle) | Oui | inchangé | `consultation_updated` | Doctor | `visitRoutes.js:137-149`, `visitService.js:553-651` |
| 10 | `in_care` | Observation | `start` | `POST /api/care/visits/:id/observation/start` | `careService.startObservation` | `assertCareStageTransition→in_observation` | Oui | `care_stage=in_observation` | `observation_started` | Nurse | `careRoutes.js:133-140`, `careService.js:18-56` |
| 11 | any non terminal | Décision issue | `close` | `POST /api/care/visits/:id/disposition` | `careService.decideDisposition` | `outcome ∈ V3_OUTCOMES` | Oui | `care_stage=disposition_pending`,`outcome` | `disposition_decided` | Doctor/Nurse | `careRoutes.js:151-163`, `careService.js:99-164` |
| 12 | `disposition_pending` | Clôture | `close` | `POST /api/care/visits/:id/complete` | `careService.completeVisit` | `outcome` requis | Oui | `care_stage=completed`,`status=terminal`,`closed_at`,`patient_location=discharged` | `closed` | Doctor/Nurse | `careRoutes.js:165-177`, `careService.js:166-242` |
| 13 | `placed/in_treatment` (+ `waiting` LWBS) | Clôture directe | `close` | `POST /api/visits/:id/close` | `visitService.closeVisit` | outcome ∈ legacy+V3 ; `admitted`→`decideDisposition` | Oui | terminal + lit → `cleaning` | `closed` (+`bed_turnover_started`) | Doctor/Nurse | `visitRoutes.js:153-160`, `visitService.js:653-783` |
| 14 | `placed` | Retour en attente | `return` | `POST /api/visits/:id/return` | `visitService.returnVisit` | `status='placed'` | Oui | `status=waiting`,`care_stage=waiting_care`, lit libéré → cleaning | `returned` | Nurse | `visitRoutes.js:164-171`, `visitService.js:785-870` |
| 15 | lit occupé/`cleaning` | Remise en service | `place` | `POST /api/resources/:bedId/confirm-ready` | `resourceService.confirmBedReady` | depuis `cleaning|maintenance`, lit non occupé | Oui | `operational_status=ready` | `bed_ready_confirmed` | Nurse | `resourceRoutes.js:99-107`, `resourceService.js:256-324` |
| 16 | lit occupé | Transfert direct | `place` | `POST /api/care/visits/:id/transfer` | `resourceService.transferResource` | cible `ready`+libre | Oui | nouvelle affectation, ancien lit → cleaning | `resource_transferred` | Nurse/Chief | `careRoutes.js:179-192`, `resourceService.js:91-196` |

### 3.2 Exceptions

| Cas | Comportement observé | Preuve |
|-----|----------------------|--------|
| Patient déjà en visite active | **409** + message | `visitService.js:118-132` |
| Lit occupé | **409** (vérif applicative + index unique base) | `visitService.js:305-315`, `resourceService.js:121-127` |
| Lit `cleaning/maintenance/...` | **409** « Confirmer la remise en service » | `resourceService.js:75-86` |
| `ready` forcé via API statut | **422**, passer par `confirm-ready` | `resourceService.js:200-210` |
| Consultation sans lit | **400** sauf `critical_flag` | `visitService.js:478-487` |
| Visite terminée ré-ouverte | **refusée** : garde `care_stage==='completed'` | `placeVisit:292-294`, `triageService:51-53`, `careService:119-121` |
| Clôture depuis `waiting` | uniquement outcomes « left » | `visitService.js:685-697` |
| Déconnexion SSE | reconnexion après 5 s + polling 30 s | `useVisitEventStream.js:81-98` |
| Double clic / replay | idempotence via `idempotency-key` (partielle, selon endpoints) | `visitEventService.js:35-53` |

---

## 4. Machines à états et invariants

### 4.1 Valeurs réelles

- `visits.status` : `waiting, placed, in_treatment, discharged, transferred, left_without_seen` (base).
- `visits.care_stage` : `registered, triage_pending, waiting_care, in_care, in_observation, disposition_pending, completed` (`careStage.js:3-11`).
- `visits.outcome` : `discharged, admitted, transferred, left_before_seen, left_during_care, other`.
- `visits.current_orientation` : `critical, acute, standard, ambulatory, observation, isolation`.
- `beds.operational_status` : `ready, cleaning, maintenance, blocked, out_of_service`.
- Triage `assessment_type` : `initial, reassessment, escalation` ; priorité `1..5`.

### 4.2 Matrice de transitions `care_stage` (source unique déclarée)

`backend/src/lib/careStage.js:74-82` :

| Depuis | Vers autorisés |
|--------|----------------|
| registered | triage_pending, waiting_care, in_care |
| triage_pending | waiting_care, in_care, completed |
| waiting_care | in_care, in_observation, disposition_pending, completed |
| in_care | in_observation, disposition_pending, completed, waiting_care |
| in_observation | in_care, disposition_pending, completed, waiting_care |
| disposition_pending | completed, in_care, in_observation |
| completed | ∅ |

### 4.3 Transitions implicites / non contrôlées (constat)

- `visitService.placeVisit` (:338-349), `startConsultation` (:506-515), `closeVisit` (:741-752) et `returnVisit` (:832-840) écrivent `care_stage` directement par `CASE` **sans appeler `assertCareStageTransition`**. Le contrôle n'est appliqué que par `careService` (observation/disposition/complete) et `triageService`. → **Deux mécanismes parallèles** ; la matrice ci-dessus n'est pas une garantie globale (risque P1-01).
- `legacyStatusFromCareStage` (`careStage.js:53-72`) est **défini mais jamais utilisé** (dérive possible `status`/`care_stage`).
- Aucune contrainte DB ne lie `care_stage` et `status` (sauf `visits_check` sur `closed_at`).

### 4.4 Invariants vérifiés (base)

- Un lit ne peut avoir **deux affectations actives** → index unique partiel (confirmé base, 0 doublon parmi 30 visites / 2 affectations actives).
- Un patient ne peut avoir **deux visites actives** → index unique partiel + garde applicative ; 0 doublon constaté.
- Pas de contradiction `closed status / care_stage actif` parmi les données observées (0).
- `cleaning → ready` **non automatique** (`resourceService.js:43-45,200-210,270-276`).
- Une sortie **n'entraîne pas** de remise à `ready` : `releaseBedToTurnover` met `cleaning` (`resourceService.js:33-63`).

### 4.5 Diagrammes

Voir `diagrams/etats-asis.mmd` (AS-IS) et `diagrams/etats-tobe.mmd` (TO-BE proposé).

---

## 5. Files d'attente, priorités, temporalité

- **Worklists** (`queueService.js:67-134`) : triage (`care_stage ∈ {registered,triage_pending}`), care (`waiting_care`), inCare (`in_care`), observation (`in_observation`), disposition (`disposition_pending`), reassessment (`clinical_priority_validated_at` + dernière éval < now - intervalle), exams.
- **Tri** : `ORDER BY v.priority ASC, v.critical_flag DESC, v.arrived_at ASC, v.id ASC` (`queueService.js:6-8`, repris par la vue `waiting_board`). `priority` = 1 (urgent) … 5.
- **Réévaluation** : intervalle lu dans `workflow_settings.reassessment_interval_minutes` (défaut 60, plancher 15) ; modifiable par `chief|admin` via `PUT /api/workflow/settings/reassessment-minutes` (`workflowSettingsService.js:3-24`, `workflowRoutes.js:90-101`).
- **Aucune pagination** sur les worklists (`getAllWorklists`) ; limite seulement sur les vues de supervision (`.slice(0,50)`).
- **Temporalité** : horodatages serveur (`NOW()`, `timestamptz`). Pas de gestion de fuseau côté client observée ; pas de SLA inventé : les seuils V4 (`supervisionRulesService.js:5-18`) sont **désactivés et non approuvés** par défaut (« validation CHU requise »).

---

## 6. Ressources et coordination

- **Hiérarchie** : `zones → rooms → beds` (confirmé base).
- **Types** : `bed, chair, box, triage_station, consultation_station, other`.
- **États** : `ready, cleaning, maintenance, blocked, out_of_service` ; occupation **dérivée** de `bed_assignments.released_at IS NULL`.
- **Équipes** : `room_teams` (1 médecin/salle, unique) + `room_team_nurses` (unique par infirmier) (`migration 20261007`).
- **Affectation/transfert/libération** : transactionnels avec verrous ; libération → `cleaning` ; remise en service explicite (`confirm-ready`).
- **Historisation lit** : `resource_status_events` (`resourceService.js:11-31`).
- **Audit des incohérences** : `detectResourceInconsistencies` (`resourceManagementService.js:354-373`).
- **Risque `cleaning → ready` automatique** : **infirmé** (preuves ci-dessus).
- **Remise à `ready` à la sortie** : **infirmé** (la sortie déclenche `cleaning`).

---

## 7. Sécurité, audit, confidentialité

### 7.1 Authentification / RBAC

- JWT vérifié à chaque requête + contrôle `is_active` (`auth.js:6-44`).
- Rôles/capacités : `config/roles.js:1-33` ; garde `requireCapability` (`auth.js:60-72`), `requireRole` (`auth.js:46-58`).
- Compte admin : e-mail imposé par l'environnement (`auth.js:27-34`).

### 7.2 Constats sécurité

| Sévérité | Constat | Preuve |
|----------|---------|--------|
| 🔴 | Inscription publique avec rôle `chief` + JWT immédiat | `authRoutes.js:47`, `authService.js:7,182-208` |
| 🔴 | Secret JWT de repli en dur | `auth.js:14`, `sseAuth.js:18`, `authService.js:10` |
| 🔴 | Exécution d'actions IA sans capacité/rôle | `aiRoutes.js:254-278`, `action-gateway.js:85-146` |
| 🟠 | `GET /visits/:id` : PII patient + timeline, auth seule, **sans contrôle IDOR** | `visitRoutes.js:62-69`, `visitService.js:976-1158` |
| 🟠 | `PATCH /ai/recommendations/:id` auth seule | `aiRoutes.js:91` |
| 🟠 | Nombreux GET auth-only (worklists, capacity, exams, triage-history, alerts…) | `queueRoutes.js:9`, `careRoutes.js:27-103`, `workflowRoutes.js:36-136` |
| 🟠 | `chiefSupervisionRoutes` sans middleware propre | `chiefSupervisionRoutes.js` (aucun `router.use`) |
| 🟡 | Jeton SSE en querystring | `useVisitEventStream.js:62,67` |
| 🟡 | CORS `cors()` ouvert (toute origine) | `app.js:11` |
| 🟡 | `POST /ai/bed-flow/pipeline/apply` (mute) : `requireRole('chief')` sans `assertAiRouteAllowed` | `aiRoutes.js:180-192` |

### 7.3 Journalisation

- `visit_events` : `actor_user_id`, `actor_type` (user/agent/system), `agent_run_id`, `idempotency_key`, `event_type`, `from_status`, `to_status`, `metadata` (avant/après partiel) (`migration 20261008`, `visitEventService.js:73-112`).
- `resource_status_events` : transitions de lit (`resourceService.js:11-31`).
- `logVisitAction` : log JSON console (`visitActionLogger.js:1-8`) — pas de persistance.
- **Trou de journalisation** : `handoffService` n'écrit **aucun `visit_events`** alors que les types `handoff_requested/accepted/declined` existent (`handoffService.js:3-63`, `migration 20261014:60-62`).
- SSE : diffusion à **tous** les abonnés authentifiés sans filtrage par rôle, mais charge utile sans PII (`eventStreamRoutes.js:45-49`).

---

## 8. Temps réel, résilience et concurrence

- **Stream** : `GET /api/events/stream` (auth Bearer ou `?token=`), rejoue les events `id > sinceId` (max 200), heartbeat 25 s (`eventStreamRoutes.js:8-62`).
- **Bus** : `visitEventBus` **en mémoire** → ne fonctionne qu'avec un **seul process** (pas de Redis/Postgres LISTEN) (`visitEventBus.js:1-24`).
- **Frontend** : `EventSource`, curseur `pciu_last_visit_event_id` en `sessionStorage`, reconnexion 5 s, debounce 400 ms, + **polling 30 s** (`useVisitEventStream.js:6-98`, `useClinicianDashboard.js:25,74-78`).
- **Concurrence** : la sécurité des affectations repose sur **verrous `FOR UPDATE`** (`visits`, `beds`, `bed_assignments`) **et** index uniques partiels → l'invariant est garanti par la **base**, pas seulement l'UI.
- **Non vérifié** : multi-instance (le bus mémoire casserait le temps réel), perte d'événement au-delà de 200 dans le backlog.

---

## 9. UX et rôle de chaque acteur (constats utiles au workflow)

- **Accueil** (`AccueilDashboardPage.jsx`) : enregistrement + appel + file ; collisions possibles entre `EnhancedQueueView`-like et lanes (cf. `context.md §13.7`) — à confirmer.
- **Infirmier** : triage, salles/lits, worklists.
- **Médecin** : caseload, consultation, clôture.
- **Chef** : command center, alertes, équipes, IA.
- **Admin** : comptes, démo, base.
- Points d'attention : `window.prompt` pour un résultat d'examen (`VisitRecordTabs.jsx:267`) ; comptes de démo en clair dans `LoginPage.jsx:4-9` ; boutons Google/reinit sans effet (`LoginPage.jsx:79-80`).

---

## 10. Tests existants et couverture

| Fichier | Nature | DB | Cas | Résultat audit |
|---------|--------|----|-----|----------------|
| `backend/src/tests/supervision-rules.test.js` | Unitaire pur | Non | 1 | ✅ PASS |
| `backend/src/tests/patient-analytics.test.js` | Unitaire pur | Non | 4 | ✅ PASS |
| `backend/src/tests/registration-intelligence.test.js` | 4 purs + 1 DB (read-only) | Oui (gated) | 5 | ✅ PASS |
| `backend/src/tests/v4-safety.test.js` | Intégration (mute des lits) | Oui (gated) | 3 | ⚫ NON EXÉCUTÉ (destructif) |

- Total : **13 cas**, **10 exécutés et PASS**, **3 non exécutés** (raison : mutation d'états réels).
- **Aucun** test frontend, **aucun** typecheck, **aucun** test E2E, CI limitée à un guard de secrets (`.github/workflows/secret-guard.yml`).
- Détails et matrice P0/P1/P2 : `PICU_WORKFLOW_TEST_PLAN.md`.

---

## 11. Conclusion et livrables associés

- `PICU_WORKFLOW_TRACEABILITY_MATRIX.md` — exigence → UI → API → service → table → événement → test.
- `PICU_WORKFLOW_RISK_REGISTER.md` — anomalies P0–P3.
- `PICU_WORKFLOW_TEST_PLAN.md` — scénarios reproductibles.
- `PICU_WORKFLOW_V3_V4_GAP_ANALYSIS.md` — conformité V3/V4.
- `diagrams/` — Mermaid AS-IS (+ TO-BE).
- `PICU_WORKFLOW_REPORT_FACTS.md` — faits confirmés + formulations à éviter.

---

## Ce que j'ai vérifié

- Montage des routes, capacités et rôles (lecture exhaustive de `backend/src/routes/*`).
- Machines à états applicatives (`careStage.js`, `visitService.js`, `careService.js`, `triageService.js`).
- Invariants base confirmés par introspection read-only (contraintes, index uniques partiels, 0 doublon observé).
- Politique de ressource (`resourceService.js`) : `cleaning→ready` non automatique, `ready` non forcable.
- Temps réel SSE + repli polling ; bus en mémoire.
- Sécurité d'autorisation et trous de capacité sur endpoints sensibles.
- Exécution de 10 cas de tests unitaires non destructifs (PASS).

## Ce que je n'ai pas pu vérifier

- Tests destructifs `v4-safety.test.js` (mutation de lits réels) — non exécutés par principe.
- Comportement multi-instance du SSE (bus mémoire) — non testé.
- Tests de charge et de concurrence réels (double affectation simultanée) — non exécutés.
- Conformité réglementaire/confidentialité et validité clinique des seuils — hors périmètre technique.
- Exhaustivité fonctionnelle frontend (lecture par échantillonnage et exploration automatisée).

## Ce que je recommande

- Traiter immédiatement P0-01/02/03 (voir `PICU_WORKFLOW_RISK_REGISTER.md`).
- Unifier la machine à états (P1-01) et rendre transferts/handoffs atomiques (P1-02).
- Committer (ou documenter la provenance de) la migration initiale du schéma de base.
- Ajouter des tests d'intégration E2E et concurrents, un typecheck, et sortir le jeton SSE de l'URL.

## Ce que je n'ai pas modifié

- **Aucun** fichier de code applicatif, de schéma, de migration, de configuration ou de données.
- Seuls des fichiers **documentaires** ont été créés sous `docs/audit-workflow/`.
