# PICU — Registre des risques du workflow

Classification : **P0** (sécurité/intégrité critique) · **P1** (blocage métier important) · **P2** (robustesse/qualité) · **P3** (ergonomie/maintenabilité).
Chaque constat : ID, sévérité, scénario, cause, preuve, impact, correction, test de non-régression, dépendances, statut.

Statuts de vérification : **Confirmé (code)** · **Confirmé (base)** · **Confirmé (test)** · **Hypothèse**.

---

## P0 — Sécurité / intégrité critique

### P0-01 — Inscription publique permettant d'obtenir un rôle `chief`

- **Sévérité** : 🔴 P0
- **Statut** : Confirmé (code) + Confirmé (base, rôle accepté)
- **Scénario** : `POST /api/auth/register { role: "chief", ... }` → renvoie `201` avec `token` JWT d'un compte `chief` actif, sans validation d'administrateur.
- **Cause** : `PUBLIC_REGISTER_ROLES = ['receptionist','nurse','doctor','chief']` et route sans middleware.
- **Preuves** : `backend/src/routes/authRoutes.js:47-54` ; `backend/src/services/authService.js:7,182-208`.
- **Impact** : escalade de privilèges ; accès total supervision/workflow/IA ; création de comptes fictifs.
- **Correction** : retirer `chief` (et idéalement restreindre à un flux d'invitation admin) ; n'autoriser l'inscription publique qu'avec validation ; journaliser.
- **Test de non-régression** : `POST /auth/register {role:'chief'}` doit renvoyer 400/403 ; tests des 4 rôles.
- **Dépendances** : `authService`, `authRoutes`, UI `RegisterPage`.
- **Vérification** : à refaire après correctif.

### P0-02 — Secret JWT de repli codé en dur

- **Sévérité** : 🔴 P0
- **Statut** : Confirmé (code). `JWT_SECRET` est **défini** dans `backend/.env` (présence vérifiée sans afficher la valeur), mais le repli reste une bombe à retardement.
- **Scénario** : si `JWT_SECRET` est absent/vide (nouvel environnement, oubli de config), tout jeton signé avec `super_secret_picu_jwt_key_2026_safe_change` est accepté → forge de jeton `chief`/`admin`.
- **Preuves** : `backend/src/middleware/auth.js:14` ; `backend/src/middleware/sseAuth.js:18` ; `backend/src/services/authService.js:10`.
- **Impact** : contournement total d'authentification et de RBAC.
- **Correction** : fail-fast au démarrage si `JWT_SECRET` manquant ; supprimer la constante de repli (3 emplacements) ; centraliser la lecture du secret.
- **Test de non-régression** : test de démarrage sans `JWT_SECRET` → crash explicite ; test qu'un jeton signé avec l'ancienne valeur est rejeté.
- **Dépendances** : `server.js`, `config/`.
- **Vérification** : à refaire après correctif.

### P0-03 — Exécution d'actions IA (mutations réelles) sans capacité ni rôle

- **Sévérité** : 🔴 P0
- **Statut** : Confirmé (code)
- **Scénario** : un utilisateur authentifié (ex. `receptionist`) appelle `POST /api/ai/approvals/:id/approve` : `executeApprovedAction` déclenche `createVisitTools` (`place|close|triage|transfer|start…`) → mutations au dossier.
- **Cause** : routes `approvals/approve|reject` protégées uniquement par `authenticateJwt`.
- **Preuves** : `backend/src/routes/aiRoutes.js:254-278` ; `backend/src/ai/actions/action-gateway.js:85-146` ; `backend/src/services/visitTools.js:17-30`.
- **Impact** : transition/placement/clôture non autorisés ; incohérence clinique ; contournement du modèle d'habilitation.
- **Correction** : exiger la capacité correspondante à l'outil (ou au minimum `close`/`place`) **et** `assertAiRouteAllowed` ; restreindre approbation au rôle habilité.
- **Test de non-régression** : un `receptionist` obtient 403 ; un `chief` avec capacité passe.
- **Dépendances** : `aiRoutes`, `action-gateway`, `visitTools`, `roles.js`.
- **Vérification** : à refaire après correctif.

---

## P1 — Blocage métier important

### P1-01 — Deux mécanismes de transition parallèles (matrice non garantie globalement)

- **Sévérité** : 🟠 P1
- **Statut** : Confirmé (code)
- **Scénario** : `visitService` écrit `care_stage`/`status` directement par `CASE` sans `assertCareStageTransition`, alors que `careService`/`triageService` la contrôlent. Risque de transition implicite/contradictoire (ex. `completed` → non terminal impossible à exclure par la garde stricte).
- **Preuves** : `backend/src/lib/careStage.js:74-93` (matrice) ; `backend/src/services/visitService.js:338-349,506-515,741-752,832-840` (écritures directes) ; `legacyStatusFromCareStage` défini mais inutilisé (`careStage.js:53-72`).
- **Impact** : divergence UI/serveur possible ; invariants partiels.
- **Correction** : appeler `assertCareStageTransition` (ou une fabrique unique de transition) dans **tous** les services ; supprimer/déprécier la dérive `legacyStatusFromCareStage`.
- **Test de non-régression** : tests unitaires de la matrice sur chaque service.
- **Dépendances** : `careStage.js`, `visitService`, `careService`, `triageService`.
- **Vérification** : à confirmer par tests.

### P1-02 — Transferts / handoffs : atomicité et déduplication

- **Sévérité** : 🟠 P1
- **Statut** : Confirmé (code) ; **pas d'index unique partiel** confirmé (base).
- **Scénario** : deux `createTransferRequest`/`createHandoffRequest` concurrents passent la garde `SELECT … status='pending'` (sans `FOR UPDATE`) → deux demandes pending. `confirmTransferRequest` lit le statut hors transaction puis appelle `transferResource` (autre transaction) : une seconde confirmation concurrente peut se comporter de façon non déterministe (update 0 ligne silencieux).
- **Preuves** : `backend/src/services/transferRequestService.js:12-19,57-96` ; `backend/src/services/handoffService.js:8-14` ; absence d'index `(visit_id) WHERE status='pending'` (introspection `pg_indexes`).
- **Impact** : doublons de demandes, incohérence d'état, confusion opérationnelle. (La double affectation **de lit** reste bloquée par la base.)
- **Correction** : envelopper création/confirmation dans une seule transaction ; verrou `FOR UPDATE` sur la visite ; index unique partiel `(visit_id) WHERE status='pending'` ; idempotence sur `confirm`.
- **Test de non-régression** : test concurrent (2 requêtes/2 connexions) → une seule demande pending ; une seule confirmation.
- **Dépendances** : `transferRequestService`, `handoffService`, migration.
- **Vérification** : hypothèse de course à confirmer par test concurrent (non exécuté).

### P1-03 — Journalisation incomplète des handoffs

- **Sévérité** : 🟠 P1 (traçabilité)
- **Statut** : Confirmé (code)
- **Scénario** : création/réponse de handoff ne produit **aucun `visit_events`** alors que `handoff_requested|accepted|declined` sont dans l'énumération.
- **Preuves** : `backend/src/services/handoffService.js:3-63` ; `backend/migrations/20261014_v4_smart_workflow_foundation.sql:60-62`.
- **Impact** : trou de traçabilité clinique (qui a passé le relais, quand).
- **Correction** : émettre les événements correspondants.
- **Test de non-régression** : vérifier `visit_events` après création/réponse.
- **Dépendances** : `handoffService`.

---

## P2 — Robustesse / qualité

### P2-01 — Jeton SSE exposé dans l'URL

- **Statut** : Confirmé (code). **Preuve** : `frontend/src/hooks/useVisitEventStream.js:62,67` (`?token=`), accepté par `backend/src/middleware/sseAuth.js:7`.
- **Impact** : fuite de jeton dans logs/proxy/historique.
- **Correction** : transmettre le jeton via en-tête (fetch + ReadableStream) ou cookie `httpOnly`.

### P2-02 — CORS ouvert

- **Statut** : Confirmé (code). **Preuve** : `backend/src/app.js:11` `app.use(cors())` (toute origine).
- **Correction** : liste blanche d'origines via variable d'environnement.

### P2-03 — Bus temps réel en mémoire (mono-instance)

- **Statut** : Confirmé (code). **Preuve** : `backend/src/services/visitEventBus.js:1-24`.
- **Impact** : en multi-instance, événements perdus entre process ; SSE incohérent.
- **Correction** : `LISTEN/NOTIFY` PostgreSQL ou Redis pub/sub.

### P2-04 — Schéma de base non versionné

- **Statut** : Confirmé. Les migrations committées sont additives ; aucune ne crée `visits/patients/beds/rooms/zones/users/consultations/bed_assignments/visit_events`.
- **Impact** : impossible de reconstruire la base depuis le dépôt ; « ça marche sur mon poste ».
- **Correction** : committer une migration initiale (baseline) ou documenter la provenance.

### P2-05 — Endpoints de lecture sans capacité (surface d'accès large)

- **Statut** : Confirmé (code).
- **Preuves** : `GET /queue/worklists` (`queueRoutes.js:9`) ; `GET /care/capacity|visits/:id/exams|tasks|triage-history|exam-types` (`careRoutes.js:27-103`) ; `GET /workflow/*` lecture (`workflowRoutes.js:36-136`) ; `GET /ai/status|recommendations` (`aiRoutes.js:37,80`) ; `GET /visits/:id` (`visitRoutes.js:62`).
- **Impact** : accès plus large que nécessaire ; `GET /visits/:id` renvoie PII sans contrôle IDOR.
- **Correction** : ajouter des capacités de lecture par rôle.

### P2-06 — `chiefSupervisionRoutes` sans middleware propre

- **Statut** : Confirmé (code). **Preuves** : `backend/src/routes/chiefSupervisionRoutes.js` (aucun `router.use`), protection héritée du montage `backend/src/routes/chiefRoutes.js:10-11`.
- **Impact** : toute re-mount dans `index.js` exposerait la supervision sans auth.
- **Correction** : ajouter `authenticateJwt` + `requireRole('chief')` **dans** le routeur.

### P2-07 — IA pipeline apply sans `assertAiRouteAllowed`

- **Statut** : Confirmé (code). **Preuves** : `backend/src/routes/aiRoutes.js:180-192` ; garde `backend/src/ai/safety/ai-route-guard.js:4-16`.
- **Impact** : en mode `full_control_simulation`, l'apply (mutations) n'est pas restreint aux visites de démo.
- **Correction** : appliquer `assertAiRouteAllowed`.

### P2-08 — `window.prompt` pour saisie clinique

- **Statut** : Confirmé (code). **Preuve** : `frontend/src/components/workflow/VisitRecordTabs.jsx:267`.
- **Impact** : UX dégradée, données non structurées.

### P2-09 — Tests insuffisants (0 frontend, 3 cas destructifs non exécutés)

- **Statut** : Confirmé. Voir `PICU_WORKFLOW_TEST_PLAN.md`.

---

## P3 — Ergonomie / maintenabilité

- **P3-01** Duplication des libellés `care_stage`/statuts côté frontend (`StatusBadge.jsx`, `chief/chiefUtils.js`, `workflow/WorklistsPanel.jsx`, `PatientAnalyticsPanel.jsx`).
- **P3-02** Comptes de démo en clair (`frontend/src/pages/LoginPage.jsx:4-9`).
- **P3-03** Boutons sans effet (Google SSO, reset) : `LoginPage.jsx:79-80`.
- **P3-04** Commentaire obsolète « nurse only; chief cannot place » alors que `chief` a la capacité `place` : `visitRoutes.js:94` vs `roles.js:20`.
- **P3-05** `ViewTable` hydration warnings : `App.jsx:94-103` — `future` prop React Router.
- **P3-06** `Lazy` import error boundary manquant.

---

## Synthèse des risques

| ID | Sévérité | Titre | Statut |
|----|----------|-------|--------|
| P0-01 | 🔴 | Inscription publique rôle `chief` | Confirmé |
| P0-02 | 🔴 | Secret JWT de repli en dur | Confirmé |
| P0-03 | 🔴 | Approbation IA exécute sans capacité | Confirmé |
| P1-01 | 🟠 | Double machine à états | Confirmé |
| P1-02 | 🟠 | Transferts/handoffs non atomiques | Confirmé (course hypothèse) |
| P1-03 | 🟠 | Handoffs non journalisés | Confirmé |
| P2-01 | 🟡 | Jeton SSE en URL | Confirmé |
| P2-02 | 🟡 | CORS ouvert | Confirmé |
| P2-03 | 🟡 | Bus temps réel mémoire | Confirmé |
| P2-04 | 🟡 | Schéma de base non versionné | Confirmé |
| P2-05 | 🟡 | Lectures sans capacité | Confirmé |
| P2-06 | 🟡 | Supervision routes sans middleware | Confirmé |
| P2-07 | 🟡 | IA apply sans guard | Confirmé |
| P2-08 | 🟡 | `window.prompt` clinique | Confirmé |
| P2-09 | 🟡 | Tests insuffisants | Confirmé |
| P3-01..06 | ⚪ | Ergonomie/maintenabilité | Confirmé |
