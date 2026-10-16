# PICU — Analyse d'écarts V3 / V4

Comparaison entre le **workflow cible V3** (`docs/PROCESSUS-URGENCES-V3.md`), la **couche V4** (supervision, workflow intelligent, IA — `PICU_V4_*`) et l'**implémentation réelle** du dépôt.

Légende : ✅ Implémenté · 🟡 Partiel · ⚫ Absent/Prévu non réalisé · ⚠️ Déviation.

---

## 1. Gap V3 — du processus cible à l'implémentation

| # | Capacité V3 | État | Preuve / écart |
|---|-------------|------|----------------|
| V3-01 | Enregistrement rapide + déduplication patient (CIN) | ✅ | `visitService.registerVisitTransaction`, `registrationIntelligenceService` |
| V3-02 | Priorité 1–5 sur l'enregistrement | ✅ | `visits.priority`, `visitRoutes.js:73-80` |
| V3-03 | Triage non bloquant (IA miroir + validation infirmier) | ✅ | `care_stage=triage_pending` à l'inscription ; `triageService` |
| V3-04 | `care_stage` V3 à 7 états | ✅ | `careStage.js:3-11`, contrainte base |
| V3-05 | Orientation automatique (salle + médecin) | 🟡 | `roomAccessService`/`room_teams` présents ; l'auto-routage « Appeler & orienter » décrit dans `context.md` §5.2 doit être revérifié (le code réel place plutôt via `place`/`transfer`) |
| V3-06 | Gestion file d'attente stricte par worklists | ✅ | `queueService.getAllWorklists` |
| V3-07 | Consultation début/fin + clôture | ✅ | `startConsultation`, `closeVisit`, `completeVisit` |
| V3-08 | Ressources hiérarchiques zones/rooms/beds | ✅ | schéma confirmé |
| V3-09 | Occupation lit + turnover (`cleaning`) | ✅ | `resourceService.releaseBedToTurnover` |
| V3-10 | Exécution d'événements temps réel | ✅ (SSE) | `eventStreamRoutes` — mais **SSE, pas Socket.IO** (déviation vs `context.md`) |
| V3-11 | Audit trail complet (`visit_events`) | 🟡 | présent, **handoffs non journalisés** (P1-03) |
| V3-12 | Examens / tâches | ✅ | `examTaskService`, `exams`, `care_tasks` |
| V3-13 | Vue board (`waiting_board`, `bed_board`) | ✅ | vues SQL confirmées |
| V3-14 | Contrôle strict des transitions d'état | ⚠️ | matrice définie mais **contournée par `visitService`** (P1-01) |
| V3-15 | Identité/sécurité des accès | ⚠️ | P0-01/02/03 |

**Synthèse V3** : cœur métier en place ; écarts majeurs sur la **cohérence de la machine à états** (V3-14) et la **sécurité** (V3-15).

---

## 2. Gap V4 — couche supervision / workflow intelligent / IA

> Constat transverse : **une grande partie du V4 n'est pas committée** (working tree « dirty », fichiers untracked) ; l'état réel est donc en avance sur HEAD `69e2b4c`.

| # | Capacité V4 attendue | État | Preuve / écart |
|---|----------------------|------|----------------|
| V4-01 | Colonne `care_stage` + `outcome` + `current_orientation` | ✅ | base + `careStage.js` |
| V4-02 | Worklists dérivées (triage/care/inCare/observation/disposition/reassess/exams) | ✅ | `queueService.js:67-134` |
| V4-03 | Demandes de transfert (`transfer_requests`) | 🟡 | service présent, **non atomique** (P1-02), UI partielle |
| V4-04 | Handoffs (passage de relais) | 🟡 | `handoffService` présent, **sans journalisation** (P1-03), UI partielle |
| V4-05 | Alertes opérationnelles (`operational_alerts`) | ✅ | `operationalAlertService`, dedupe confirmé |
| V4-06 | Règles de supervision (goulots/bottlenecks) | 🟡 | `bottleneckDetectionService` présent, **seuils désactivés / non approuvés** |
| V4-07 | Projections supervision (overview, KPI, zones, throughput) | 🟡 | `supervisionProjectionService` présent, pas de tests |
| V4-08 | Command center chef | 🟡 | `ChiefDashboardPage` + secteurs présents, maturité inégale |
| V4-09 | IA triage (recommandation) | ✅ shadow | `src/ai/agents/triage-agent` + `agent_runs/recommendations` |
| V4-10 | IA flow / placement pipeliné | 🟡 | `pipelinePlacementService` ; **apply sans guard** (P2-07) |
| V4-11 | IA documentation / résumés | 🟡 | agents présents (`src/ai/agents/**`), maturité non testée |
| V4-12 | Gouvernance actions IA (approbations) | 🟡 | `agent_approvals` + `action-gateway`, **approve sans capacité** (P0-03) |
| V4-13 | Registre d'outils agent (`visitTools`) | ✅ | `visitTools.js:17-30` |
| V4-14 | Paramétrage professionnel (`workflow_settings`, `service_ai_settings`) | 🟡 | tables + `workflowSettingsService` ; UI partielle ; intervalles non validés cliniquement |
| V4-15 | Réévaluation planifiée (`reassessment_interval_minutes`) | 🟡 | logique worklist présente ; pas de job/planificateur automatique |
| V4-16 | Publication temps réel des transitions IA/workflow | 🟡 | événements présents, mais **bus mémoire** (P2-03) |
| V4-17 | Nettoyage/remise en service des lits orchestré | ✅ | `confirmBedReady`, pas de `ready` automatique |
| V4-18 | Mode « full control simulation » (bac à sable IA) | 🟡 | guard existe, appliqué inégalement (P2-07) |

**Synthèse V4** : fondations livrées (schéma, worklists, alertes, agents IA, pipeline) ; les **comportements de coordination V4** (transferts, handoffs, automatisations) sont **partiels et non transactionnels**, la **gouvernance IA** est **incomplète**, et l'ensemble n'est **pas testé**.

---

## 3. Déviation de documentation

| Document | Affirmation | Réalité |
|----------|-------------|---------|
| `context.md` §2/§7 | « Socket.IO client/server » | **SSE** (`/api/events/stream`), aucun Socket.IO |
| `context.md` §3/§8 | `AuthContext`/`AppContext`, `RoleDashboard.jsx`, `useDashboardData` | Absents / renommés |
| `context.md` §6/§9 | `/api/patients`, `/api/triage`, tables `emergency_visits`, `resource_assignments`, `queue` | Réel : `visits`, `triage_assessments`, `bed_assignments`, worklists dérivées |
| `context.md` §6 | contrainte `chk_visit_status` (waiting/triaged/…) | Réel : `visits_status_check` (waiting/placed/in_treatment/discharged/transferred/left_without_seen) |
| `context.md` §11 | « Fix 2026-07-15 resources/assign → resource_assignment » | Table `resource_assignments` inexistante ; modèle actuel `bed_assignments` |
| `docs/E2E-V3-DEMO.md` | Parcours démo manuel | Pas de test automatisé correspondant |

---

## 4. Dette technique liée aux écarts

1. **Deux machines à états** (`status` legacy + `care_stage`) sans contrainte DB de cohérence → risque de dérive (P1-01).
2. **`legacyStatusFromCareStage` inutilisé** → mapping mort, pouvant masquer des incohérences.
3. **Frontend duplique** la classification des statuts (au moins 4 emplacements) → divergence d'affichage.
4. **Schéma de base non versionné** → V3/V4 non reconstructibles depuis le dépôt (P2-04).
5. **Tests absents** pour la quasi-totalité du V3/V4 (voir plan de tests).

---

## 5. Priorisation des écarts

| Ordre | Écart | Action |
|-------|-------|--------|
| 1 | Sécurité (P0-01/02/03) | corriger avant toute démo/prod |
| 2 | Atomicité transferts/handoffs (P1-02) | transaction + index unique partiel |
| 3 | Machine à états unique (P1-01/V3-14) | appliquer `assertCareStageTransition` partout |
| 4 | Journalisation handoffs (P1-03) | émettre `visit_events` |
| 5 | Gouvernance IA (P0-03/V4-12) | capacité + guard sur approbations/apply |
| 6 | Versionnement du schéma (P2-04) | migration baseline |
| 7 | Tests V3/V4 (P2-09) | plan de tests §2–§4 |
| 8 | Documentation (déviations) | réécrire `context.md` |
