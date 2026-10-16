# PICU — Matrice de traçabilité du workflow

Chaîne de traçabilité : **Exigence → UI (écran/action) → API (méthode + endpoint) → Middleware (capacité/rôle) → Service → Table(s) → Événement SSE → Test**.
Légende statut : ✅ observé/testé · 🟡 partiel · ⚫ absent/non testé.

| # | Exigence métier | UI (action) | API | Middleware | Service | Tables | Événement | Test |
|---|-----------------|-------------|-----|-----------|---------|--------|-----------|------|
| E1 | Enregistrer un patient + visite | `RegisterPatientModal` / `AccueilDashboardPage` | `POST /api/visits/register` | `requireCapability('register')` | `visitService.registerVisitTransaction` | `patients`, `visits`, `visit_events` | `registered` | 🟡 `registration-intelligence.test.js` |
| E2 | Rechercher / dédupliquer (CIN) | `useRegistrationFlow` | `GET /api/visits/register/preflight` | `requireCapability('register')` | `registrationIntelligenceService.lookupPatientForRegistration` | `patients`, `visits` | — | 🟡 idem |
| E3 | Indices d'enregistrement (non cliniques) | `RegisterPatientModal` | `GET /api/visits/register/hints` | `requireCapability('register')` | `config/registrationHints.buildRegistrationHints` | — | — | ✅ `registration-intelligence.test.js` |
| E4 | Triage / priorité P1–P5 | `NurseTriagePanel` | `POST /api/care/visits/:id/triage` | `requireCapability('triage')` | `triageService.recordTriage` | `visits`, `triage_assessments`, `visit_events` | `triage_completed`, `priority_changed` | ⚫ |
| E5 | Historique de triage | `NurseTriagePanel` | `GET /api/care/visits/:id/triage-history` | auth seule | `triageService.listTriageHistory` | `triage_assessments`, `users` | — | ⚫ |
| E6 | Marquer critique | `ChiefVisitDrawer`/Nurse | `POST /api/care/visits/:id/critical` | `requireCapability('critical')` | `triageService.setCriticalFlag` | `visits`, `visit_events` | `critical_flag_set` | ⚫ |
| E7 | Appeler patient | `AccueilQueueList` | `POST /api/visits/:id/call` | `requireCapability('call')` | `visitService.callVisit` | `visits`, `visit_events` | `called` | ⚫ |
| E8 | File d'attente / worklists | `WorklistsPanel` | `GET /api/queue/worklists` | auth seule | `queueService.getAllWorklists` | `visits`, `triage_assessments`, `exams` | — | ⚫ |
| E9 | Board accueil (vue SQL) | `AccueilDashboardPage` | `GET /api/board` | `authenticateJwt` | `boardService.getBoardSnapshot` | vues `waiting_board`, `bed_board` | — | ⚫ |
| E10 | Affecter un lit | `NurseQuickPlaceModal`/`BedPlanPanel` | `POST /api/visits/:id/place` | `requireCapability('place')` | `visitService.placeVisit` | `beds`, `bed_assignments`, `visits`, `visit_events` | `placed` | ⚫ |
| E11 | Ressource éligible (prête/libre) | `EligibleResourcePicker` | `GET /api/resources/eligible` | `requireCapability('place')` | `resourceManagementService.listEligibleResourcesForVisit` | `beds`, `rooms`, `zones`, `room_teams` | — | ⚫ |
| E12 | Transferer de lit | workflow UI | `POST /api/care/visits/:id/transfer` | `requireCapability('place')` | `resourceService.transferResource` | `bed_assignments`, `beds`, `visits`, `visit_events` | `resource_transferred` | ⚫ |
| E13 | Demander transfert (V4) | `ChiefPipelinePlacement` | `POST /api/workflow/visits/:id/transfer-requests` | `requireCapability('place')` | `transferRequestService.createTransferRequest` | `transfer_requests`, `visit_events` | `transfer_requested` | ⚫ |
| E14 | Confirmer transfert (V4) | workflow UI | `POST /api/workflow/transfers/:id/confirm` | `requireCapability('place')` | `transferRequestService.confirmTransferRequest` → `transferResource` | `transfer_requests`, `bed_assignments` | `transfer_confirmed` | ⚫ |
| E15 | Libérer/remise en service lit | `BedPlanPanel` | `POST /api/resources/:bedId/confirm-ready` | `requireCapability('place')` | `resourceService.confirmBedReady` | `beds`, `resource_status_events`, `visit_events` | `bed_ready_confirmed` | ⚫ (destructif) |
| E16 | État opérationnel lit (maintenance…) | `ResourceDetailsDrawer` | `POST /api/resources/:bedId/operational-status` | `requireCapability('place')` | `resourceService.setOperationalStatus` | `beds`, `resource_status_events` | `resource_status_changed` | ⚫ (destructif) |
| E17 | Démarrer consultation | `ChiefVisitDrawer`/Doctor | `POST /api/visits/:id/start` | `requireCapability('start')` | `visitService.startConsultation` | `consultations`, `visits`, `visit_events` | `consultation_started` | ⚫ |
| E18 | Compléter consultation | `VisitCareFlowPanel` | `PATCH /api/visits/:id/consultation` | `requireCapability('fill')` | `visitService.updateConsultation` | `consultations`, `visit_events` | `consultation_updated` | ⚫ |
| E19 | Observation | workflow UI | `POST /api/care/visits/:id/observation/start` `/end` | `requireCapability('start')` | `careService.startObservation/endObservation` | `visits`, `visit_events` | `observation_started/ended` | ⚫ |
| E20 | Décision d'issue | workflow UI | `POST /api/care/visits/:id/disposition` | `requireCapability('close')` | `careService.decideDisposition` | `visits`, `visit_events` | `disposition_decided` | ⚫ |
| E21 | Clôturer la visite | `ChiefVisitDrawer` | `POST /api/care/visits/:id/complete` | `requireCapability('close')` | `careService.completeVisit` | `visits`, `bed_assignments`, `consultations`, `visit_events` | `closed` | ⚫ |
| E22 | Clôture directe legacy | `ChiefVisitDrawer` | `POST /api/visits/:id/close` | `requireCapability('close')` | `visitService.closeVisit` | `visits`, `bed_assignments`, `consultations` | `closed` | ⚫ |
| E23 | Retour en attente | workflow UI | `POST /api/visits/:id/return` | `requireCapability('return')` | `visitService.returnVisit` | `bed_assignments`, `visits` | `returned` | ⚫ |
| E24 | Prescrire / compléter examen | `VisitRecordTabs` | `POST /api/care/visits/:id/exams`, `/exams/:id/complete` | `requireCapability('fill')` | `examTaskService.requestExam/completeExam` | `exams`, `visit_events` | `exam_requested/completed` | ⚫ |
| E25 | Tâche de soin | workflow UI | `POST /api/care/visits/:id/tasks` | `requireCapability('fill')` | `examTaskService.createCareTask` | `care_tasks`, `visit_events` | `task_created/done` | ⚫ |
| E26 | Passage de relais (handoff) | `TeamCoordinationPanel` | `POST /api/workflow/visits/:id/handoffs`, `/handoffs/:id/respond` | `fill` (create) / auth (respond) | `handoffService` | `handoff_requests` | ⚫ **aucun visit_event** | ⚫ |
| E27 | Supervision chef (snapshot) | `ChiefDashboardPage` | `GET /api/workflow/supervision` | `requireRole('chief')` | `workflowOrchestratorService.getSupervisionSnapshot` | `visits`, `operational_alerts` | — | ⚫ |
| E28 | KPI supervision | `useSupervisionDashboard` | `GET /api/chief/supervision/overview` … | `requireRole('chief')` (hérité) | `supervisionProjectionService` | vues, `operational_alerts` | — | ⚫ |
| E29 | Alertes opérationnelles | `OperationalAlertCenter` | `GET /api/workflow/alerts`, `/alerts/:id/acknowledge` | auth / `chief|nurse` | `operationalAlertService` | `operational_alerts`, `operational_alert_events` | — | 🟡 `supervision-rules.test.js` (règles) |
| E30 | Goulots | `BottleneckPanel` | `GET /api/chief/supervision/bottlenecks` | `requireRole('chief')` | `bottleneckDetectionService` | worklists | — | ⚫ |
| E31 | Analytique patients | `PatientAnalyticsPanel` | `GET /api/chief/analytics/patients` | `requireRole('chief')` | `patientAnalyticsService` | `visits`, `patients`, `consultations` | — | ✅ `patient-analytics.test.js` |
| E32 | Placement pipeline (IA) | `ChiefPipelinePlacement` | `POST /api/ai/bed-flow/pipeline/plan` `/apply` | `requireRole('chief')` | `pipelinePlacementService` → `visitService.placeVisit` | `beds`, `bed_assignments` | `resource_assigned` via place | ⚫ |
| E33 | Recommandation triage IA (shadow) | panneaux IA chef | `POST /api/ai/triage/recommend` | `requireCapability('ai_triage_recommend')` + guard | `ai/agents/triage-agent` | `agent_runs`, `agent_recommendations` | — | ⚫ |
| E34 | Approuver/exécuter action IA | `ChiefAiModePanel` | `POST /api/ai/approvals/:id/approve` | **auth seule** (⚠️ P0-03) | `action-gateway.executeApprovedAction` → `visitTools` | cibles réelles (`visits`, `beds`…) | selon outil | ⚫ |
| E35 | Équipes de salle | `ChiefTeamsBoard` | `PUT /api/chief/rooms/:roomId/team` | `requireRole('chief')` | `staffService` | `room_teams`, `room_team_nurses` | — | ⚫ |
| E36 | Gestion comptes | `AdminPage` | `/api/users/*` | `requireRole('admin')` | `userService` | `users` | — | ⚫ |
| E37 | Temps réel | tous dashboards | `GET /api/events/stream` (SSE) | `authenticateSse` | `visitEventBus`/`eventStreamService` | `visit_events` | `visit_event` | ⚫ |
| E38 | Réglage intervalle réévaluation | `ChiefAiModePanel`/chef | `PUT /api/workflow/settings/reassessment-minutes` | `requireRole('chief','admin')` | `workflowSettingsService.updateSetting` | `workflow_settings` | — | ⚫ |

## Journalisation / audit (traçabilité)

| Élément | Table | Auteur | Avant/Après | Corrélation | Preuve |
|---------|-------|--------|-------------|-------------|--------|
| Actions visite | `visit_events` | `actor_user_id`/`actor_type` | `from_status`/`to_status` + `metadata` | `idempotency_key`, `agent_run_id` | `visitEventService.js:73-112` |
| Statut lit | `resource_status_events` | `actor_user_id` | `from_status`/`to_status` + `note` | — | `resourceService.js:11-31` |
| Alertes | `operational_alert_events` | `actor_user_id` | transitions statut | `dedupe_key` | `operationalAlertService.js:57-67` |
| Handoff | — | — | — | — | **absent** (trou) |
| Log applicatif | console | — | — | — | `visitActionLogger.js` |

## Couverture

- Exigences tracées : **38**.
- Endpoints avec test automatisé : **3/38** (E3, E31, E29 partiel).
- Événements SSE produits : `registered, called, placed, returned, triage_completed, triage_validated, triage_reassessed, priority_changed, critical_flag_set, consultation_started/updated, care_started, observation_started/ended, resource_transferred/released, bed_turnover_started, bed_ready_confirmed, disposition_decided, exam_requested/completed, task_created/completed, closed, capacity_*`, plus `resource_status_changed` (bus direct).
