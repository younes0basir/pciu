# PICU V4 Smart Emergency Workflow — Phase 0 : baseline et analyse des écarts

**Date :** 2026-10-14  
**Périmètre :** audit code source (sans mutation), aligné sur `PICU_V4_SMART_EMERGENCY_WORKFLOW_AGENT_PROMPT.md`  
**Sources :** dépôt `pciu`, `CHU_FES_EMERGENCY_PLATFORM_COMPLETE_ANALYSIS.md`, `PICU_V4_UI_UX_REFACTOR_IMPLEMENTATION.md`

---

## 1. Résumé exécutif

Le socle **V3 Smart Emergency Flow** est **réellement présent** : `care_stage`, worklists calculées, triage historisé (`triage_assessments`), statut opérationnel des lits, examens/tâches, SSE sur `visit_events`, RBAC par capacités, transactions avec `FOR UPDATE` et idempotence via `visitEventService`.

**PICU V4 (workflow déterministe, alertes, handoffs, transferts confirmés, moteur de coordination sans IA)** n’est **pas encore implémenté** en tant que couche dédiée : pas de `workflowOrchestratorService`, `operationalAlertService`, tables `workflow_tasks` / `operational_alerts` / `handoff_requests` / `transfer_requests`.

**Écarts P0 confirmés dans le code** (risques documentés dans le cahier V4) :

| Risque V4 | Statut dans le code | Gravité |
|-----------|---------------------|---------|
| Lit `cleaning` repasse `ready` à l’affectation | **Confirmé** — `assertBedAssignable` | P0 |
| Clôture / retour / transfert → lit source `ready` direct | **Confirmé** — `closeVisit`, `returnVisit`, `transferResource`, `completeVisit` | P0 |
| Priorité accueil confondue avec triage validé | **Confirmé** — `visits.priority` à l’enregistrement + UI `P{n}` sans distinction | P0 |
| Transfert atomique sans intention / confirmation physique | **Partiel** — transfert immédiat via `POST /api/care/visits/:id/transfer` | P1 |
| Alertes opérationnelles persistées (ack/résolution) | **Absent** — SLA chef calculé à la volée (`stuckAlerts`) | P1 |
| Suite de tests automatisés V4 | **Absent** — scripts manuels uniquement | P0 (process) |

**Phase 1** peut démarrer dès validation : corrections turnover lits + distinction priorité initiale / triage clinique, **sans migration destructive** sur Neon production.

---

## 2. Stack et structure vérifiées

| Couche | Technologie | Preuve |
|--------|-------------|--------|
| Frontend | React 19, Vite 8, Tailwind 4, React Router 7 | `frontend/package.json` |
| Backend | Node CommonJS, Express 4.21, `pg` 8.16 | `backend/package.json` |
| Auth | JWT + capacités par rôle | `backend/src/middleware/auth.js`, `backend/src/config/roles.js` |
| Temps réel | SSE `GET /api/events/stream` + polling 30s | `backend/src/routes/eventStreamRoutes.js`, `frontend/src/hooks/useVisitEventStream.js` |
| Migrations V3 | SQL additive | `backend/migrations/20261011_v3_smart_emergency_flow.sql`, `20261012_v3_exams_tasks.sql` |
| IA (optionnelle) | NIM, `agent_runs` / `agent_recommendations` | `backend/migrations/20261012_ai_agent_foundation.sql`, `backend/src/routes/aiRoutes.js` |

**Montage API :** préfixe `/api` (`backend/src/routes/index.js`).

---

## 3. Rôles et RBAC (invariant à préserver)

Cinq rôles : `receptionist`, `nurse`, `doctor`, `chief`, `admin` (`roles.js`).

Capacités notables (extrait) :

- **receptionist :** `register`, `call`, `critical`
- **nurse :** `place`, `return`, `start`, `fill`, `close`, `triage`, `critical`, capacités IA optionnelles
- **doctor :** `start`, `close`, `fill`, IA documentation/triage recommend
- **chief :** large superset (`register`, `place`, `close`, …, IA supervision)
- **admin :** `manage_users`, IA health/settings uniquement

**Divergence doc / commentaire :** `visitRoutes.js` indique « chief cannot place » alors que `ROLE_CAPABILITIES.chief` inclut `place`. **Le code RBAC autorise le chef à placer** — à clarifier avec le CHU (habilitation réelle).

**Délégation infirmier :** `close`, `fill`, `start` côté infirmier avec contrôles `roomAccessService` — conforme V3, **à valider institutionnellement** (cahier V4 §6).

---

## 4. Modèle de données (état réel)

### 4.1 Visites

- **`visits.status` (legacy) :** `waiting`, `placed`, `in_treatment`, statuts terminaux (`discharged`, `transferred`, `left_without_seen`, …).
- **`visits.care_stage` :** `registered`, `triage_pending`, `waiting_care`, `in_care`, `in_observation`, `disposition_pending`, `completed` (contrainte SQL V3).
- **Enregistrement actuel :** `status='waiting'`, `care_stage='triage_pending'`, `patient_location='waiting_area'`, **`priority` obligatoire 1–5** (`visitService.registerVisitTransaction`).
- **Pas de colonne** `initial_priority` / `triage_validated_at` : une seule colonne `priority` sert accueil **et** triage.

### 4.2 Triage

- Table **`triage_assessments`** : `assessment_type` ∈ `initial`, `reassessment`, `escalation`.
- **`POST /api/care/visits/:id/triage`** → `triageService.recordTriage` (chemin V3 complet : orientation, vitals, historique).
- **`PATCH /api/visits/:id/priority`** → `visitService.updateVisitPriority` (chemin legacy : insert `triage_assessments` type `initial` + event `triage_validated`).

Deux chemins peuvent valider une priorité — **cohérence UI/API à unifier en Phase 1**.

### 4.3 Lits et occupation

- **`beds.operational_status` :** `ready`, `cleaning`, `maintenance`, `blocked`, `out_of_service`.
- **`bed_assignments`** : occupation physique (`released_at IS NULL`).
- **Audit transitions lit :** `resource_status_events`.
- **Vue SQL :** `bed_board` (utilisée par `chiefService`).

### 4.4 Files / tâches / examens

- Worklists : **`queueService.js`** (7 listes).
- **`care_tasks`**, **`exams`** (migration V3 exams/tasks).
- **Pas de** `workflow_tasks` ni `operational_alerts`.

### 4.5 Événements et idempotence

- **`visit_events`** : types étendus V3 (triage, disposition, ressources, capacité, …).
- **`visitEventService`** : clé d’idempotence via `actionContext.idempotencyKey` (middleware `actorContext`).
- **Bus SSE :** `visitEventBus.js` (mémoire process).

---

## 5. Services backend — chemins exacts

| Service | Fichier | Rôle |
|---------|---------|------|
| Parcours visite legacy | `backend/src/services/visitService.js` | register, call, place, start, close, return, priority |
| Triage V3 | `backend/src/services/triageService.js` | recordTriage, critical, history |
| Files | `backend/src/services/queueService.js` | 7 worklists + tri SQL |
| Ressources / transfert | `backend/src/services/resourceService.js` | assignabilité lit, transfer, statut opérationnel |
| Lits disponibles | `backend/src/services/bedService.js` | filtre `operational_status = ready` + non occupé |
| Soins / clôture V3 | `backend/src/services/careService.js` | observation, disposition, completeVisit |
| Chef / SLA | `backend/src/services/chiefService.js` | pipeline, KPI, `stuckAlerts`, `bed_board` |
| Capacité | `backend/src/services/capacityService.js` | charge agrégée |
| Examens / tâches | `backend/src/services/examTaskService.js` | files examens |
| Équipes salle | `backend/src/services/staffService.js` | `room_teams`, `room_team_nurses` |
| Tableau public | `backend/src/services/boardService.js` | snapshot `/api/board` |
| IA | `backend/src/ai/*`, `pipelinePlacementService.js` | recommandations, **non requis V4** |

**Absents (cible V4) :** `workflowOrchestratorService`, `operationalAlertService`, `reassessmentService` (dédié), `handoffService`.

---

## 6. API REST — inventaire pertinent V4

### Visites (`/api/visits`)

| Méthode | Route | Capacité | Service |
|---------|-------|----------|---------|
| POST | `/register` | register | registerVisit |
| POST | `/:id/call` | call | callVisit (incrémente `call_count`, **ne retire pas de file**) |
| POST | `/:id/place` | place | placeVisit + `assertBedAssignable` |
| POST | `/:id/start` | start | startConsultation |
| PATCH | `/:id/priority` | triage | updateVisitPriority |
| POST | `/:id/close` | close | closeVisit |
| POST | `/:id/return` | return | returnVisit |
| GET | `/:id` | auth | getVisitDetails |

### Parcours V3 (`/api/care`)

| Méthode | Route | Notes |
|---------|-------|-------|
| GET | `/capacity` | charge |
| GET | `/queue/worklists` | via `queueRoutes` → `getAllWorklists` |
| POST | `/visits/:id/triage` | triage clinique |
| POST | `/visits/:id/transfer` | transfert lit **immédiat** |
| PATCH | `/resources/:bedId/status` | `setOperationalStatus` + audit |
| POST | `/visits/:id/complete` | clôture physique V3 |

### Files (`/api/queue`)

- `GET /worklists?reassessmentMinutes=` — seuil réévaluation (défaut **60** min, min 15).

### Chef (`/api/chief`) — rôle `chief` uniquement

- `GET /overview`, `GET /teams`, PUT/DELETE room team.

### Lits

- `GET /api/beds/available` — **uniquement** lits `ready` et libres (`bedService`).

### SSE

- `GET /api/events/stream?sinceId=` — auth SSE (`sseAuth.js`).

### Proposé V4 vs existant

| Proposition cahier V4 | État |
|----------------------|------|
| `GET /api/resources/board` | **Partiel** — données via `GET /api/chief/overview` (beds) et `listResourcesWithStatus` **non exposé** |
| `POST .../mark-cleaning` / `confirm-ready` | **Partiel** — générique `PATCH /api/care/resources/:bedId/status` |
| Transfert en 2 temps (request/confirm/cancel) | **Absent** |

---

## 7. Worklists — comportement vérifié

Tri commun (`queueService.js`) :

```sql
ORDER BY v.priority ASC, v.critical_flag DESC, v.arrived_at ASC, v.id ASC
```

| Liste | Filtre `care_stage` / autre |
|-------|-----------------------------|
| triage | `registered`, `triage_pending` |
| care | `waiting_care` |
| inCare | `in_care` |
| observation | `in_observation` |
| disposition | `disposition_pending` |
| reassessment | `waiting_care`, `in_care`, `in_observation` + **dernier triage > N min OU aucun triage** |
| exams | pending via `examTaskService` |

**Écart :** la file « À réévaluer » inclut les patients **sans aucune** ligne `triage_assessments` (`NOT EXISTS`), donc chevauchement conceptuel avec « À trier » pour certains cas. Phase 2 : affiner la règle (sans modifier P1–P5 automatiquement).

**Réévaluation :** aucune mutation automatique de `priority` — **conforme** au principe V4 ; seul l’humain via triage/priority patch.

---

## 8. Risques P0 — preuves code

### 8.1 `assertBedAssignable` force `ready`

Fichier : `backend/src/services/resourceService.js`

- Si `operational_status === 'cleaning'` → **UPDATE direct en `ready`** puis assignation.
- Si statut ≠ `ready` (hors maintenance/blocked/oos) → **UPDATE en `ready`**.

Impact : **`GET /api/beds/available` exclut** les lits non `ready`, mais **`placeVisit` et `transferResource`** contournent la policy via `assertBedAssignable`.

### 8.2 Libération lit → `ready` immédiat

| Action | Fichier | Ligne de comportement |
|--------|---------|------------------------|
| closeVisit | `visitService.js` | `UPDATE beds SET operational_status = 'ready'` après release |
| returnVisit | `visitService.js` | idem |
| transferResource (lit source) | `resourceService.js` | idem |
| completeVisit | `careService.js` | idem |

**Attendu V4 :** passage à `cleaning` (ou état turnover configuré), remise `ready` uniquement via acte autorisé (`setOperationalStatus` + audit).

### 8.3 Priorité accueil vs triage validé

- Enregistrement **exige** `priority` 1–5 et l’écrit dans `visits.priority`.
- Worklists et KPI **P1/P2** utilisent cette valeur **avant** tout `triage_assessments`.
- Frontend : `PriorityBadge` affiche `P{n}` partout (worklists, chef, accueil KPI) **sans** badge « non validé ».

**Exception partielle :** `VisitRecordTabs` distingue historique triage vs vide — pas le bandeau accueil global.

### 8.4 Escalade vitale / enregistrement différé

- Pas de parcours « escalade sans fiche complète » : champs obligatoires (nom, motif, priorité).
- `critical_flag` + `POST /care/visits/:id/critical` existent ; **pas de file d’alertes persistée** type `CRITICAL_ESCALATION`.

---

## 9. Frontend V4 UI refactor — état

Document : `PICU_V4_UI_UX_REFACTOR_IMPLEMENTATION.md` (refonte **UI**, pas workflow V4).

**Modifications présentes dans le dépôt (git status) :** composants chief refactorés (`ChiefKpiBar`, `ChiefResourceOverviewPanel`, `PatientWorklistTable`, `StatusBadge`, pages dashboards, etc.), rapport `docs/PICU_V4_UI_TEST_REPORT.md`.

**Contrainte UI doc :** ne pas changer logique clinique backend dans la phase UI — **cohérent** avec enchaînement Phase 0 → Phase 1 workflow.

**Écarts UI vs cible V4 workflow :**

- Pas de panneau « Actions prioritaires » alimenté par moteur déterministe (SLA chef = proxy).
- Pas d’états ack/résolution alertes.
- Turnover lit : actions via PATCH statut si exposé dans l’UI (à vérifier par écran infirmier) — pas de workflow « confirm-ready » dédié.

---

## 10. Tests et validation — état

| Artefact | Présent |
|----------|---------|
| Tests unitaires/intégration backend (Jest/Vitest) | **Non** (`backend/package.json` sans script test) |
| `backend/src/scripts/testEndpoints.js` | Manuel |
| Frontend lint (`oxlint`) | Oui |
| Playwright / CI tests V4 | **Non** dans ce dépôt |
| Benchmark triage IA | `benchmarks/run-triage-benchmark.js` (hors périmètre V4 déterministe) |

**Phase 6** devra introduire une suite minimale (au moins tests service turnover + triage + concurrence lit) exécutable en environnement isolé.

---

## 11. IA vs V4 déterministe

- L’IA **n’est pas requise** pour le fonctionnement ; feature flags / `service_ai_settings`.
- Recommandations = **`agent_recommendations`** (accept/reject humain) — **distinct** du contrat V4 « recommendation opérationnelle » (`source: deterministic_rule`).
- Shadow triage à l’enregistrement (`triage-shadow-trigger`) : asynchrone, ne modifie pas la priorité — **OK** si IA désactivée.

V4 doit **ajouter** une couche déterministe **sans remplacer** la couche IA existante.

---

## 12. Divergences document V3 (CHU analysis) vs code

| Affirmation doc | Code réel |
|-----------------|-----------|
| Chief ne peut pas placer | **`place` dans capacités chief** |
| Endpoints `/api/resources/*` legacy | **Non montés** ; modèle actuel = `/api/care` + `/api/beds` |
| 22 tables + vues | À recompter lors migrations ; **`bed_board` view** confirmée usage chef |
| Tests automatisés robustes | **Non vérifiés** — gap majeur |

Le **Markdown V3 n’est pas preuve d’exécution** ; ce document privilégie les chemins fichiers ci-dessus.

---

## 13. Décisions CHU — non connues (ne pas inventer)

À valider institutionnellement avant paramètres « officiels » :

1. Définitions et SLA **P1–P5** (le frontend affiche des libellés indicatifs dans `StatusBadge.jsx`).
2. Intervalle de **réévaluation** (60 min = paramètre technique actuel).
3. Restrictions de **salles / types de ressources** par orientation.
4. Habilitations **infirmier vs médecin** (close, disposition, prescription).
5. Protocole **escalade vitale** hors système (téléphone, code bleu).
6. Workflow **hygiène** (un ou deux acteurs pour `cleaning` → `ready`).
7. Critères de **transfert inter-service** et délais disposition.

---

## 14. Stratégie de migration recommandée (Phases 1–3)

1. **Phase 1 (sans tables obligatoires) :**
   - Corriger `assertBedAssignable`, `closeVisit`, `returnVisit`, `transferResource`, `completeVisit` → turnover `cleaning`.
   - Ajouter colonnes **additives** si nécessaire : ex. `visits.registration_priority`, `visits.clinical_priority_validated_at` ou flag `triage_status` — **choix à trancher en Phase 1** (préférer additive + backfill safe).
   - API explicite `confirm-ready` (peut wrapper `setOperationalStatus` avec règles).
2. **Phase 2 :** enrichir worklists + `reassessmentService` + settings (`workflow_settings`).
3. **Phase 3 :** `transfer_requests`, `handoff_requests` + services associés.
4. **Phase 4 :** `operational_alerts` + vues chef.
5. **Phase 5–6 :** UI branchements + tests.

**Ne pas exécuter** de migration sur Neon production sans approbation explicite.

---

## 15. Prochaine action agent (Phase 1)

Ordre proposé :

1. Corriger invariants lits (P0) + tests ciblés.
2. Séparer affichage/API priorité initiale vs triage validé (P0).
3. Rédiger `docs/v4/01_SAFETY_AND_RESOURCE_CHANGES.md` avec diffs et tests exécutés.

**Blocage :** aucun pour démarrer Phase 1 sur branche de dev / base locale ou branche Neon **de test** ; **stop** si seule la prod est disponible.

---

## 16. Index de preuves (fichiers clés)

| Sujet | Fichier |
|-------|---------|
| Assignabilité lit | `backend/src/services/resourceService.js` |
| Placement | `backend/src/services/visitService.js` (`placeVisit`) |
| Clôture | `backend/src/services/visitService.js`, `careService.js` |
| Worklists | `backend/src/services/queueService.js` |
| Triage | `backend/src/services/triageService.js` |
| RBAC | `backend/src/config/roles.js` |
| SSE | `backend/src/routes/eventStreamRoutes.js` |
| Schéma V3 | `backend/migrations/20261011_v3_smart_emergency_flow.sql` |
| UI priorité | `frontend/src/components/ui/StatusBadge.jsx` |
| Cahier maître V4 | `PICU_V4_SMART_EMERGENCY_WORKFLOW_AGENT_PROMPT.md` |

---

*Phase 0 terminée — aucune mutation code ou base effectuée lors de cet audit.*
