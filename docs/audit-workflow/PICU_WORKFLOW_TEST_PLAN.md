# PICU — Plan de tests du workflow

Objectif : vérifier les invariants du workflow et les correctifs de sécurité, **sans muter de données réelles**.
Environnement : PostgreSQL isolé (conteneur éphémère ou branche Neon de test), jeu de données dédié, réinitialisé entre scénarios.

## 0. État de l'existant (constaté)

| Script | Commande | Nature | DB | Cas | Exécuté en audit |
|--------|----------|--------|----|-----|------------------|
| supervision | `npm run test:supervision` | pur | non | 1 | ✅ PASS |
| patient-analytics | `node --test src/tests/patient-analytics.test.js` | pur | non | 4 | ✅ PASS |
| registration-intelligence | `node --test src/tests/registration-intelligence.test.js` | pur + 1 requête | oui (gated) | 5 | ✅ PASS |
| v4-safety | `npm run test:v4` | **mutant** | oui | 3 | ⚫ NON EXÉCUTÉ |

Absences : **0** test frontend, **0** test E2E, **0** typecheck, **0** test de concurrence réel.

---

## 1. Tests unitaires (sans base)

| ID | Cible | Scénario | Attendu |
|----|-------|----------|---------|
| U-01 | `careStage.assertCareStageTransition` | chaque paire de la matrice `careStage.js:74-82` (autorisée + interdite) | autorisée = no-op ; interdite = throw |
| U-02 | `careStage.legacyStatusFromCareStage` | 7 états | mapping attendu et **cohérent** avec `status` écrit par les services |
| U-03 | `visitPriority` | mapping entrée 1–5 → priorité/clinique, `critical_flag` | idempotent, borné |
| U-04 | `supervisionRulesService.evaluate` | seuil non validé, seuil validé, zone inconnue | rejets documentés (déjà couvert) |
| U-05 | `patientAnalyticsService` | helpers purs | (déjà couvert) |
| U-06 | `buildRegistrationHints` | nationalité, âge, mineur | (déjà couvert) |
| U-07 | `roleHasCapability` | matrice rôles × capacités `roles.js:1-33` | conforme, `chief` a bien `place` |
| U-08 | `assertAiRouteAllowed` | mode `full_control_simulation` | bloque hors visites de démo |

## 2. Tests d'intégration API (base isolée)

| ID | Endpoint | Préconditions | Attendu | Priorité |
|----|----------|---------------|---------|----------|
| I-01 | `POST /api/auth/register {role:'chief'}` | — | **403/400** après P0-01 | 🔴 |
| I-02 | démarrage serveur sans `JWT_SECRET` | env sans secret | **échec de démarrage** après P0-02 | 🔴 |
| I-03 | `POST /api/ai/approvals/:id/approve` (role `receptionist`) | approbation pending | **403** après P0-03 | 🔴 |
| I-04 | `POST /api/ai/approvals/:id/approve` (role habilité + capacité) | approbation pending | 200 + mutation + `visit_events` | 🔴 |
| I-05 | `POST /api/visits/register` ×2 pour le même patient | patient existant actif | 2e = **409** | 🟠 |
| I-06 | `POST /api/visits/:id/place` sur lit `cleaning` | lit nettoyage | **409**, message remise en service | 🟠 |
| I-07 | `POST /api/visits/:id/place` sur lit libre `ready` | — | 201, lit `bed_assignments` actif, `visits.status=placed` | 🟠 |
| I-08 | `POST /api/visits/:id/place` déjà placé | visite `placed` | **409/400** | 🟠 |
| I-09 | `confirmBedReady` sur lit `cleaning` libre | — | lit `ready` | 🟠 |
| I-10 | `POST /api/resources/:id/operational-status {status:'ready'}` | lit `cleaning` | **422** (passer par confirm-ready) | 🟠 |
| I-11 | `POST /api/visits/:id/close` outcome `discharged` | visite `in_treatment` | terminal, `closed_at` non nul, lit → `cleaning` | 🟠 |
| I-12 | `POST /api/visits/:id/close` outcome `admitted` | idem | **routé vers `decideDisposition`** | 🟠 |
| I-13 | `POST /api/visits/:id/close` depuis `waiting` outcome `discharged` | visite `waiting` | refusé (uniquement outcomes « left ») | 🟠 |
| I-14 | `POST /api/visits/:id/return` | visite `placed` | `status=waiting`, care_stage `waiting_care`, lit libéré → cleaning | 🟠 |
| I-15 | `POST /api/care/visits/:id/complete` sans outcome | visite `disposition_pending` | **400** | 🟠 |
| I-16 | `POST /api/care/visits/:id/triage` priority 6 | — | **400** | 🟠 |
| I-17 | `POST /api/care/visits/:id/triage` priority 5→2 | `clinical_priority_validated_at` | `priority` maj + `priority_changed` émis | 🟠 |
| I-18 | `POST /api/workflow/visits/:id/transfer-requests` ×2 concurrents | aucune pending | **1 seule** pending après P1-02 | 🟠 |
| I-19 | `POST /api/workflow/transfers/:id/confirm` ×2 concurrents | 1 demande pending | 1er = transfert ; 2e = **409/idempotent** après P1-02 | 🟠 |
| I-20 | `POST /api/workflow/visits/:id/handoffs` | `fill` | `handoff_requests` + **`visit_events`** après P1-03 | 🟠 |
| I-21 | `POST /api/visits/:id/start` sans lit (non critique) | visite waiting_care | **400** | 🟡 |
| I-22 | `POST /api/visits/:id/start` sans lit (critical) | critical_flag | autorisé | 🟡 |
| I-23 | `GET /api/visits/:id` PII | auth ≠ titulaire | **403** après P2-05 | 🟠 |
| I-24 | `PUT /api/workflow/settings/reassessment-minutes` value 5 | — | **422** (plancher 15) | 🟡 |
| I-25 | `GET /api/events/stream` sans jeton | — | **401** | 🟡 |

## 3. Tests de concurrence / intégrité base

| ID | Scénario | Attendu |
|----|----------|---------|
| C-01 | 2 `place` simultanés sur **le même lit** (2 connexions) | 1 succès, 1 échec 409 ; **jamais** 2 `bed_assignments` actifs |
| C-02 | 2 `place` simultanés du **même patient** sur 2 lits | 1 succès ; violation `visits_one_active_per_patient_idx` empêchée |
| C-03 | 2 `transfer-plan` simultanés | 1 seule demande pending (après P1-02) |
| C-04 | `place` pendant un `release` du même lit | pas de `bed_assignment` orphelin (validé par index partiel) |
| C-05 | REPLAY d'un même `idempotency-key` sur `place` | 1 seule mutation |

## 4. Tests de bout en bout (E2E, base isolée)

| ID | Parcours | Étapes | Attendu |
|----|----------|--------|---------|
| E2E-01 | Accueil → file | enregistrer → appel → apparaît dans worklist `triage` | statut `waiting`/`triage_pending`, SSE `registered`+`called` |
| E2E-02 | Triage → care | triage initial → worklist `care` | `care_stage=waiting_care`, SSE `triage_completed` |
| E2E-03 | Placement → consultation | place → start → fill | `placed→in_treatment`, `consultations` ouverte |
| E2E-04 | Sortie | close discharged | `closed_at`, lit `cleaning`, SSE `closed` |
| E2E-05 | Remise en service | confirm-ready | lit `ready`, réutilisable |
| E2E-06 | LWBS | close `left_before_seen` depuis waiting | terminal, pas de consultation |
| E2E-07 | Transfert V4 | transfer-request → confirm | nouvelle affectation, ancien lit cleaning |
| E2E-08 | Handoff | create → accept | `handoff_requests` répondue + journal |

## 5. Tests frontend (à créer — 0 existant)

| ID | Cible | Attendu |
|----|-------|---------|
| F-01 | `useVisitEventStream` | reconnexion, curseur `sessionStorage`, dédup, fallback polling |
| F-02 | `RegisterPatientModal` | validation, dédup CIN, toasts d'erreur 409 |
| F-03 | `WorklistsPanel` | tri visuel = tri serveur (`priority ASC, critical DESC, arrived_at`) |
| F-04 | `EligibleResourcePicker` | n'affiche que `ready` libres de la zone |
| F-05 | `StatusBadge` | cohérence libellés `care_stage`/statuts |

## 6. Tests de sécurité

| ID | Cible | Attendu |
|----|-------|---------|
| S-01 | Jeton signé avec le secret de repli | rejeté après P0-02 |
| S-02 | RBAC par capability sur chaque route mutante | 403 si capacité absente |
| S-03 | Jeton SSE absent de l'URL après P2-01 | jeton uniquement en en-tête |
| S-04 | CORS origine non autorisée | bloqué après P2-02 |
| S-05 | Injection SQL sur filtres (`zone`, `status`) | requêtes paramétrées (revue + fuzz léger) |

## 7. Critères de sortie

- 100 % des tests P0/I-01..I-04 verts avant toute mise en production.
- C-01 et C-02 obligatoires (intégrité lit/patient).
- E2E-01..E2E-05 en intégration continue.
- Aucune modification d'un test destructif exécuté sur une base partagée.

## 8. Matériel de test requis (à créer)

- Fabrique d'API isolée (comme dans `v4-safety.test.js`) pointant vers **une base de test dédiée**.
- Jeu de données minimal (`scripts/seed` ou transaction annulée).
- Runner CI : lint backend, lint frontend, tests unitaires purs, puis tests intégration sur base éphémère.
