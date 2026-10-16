# Plan d’intégration IA NVIDIA — PICU / Urgences V3

> **Version :** 1.0  
> **Date :** 12 octobre 2026  
> **But :** intégrer [PLAN-IA-NVIDIA-NIM-URGENCES-V3.md](../PLAN-IA-NVIDIA-NIM-URGENCES-V3.md) dans le dépôt **sans casser** le workflow V3, sans contournement des services métier, et avec une montée en charge progressive.  
> **Documents liés :** [PROCESSUS-URGENCES-V3.md](./PROCESSUS-URGENCES-V3.md), [ROADMAP-AGENTS.md](./ROADMAP-AGENTS.md)

---

## 1. Objectif de ce document

Le plan NVIDIA (2 600+ lignes) décrit la **cible**. Ce document décrit **comment l’accrocher au projet actuel** :

- quoi coder, dans quel ordre ;
- quels fichiers et tables toucher ;
- comment éviter les doubles chemins (API directe vs Action Gateway) ;
- comment brancher l’UI (dont l’onglet chef **Mode IA**).

**Règle :** tant qu’une étape n’est pas cochée dans la checklist de phase, on ne passe pas à la suivante.

---

## 2. Principes non négociables

| # | Principe | Implémentation |
|---|----------|----------------|
| 1 | LLM ≠ source de vérité | Aucun `INSERT/UPDATE` SQL depuis le module `ai/` |
| 2 | Même chemin que l’UI | Écritures via **domain services** (`visitService`, `triageService`, `careService`, …) |
| 3 | IA optionnelle | `AI_ENABLED=false` ou `AI_MODE=disabled` → zéro appel NIM, workflow inchangé |
| 4 | Déploiement prudent | **Mode par défaut : `disabled`** ; `collaborative` uniquement après activation chef + critères phase |
| 5 | Audit | Chaque run et chaque recommandation persistés ; actions métier validées → `visit_events` (`actor_type=agent`) |
| 6 | Secrets | `NVIDIA_API_KEY` uniquement backend / secret manager |
| 7 | Simulation isolée | `full_control_simulation` uniquement sur visites/patients **marqués fictifs** (ex. `demo` / `source` métadonnée) |

---

## 3. État actuel du dépôt (points d’ancrage)

Déjà en place — **à réutiliser, pas à réécrire** :

| Élément | Emplacement | Rôle pour l’IA |
|---------|-------------|----------------|
| Journal métier | `visitEventService.js`, table `visit_events` | `actor_type`, `agent_run_id`, `idempotency_key` |
| Contexte requête | `middleware/actorContext.js` | Headers agent pour les actions approuvées |
| Tools métier (v1) | `services/visitTools.js` | Surface `createVisitTools(actorUser, actionContext)` |
| Triage V3 | `triageService.js`, `triage_assessments` | Validation humaine ; l’IA ne remplace pas ce flux |
| Care flow V3 | `careService.js`, `resourceService.js`, `examTaskService.js` | Extensions tools futures |
| Charge / chef | `capacityService.js`, `chiefService`, KPI chef | Entrées **Capacity Agent** |
| Temps réel UI | `useVisitEventStream`, SSE | Rafraîchir recommandations / worklists après run |
| UI pilotage (shell) | `ChiefAiModePanel.jsx` | Brancher sur API réglages service |
| Données de test | `demoArrivalService`, admin reset DB | Sandbox / simulation |

**Manquant (à créer selon phases ci‑dessous) :** module `backend/src/ai/*`, tables `agent_*`, `NimProvider`, `ActionGateway`, routes `/api/ai/*`, schémas JSON, panneau triage « suggestion IA ».

---

## 4. Décisions d’architecture (pour éviter les problèmes)

### 4.1 Où stocker une suggestion de triage ?

**Décision recommandée (unique) :**

1. Le modèle produit une sortie validée par schéma → ligne dans **`agent_recommendations`** (`recommendation_type=triage`, `status=pending`).
2. Tant que non acceptée : **aucune** modification de `visits.priority` ni de `triage_assessments`.
3. À l’acceptation (infirmier/médecin) : appel normal à **`recordTriage` / `triageService`** avec `actor_type=user` ; optionnellement lier `agent_run_id` dans l’événement ou métadonnée.
4. Les champs `ai_priority`, `ai_confidence`, … du process V3 (§46) : **phase ultérieure** ou colonnes dérivées de la dernière recommandation acceptée — pas obligatoires pour le MVP.

Évite la duplication « suggestion dans 3 tables ».

### 4.2 Action Gateway : tôt, mais minimal

Le plan NVIDIA place le gateway en phase tardive ; **pour ce projet**, le gateway doit exister dès qu’on expose des endpoints IA :

| Phase | Gateway |
|-------|---------|
| 1b | Vérifie `AI_MODE`, permissions, **interdit toute écriture métier** depuis l’orchestrateur |
| 2+ | Chemin `propose` → `agent_recommendations` uniquement |
| 5+ | Chemin `execute` après approbation humaine → `createVisitTools` / services care |
| 10 | Actions `AUTO_ALLOWED` (tâches, alertes non cliniques) |

Fichier cible : `backend/src/ai/actions/action-gateway.js`.

### 4.3 Configuration : trois niveaux

```text
Niveau 1 — urgence / ops     : variables d’environnement (kill switch)
Niveau 2 — établissement     : table service_ai_settings (mode, flags par agent)
Niveau 3 — runtime           : chef modifie via UI (persisté niveau 2)
```

| Variable env | Rôle |
|--------------|------|
| `AI_ENABLED` | `false` = aucun appel NIM (hard off) |
| `AI_MODE` | `disabled` \| `collaborative` \| `supervised_autonomy` \| `full_control_simulation` — plafond maximal |
| `NIM_BASE_URL`, `NVIDIA_API_KEY` | Provider |
| `AI_*_MODEL` | Modèles par profil (reasoning / fast / embed) |

Si `AI_ENABLED=false`, l’UI affiche « IA désactivée (plateforme) » même si le chef demanderait le mode collaboratif.

### 4.4 Stack backend

Le dépôt est **Node.js CommonJS** (`backend/src/**/*.js`). Tous les nouveaux modules IA suivent ce convention :

```text
backend/src/ai/
  orchestrator/
  agents/
  providers/nim/
  models/
  context/
  tools/
  actions/
  schemas/
  safety/
```

Pas de migration TypeScript imposée par le plan NVIDIA.

### 4.5 RAG (hors MVP)

Pour Neon : viser **pgvector** sur la même base (ou branche Neon dédiée) en phase 6.  
Avant cela : Documentation / Triage agents sans RAG, ou contexte protocole **statique** (fichiers versionnés, pas d’embed).

---

## 5. Phases d’intégration

Chaque phase a : **prérequis**, **livrables**, **fichiers**, **critères Done**.

### Phase 0 — Gel du socle V3 (prérequis IA)

**Objectif :** ne pas intégrer l’IA sur un workflow instable.

| Livrable | Statut attendu |
|----------|----------------|
| `care_stage`, triage structuré, worklists, capacity | Stables sur parcours réel + démo |
| `visitTools` documenté | Liste des méthodes exposées aux agents |
| Tests manuels chef / infirmier / médecin | Scénario E2E documenté (1 page) |

**Done :** checklist signée dans ce fichier (section 10) ou ticket « Phase 0 » fermé.

---

### Phase 1 — NIM Gateway + feature flags

**Prérequis :** Phase 0.

| Livrable | Détail |
|----------|--------|
| `NimProvider` | `chat`, `structured` (JSON schema), `embed`, `health` |
| Timeouts / retry / circuit breaker | Config §59–48 du plan NVIDIA |
| `GET /api/ai/health` | Admin ou chief — état NIM sans données patient |
| Logs | Pas de clé API, pas de PHI dans les logs |

**Fichiers :**

```text
backend/src/ai/providers/nim/nim.client.js
backend/src/ai/providers/nim/nim.provider.js
backend/src/config/aiEnv.js
backend/src/routes/aiRoutes.js   → monté dans routes/index.js
```

**Done :**

- [ ] `AI_ENABLED=false` → health retourne `disabled`, pas d’appel réseau NIM  
- [ ] `AI_ENABLED=true` + mauvaise clé → erreur contrôlée, workflow métier OK  
- [ ] Latence et erreurs remontées en métrique (console ou compteur simple)

---

### Phase 1b — Persistance IA + Action Gateway (lecture / propose)

**Prérequis :** Phase 1.

**Migration SQL** (nouveau fichier sous `backend/migrations/`) :

```text
agent_runs
agent_recommendations
agent_actions          (structure minimale)
agent_approvals        (optionnel phase 2, requis avant execute)
service_ai_settings    (mode, flags JSON par agent)
```

**Modules :**

```text
backend/src/ai/actions/action-gateway.js
backend/src/ai/actions/action-policy.js   (matrice §27 plan NVIDIA)
backend/src/ai/observability/ai-audit.js
backend/src/services/aiSettingsService.js
```

**API :**

```text
GET  /api/ai/settings              (chief, admin)
PATCH /api/ai/settings             (chief — respecte plafond env)
GET  /api/ai/runs/:id
GET  /api/ai/recommendations/:visitId?status=pending
```

**UI :** remplacer les contrôles désactivés de `ChiefAiModePanel.jsx` par appels `PATCH /api/ai/settings` (mode global service + toggles agents).

**Done :**

- [ ] Migration appliquée sur Neon dev  
- [ ] Mode par défaut en base = `disabled`  
- [ ] Gateway bloque toute écriture domaine depuis l’IA  
- [ ] Chef peut passer à `collaborative` seulement si `AI_ENABLED=true`

---

### Phase 2 — Documentation Agent (premier agent prod)

**Prérequis :** Phase 1b, mode au moins `collaborative` pour test.

| Livrable | Détail |
|----------|--------|
| `DocumentationContextBuilder` | Timeline `visit_events`, consultation, exams/tasks — **minimisation** §41 |
| Schéma JSON sortie | Résumé structuré (pas de diagnostic affirmatif) |
| `POST /api/ai/documentation/summary` | `visitId` → run + recommendation |
| UI | Bouton « Brouillon IA » dans drawer visite (médecin / infirmier / chef) — accepter / rejeter |

**Done :**

- [ ] Recommandation en `pending` ; rejet sans effet métier  
- [ ] Acceptation = copie manuelle ou champ texte validé par l’humain (pas d’auto-save clinique au MVP)  
- [ ] Run visible dans `agent_runs`

---

### Phase 3 — Infrastructure benchmark (parallèle possible)

**Prérequis :** Phase 1.

| Livrable | Détail |
|----------|--------|
| Jeux de cas triage (JSON) | Dont cas FR / urgences CHU |
| Script runner | Appelle NIM + valide schéma + métriques §19 |
| `model_registry` / `prompt_registry` | Tables ou JSON versionné dans repo `benchmarks/` |

**Done :** rapport benchmark versionné ; aucun modèle « prod » sans entrée registry.

---

### Phase 4 — Triage Agent (shadow)

**Prérequis :** Phase 1b, jeu benchmark minimal.

| Livrable | Détail |
|----------|--------|
| `TriageContextBuilder` | Aligné §6.2 plan NVIDIA + données réelles V3 |
| Schéma §22 plan NVIDIA | `suggested_priority`, orientation, `missing_information`, etc. |
| `POST /api/ai/triage/recommend` | Ne s’affiche pas en UI infirmier (shadow) |
| Job ou trigger | Après enregistrement visite **optionnel** si mode shadow activé en settings |

**Done :**

- [ ] Aucune modification priorité clinique  
- [ ] Comparaison offline shadow vs triage humain (export CSV)  
- [ ] Critères §79 plan NVIDIA suivis avant phase 5

---

### Phase 5 — Triage collaboratif (UI)

**Prérequis :** Phase 4 + revue métier shadow.

| Livrable | Détail |
|----------|--------|
| UI `NurseTriagePanel` | Carte suggestion : priorité, confiance, motifs, manques |
| Actions | Accepter → `triageService` ; Modifier → triage humain ; Rejeter → `agent_recommendations.rejected` |
| SSE | Après run terminé, client peut rafraîchir (event métier ou poll léger) |

**Done :**

- [ ] Parcours infirmier utilisable avec NIM down (pas de blocage)  
- [ ] `idempotency_key` sur acceptation si relayée via gateway

---

### Phase 6 — RAG protocoles

**Prérequis :** Phase 5 stable, choix pgvector validé.

| Livrable | Pipeline §30 plan NVIDIA, documents approuvés uniquement |
|----------|--------------------------------------------------------|
| Ingestion | PDF → chunks → embed Nemotron embed |
| Tools | `searchProtocols`, `getProtocolSection` |
| UI | Citations dans carte triage / doc |

---

### Phase 7 — Bed Flow Agent (collaborative)

**Prérequis :** Phase 1b, `resourceService` stable.

| Livrable | Tools lecture §24 : `getAvailableResources`, charge salle/zone |
|----------|------------------------------------------------------------------|
| Sortie | Proposition lit + raison → `agent_recommendations` |
| UI | Suggestion dans placement lit (infirmier) ; exécution = `placeVisit` humain |

Étendre `visitTools` :

```text
place, transfer (resourceService), validateTriage (triageService), …
```

Voir annexe A.

---

### Phase 8 — Capacity Agent (chef)

**Prérequis :** `fetchChiefOverview`, `capacityService`.

| Livrable | `POST /api/ai/capacity/analyze` — agrégats déjà calculés côté API |
|----------|---------------------------------------------------------------------|
| UI | Section chef « Signaux » ou sous-onglet Mode IA — synthèse charge |

Pas de modification des priorités cliniques (§9 plan NVIDIA).

---

### Phase 9 — Exécution approuvée (gateway write)

**Prérequis :** Phases 5–7.

| Livrable | Workflow `agent_approvals` §28 |
|----------|--------------------------------|
| API | `POST /api/ai/approvals/:id/approve|reject` |
| Exécution | Gateway appelle `createVisitTools` avec `actor_type=agent`, `agent_run_id` |

---

### Phase 10 — Supervised autonomy

**Prérequis :** Phase 9, politique établissement.

Actions **AUTO_ALLOWED** uniquement : `createReassessmentTask`, alertes opérationnelles, refresh worklist — jamais clôture / priorité finale sans humain (matrice §27).

---

### Phase 11 — Supervisor + orchestration multi-agent

**Prérequis :** Agents spécialisés stables.

Supervisor = routage et synthèse **sans** tools d’écriture par défaut.

---

### Phase 12 — Simulation full control

**Prérequis :** Garde-fou patients fictifs, admin demo / reset DB.

| Livrable | `AI_MODE=full_control_simulation` + check visit `metadata.source` |
|----------|-------------------------------------------------------------------|
| Option | Réutiliser `demoArrivalService` + futur `SimulationService` |

Interdit en production sur visites réelles (assertion gateway + middleware).

---

### Phase 13 — NIM self-hosted (optionnel)

Changer `NIM_BASE_URL` uniquement — pas de refactor agents (§45 plan NVIDIA).

---

## 6. Ordre de développement (résumé)

```text
0  Socle V3 stable
1  NIM Gateway + flags
1b Tables agent_* + Action Gateway (propose only) + API settings chef
2  Documentation Agent
3  Benchmark (en parallèle)
4  Triage shadow
5  Triage UI collaborative
6  RAG
7  Bed Flow
8  Capacity (chef)
9  Approbations + exécution gateway
10 Supervised autonomy
11 Supervisor
12 Simulation full control
13 NIM privé
```

**MVP produit (démo CHU) :** phases **0 → 1 → 1b → 2 → 4 → 5** avec mode `disabled` par défaut et activation chef explicite.

---

## 7. Routes API cibles (consolidées)

| Méthode | Route | Rôle | Phase |
|---------|-------|------|-------|
| GET | `/api/ai/health` | admin, chief | 1 |
| GET/PATCH | `/api/ai/settings` | chief, admin | 1b |
| POST | `/api/ai/documentation/summary` | clinique autorisé | 2 |
| POST | `/api/ai/triage/recommend` | nurse, doctor, chief | 4–5 |
| POST | `/api/ai/bed-flow/recommend` | nurse, chief | 7 |
| POST | `/api/ai/capacity/analyze` | chief | 8 |
| GET | `/api/ai/runs/:id` | selon visite | 1b |
| GET | `/api/ai/recommendations` | filtres visit/status | 1b |
| POST | `/api/ai/approvals/:id/approve` | selon policy | 9 |
| POST | `/api/ai/approvals/:id/reject` | selon policy | 9 |

Montage : `router.use('/ai', aiRoutes)` dans `backend/src/routes/index.js`.  
Toutes les routes : `authenticateJwt` + capacités dans `roles.js` (ex. `ai:settings`, `ai:triage:recommend`).

---

## 8. Frontend — écrans à toucher

| Écran | Phase | Changement |
|-------|-------|------------|
| `ChiefAiModePanel.jsx` | 1b | Mode service + toggles agents (API) |
| `NurseTriagePanel.jsx` | 5 | Carte suggestion IA |
| `ChiefVisitDrawer` / clinique | 2 | Brouillon documentation |
| Placement lit (infirmier) | 7 | Suggestion bed flow |
| Chef supervision | 8 | Synthèse capacity (optionnel onglet flow) |

Toujours : état vide si `AI_MODE=disabled` ou NIM down.

---

## 9. Tests et rollback

| Type | Contenu |
|------|---------|
| Unit | Schémas JSON, policy matrix, `aiEnv` |
| Intégration | Gateway refuse écriture en `collaborative` |
| E2E | Enregistrement → triage humain sans IA ; avec IA mockée |
| Sécurité | Prompt injection sur champs motif ; pas de fuite clé |
| Rollback | `AI_ENABLED=false` + redeploy ; pas de migration destructive |

**Procédure incident :** chef ou ops passe `AI_ENABLED=false` ; les visites en cours continuent sans dépendance IA.

---

## 10. Checklist de démarrage (Phase 0 → 1b)

Cocher avant le premier appel NIM avec données visites :

- [x] Phase 0 : parcours V3 démo validé (accueil → triage → lit → consultation → sortie) — voir [E2E-V3-DEMO.md](./E2E-V3-DEMO.md)
- [x] `visitTools.js` : commentaire ou README listant les méthodes agent — voir [AGENT-VISIT-TOOLS.md](./AGENT-VISIT-TOOLS.md)
- [x] Migration `agent_runs` + `agent_recommendations` + `service_ai_settings` — `backend/migrations/20261012_ai_agent_foundation.sql`
- [x] `aiEnv.js` : `AI_ENABLED`, `AI_MODE` default `disabled`
- [x] `action-gateway.js` : exécution bloquée sans approbation / mode adapté
- [x] Routes `/api/ai/*` protégées RBAC
- [x] `ChiefAiModePanel` branché sur settings (même si agents encore vides)
- [x] `.env.example` mis à jour (sans vraie clé)
- [x] Document équipe : mode par défaut **disabled**, pas collaborative

---

## Annexe A — Mapping tools → services (cible)

| Tool plan NVIDIA | Service / méthode actuelle | Phase |
|------------------|----------------------------|-------|
| `getVisit` / timeline | `fetchVisitDetails`, `visit_events` | 1b context builders |
| `getTriageContext` | `triageService`, visite | 4 |
| `getAvailableResources` | `bedService` / board beds | 7 |
| `getEmergencyDepartmentMetrics` | `capacityService`, chief overview | 8 |
| `register` / `call` / `place` | `visitTools` → `visitService` | 9+ |
| `triage` (écriture) | **`triageService.recordTriage`** (pas ancien seul priority) | 5+ |
| Transfert / observation | `careService`, `resourceService` | 7–9 |
| Exams / tasks | `examTaskService` | 9+ lecture ; écriture policy |

**Action :** étendre `visitTools.js` par phase, une PR par groupe de tools, tests d’intégration gateway.

---

## Annexe B — Matrice documents

| Sujet | Plan NVIDIA | Process V3 | Ce document |
|-------|-------------|------------|-------------|
| Modes IA | §4 | §45 | §4.3 |
| Action Gateway | §26 | §47 | §4.2, phase 1b/9 |
| Tables agent | §36 | § données | Phase 1b |
| Triage IA | §6 | §46 | §4.1, phases 4–5 |
| Roadmap | §74–75 | — | §5–6 (réordonné) |

---

## Annexe C — Corrections explicites au plan NVIDIA

À appliquer mentalement (ou dans une future révision du plan racine) :

1. **Mode initial :** `disabled` (pas `collaborative` en §14 / §83).  
2. **Action Gateway :** minimal dès phase **1b**, pas seulement phase 9.  
3. **Implémentation :** JavaScript sous `backend/src/ai/`, pas TypeScript obligatoire.  
4. **Chef UI :** réglages service via API, pas seulement `AI_MODE` env.

---

*Fin du plan d’intégration — à maintenir à chaque phase livrée (cocher Done, date, PR).*
