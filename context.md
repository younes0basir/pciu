# PICU — Contexte Global de l’Application

## 1) Vision produit

**PICU** (Plateforme Intelligente de Coordination des Urgences) digitalise le flux des urgences:

- enregistrement rapide des patients,
- triage assisté IA (validation infirmier optionnelle),
- gestion file d’attente,
- orientation patient vers salle/ressource/médecin,
- suivi des consultations,
- pilotage en temps réel des zones et ressources.

Objectif opérationnel: réduire les délais et fluidifier la prise en charge.

---

## 2) Stack technique

### Frontend
- React + Vite
- React Router
- Socket.IO client
- Contexts:
  - `AuthContext` (auth/session)
  - `AppContext` (état global applicatif)

### Backend
- Node.js + Express
- PostgreSQL
- Socket.IO server
- JWT auth
- Service IA triage (LLM + fallback règles)

---

## 3) Structure du projet

```text
stage 2026 chu/
├─ frontend/
│  ├─ src/
│  │  ├─ contexts/
│  │  │  ├─ AuthContext.jsx
│  │  │  └─ AppContext.jsx
│  │  ├─ components/
│  │  │  └─ RoleDashboard.jsx
│  │  ├─ pages/
│  │  ├─ services/api.js
│  │  └─ utils/dataNormalization.js
│  └─ ...
├─ backend/
│  ├─ routes/
│  │  ├─ visits.js
│  │  ├─ queue.js
│  │  ├─ triage.js
│  │  ├─ consultations.js
│  │  └─ resources.js
│  ├─ services/
│  │  └─ aiTriageService.js
│  ├─ migrations/
│  └─ ...
└─ context.md (ce fichier)
```

---

## 4) Rôles métier (UI)

- **Accueil (Receptionist)**
  - crée patient + visite
  - surveille file d’attente
  - appelle & oriente les patients
- **Infirmier (Nurse)**
  - valide/corrige triage (optionnel)
- **Médecin (Doctor)**
  - suit patients actifs
  - assigne/libère ressources
  - démarre/clôture consultation
- **Chef (Chief)**
  - supervision opérationnelle globale
- **Admin**
  - configuration système + utilisateurs

---

## 5) Flux opérationnels clés

## 5.1 Accueil → File d’attente
1. Création patient
2. Création visite (`status = waiting`)
3. Pré-triage IA en arrière-plan
4. Insertion/MAJ file (`queue`) sans blocage infirmier
5. Le patient apparaît dans la file opérationnelle

## 5.2 Appel & orientation
Depuis la file, `Appeler & orienter` tente:
- salle disponible + médecin assigné/disponible,
- création `resource_assignments` + `consultations`,
- passage visite en traitement,
- sinon fallback avec message explicite (pas de salle/médecin).

## 5.3 Consultation médecin
- début consultation (ou auto-créée via orientation)
- fin consultation:
  - fermeture assignment ressource,
  - ressource remise disponible,
  - événements temps réel diffusés aux dashboards.

---

## 6) Base de données — points importants

Tables majeures:
- `patients`
- `emergency_visits`
- `ai_triage`, `nurse_triage`
- `queue`
- `resources`, `resource_assignments`
- `consultations`
- `patient_event_logs`, `audit_logs`

### Contrainte statut visite (actuelle)
La contrainte `chk_visit_status` autorise:
- `waiting`
- `triaged`
- `in_treatment`
- `discharged`
- `transferred`
- `left_without_seen`

⚠️ Toute écriture d’un statut hors de cette liste échoue.

---

## 7) Temps réel (Socket.IO)

Événements utilisés pour synchroniser les écrans:
- `queue:updated`
- `visit:status_changed`
- `visit:timeline_updated`
- `dashboard:snapshot`
- `patient:updated`, `patient:archived`, `patient:restored`

Les dashboards se rechargent selon rôle à réception des événements.

---

## 8) Frontend global context (AppContext)

Fichier: `frontend/src/contexts/AppContext.jsx`

Ce contexte centralise:
- **UI shell**: sidebar, densité, mémoire onglet par rôle
- **Filtres partagés**: zone, priorité, recherche, lane
- **Cache data**: stats, queue, resources, visits, consultations, roomDoctors, etc.
- **UX global**: toasts + modal bus
- **Santé app**: loading, error, online/offline
- **Actions**:
  - `refreshAppData()` role-aware
  - `setQueueFilters()`, `resetQueueFilters()`
  - `pushToast()`, `dismissToast()`, `openModal()`, `closeModal()`
  - `setLastDashboardTab()`, `getLastDashboardTab()`

### Provider wiring
`AppProvider` est monté dans `frontend/src/App.jsx` sous `AuthProvider`.

---

## 9) API critiques (résumé)

- Auth: `/api/auth/*`
- Patients: `/api/patients/*`
- Visits: `/api/visits/*`
- Triage: `/api/triage/*`
- Queue: `/api/queue/*`
- Resources: `/api/resources/*`
- Consultations: `/api/consultations/*`
- Dashboard: `/api/dashboard/*`

---

## 10) Décisions produit/techniques en place

1. **Triage infirmier non bloquant**
   - l’IA alimente le flux sans attendre validation manuelle.
2. **File d’attente stricte**
   - n’affiche que les patients réellement en attente.
3. **Orientation automatique**
   - tente salle + médecin assigné avant fallback.
4. **Synchronisation multi-rôles**
   - événements temps réel lors des transitions importantes.

---

## 11) Points d'attention actuels

### Fix 2026-07-15 — `POST /api/resources/assign` → sync temps réel

**Problème**: Quand une infirmière affectait un patient à un lit, aucun autre rôle n'était notifié.

**Cause**: `POST /api/resources/assign` ne mettait pas à jour `emergency_visits.status` et n'émettait aucun événement WebSocket.

**Fix appliqué dans `backend/routes/resources.js`**:

```
POST /api/resources/assign (transaction):
  1. INSERT resource_assignments
  2. UPDATE resources SET status = 'occupied'
  3. UPDATE emergency_visits SET status = 'in_treatment'  ← nouveau
  4. UPDATE queue SET called_at = NOW() WHERE called_at IS NULL  ← nouveau
  5. emit("queue:updated",      { action: "resource_assigned", visit_id, resource_id })
  6. emit("visit:status_changed", { visit_id, status: "in_treatment" })

POST /api/resources/:id/release:
  - RETURNING visit_id depuis resource_assignments  ← nouveau
  - emit("queue:updated",      { action: "resource_released", resource_id, visit_id })
  - emit("visit:status_changed", { visit_id, status: "resource_released" })  ← nouveau
```

**Résultat**: Dès qu'une infirmière clique "Affecter" sur un lit, tous les dashboards connectés (`queue:updated` + `visit:status_changed`) se rechargent automatiquement via le listener WebSocket de `useDashboardData`.

---

- Les statuts DB et les labels UI doivent rester alignés en permanence.
- Le routage frontend ne doit pas pointer vers des placeholders “bientôt” sur des features déjà implémentées.
- Les données démo doivent rester cohérentes (ressources, assignments, consultations).

---

## 12) Prochaines améliorations recommandées

1. Badge "orientation prévue" avant appel accueil
2. Bloc "En traitement" séparé de la file d'attente
3. Historique médecin/salle dans la timeline patient
4. Refonte des routes `/dashboard/*` pour un mapping 100% feature-complete par rôle
5. Tests d'intégration workflow complet (accueil → orientation → consultation → fin)

---

## 13) PatientTrackingPage — Suivi en direct (mis à jour 2026-07-15)

### Fichier: `frontend/src/pages/PatientTrackingPage.jsx`

**Page publique (sans auth)** — recherche par CIN, résultat synchronisé en temps réel par polling.

### Fonctionnalités ajoutées

| Feature | Détail |
|---------|--------|
| **Auto-refresh** | Polling silencieux toutes les `POLL_INTERVAL_S = 30s` tant que le statut n'est pas terminal |
| **Countdown** | Bouton `Actualiser (Xs)` avec décompte en temps réel |
| **Refresh manuel** | Clic sur le bouton reset le compteur + refetch immédiat |
| **Toggle pause** | Bouton `🟢 Auto` / `⏸ Pause` pour activer/désactiver l'auto-refresh |
| **Mise à jour en place** | Le résultat se rafraîchi sans re-saisir le CIN |
| **Heure de MAJ** | Affiche `Mis à jour HH:MM:SS` après chaque fetch |
| **Statuts terminaux** | `discharged`, `transferred`, `left_without_seen` arrêtent le polling + message "statut final" |
| **Mapping statuts complet** | Alignsé avec `chk_visit_status` DB (waiting, triaged, in_treatment, discharged, transferred, left_without_seen...) |

### Architecture interne

```js
const activeCinRef = useRef(''); // CIN du résultat affiché, stable dans les intervals

const fetchTracking = useCallback(async (cinValue, { silent = false }) => {
  // silent=true → setRefreshing (pas de setLoading, pas d'effacement résultat)
  // silent=false → setLoading (recherche initiale)
});

// Auto-refresh
useEffect(() => {
  if (!result || !autoRefresh || TERMINAL_STATUSES.has(result.status)) return;
  const tick = setInterval(() => {
    setCountdown(prev => {
      if (prev <= 1) { fetchTracking(activeCinRef.current, { silent: true }); return 30; }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(tick);
}, [result, autoRefresh, fetchTracking]);
```

### STATUS_CFG (nouveau)

| Statut DB | Label affiché |
|-----------|---------------|
| `waiting` | En attente de triage |
| `registered` | Enregistré — En attente |
| `triaged` | Trié — En salle d'attente |
| `in_treatment` | En consultation / traitement |
| `discharged` | Sortie autorisée 🏠 (terminal) |
| `transferred` | Transféré 🚑 (terminal) |
| `left_without_seen` | Parti avant consultation 🚶 (terminal) |

---

## 14) Nurse Dashboard — Salles & Lits (ajout 2026-07-15)

### 13.0 Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `frontend/src/components/NurseRoomsPanel.jsx` | Nouveau composant dédié salles/lits/affectation pour l'infirmier |

### 13.0.1 Changements dans `NurseDashboard.jsx`

- Remplacement `import ResourcesSection` → `import NurseRoomsPanel`
- Ajout d'un 3ème onglet **"🛏️ Salles & Lits"** (`activeTab === 2`)
- Suppression de `<ResourcesSection>` de l'onglet Statistiques (Tab 1)
- Tab 2 rend `<NurseRoomsPanel resources queue roomDoctors refetch addToast />`

### 13.0.2 `NurseRoomsPanel` — design & fonctionnement

**Props reçues**: `resources`, `roomDoctors`, `queue`, `refetch`, `addToast`

**État local**:
- `bedAssignTarget` — `bed.id` du lit actuellement ouvert pour affectation
- `bedAssignChoice` — `{ [bedId]: visitId }` patient sélectionné par lit
- `zoneFilter` — filtre de zone actif
- `releaseBusy`, `assignBusy` — locks d'action

**Sections UI**:
1. **Quick stats** (grid 4 colonnes): Lits libres / Salles libres / Espaces urgence / Patients à placer
2. **Zone pills**: filtre par zone (depuis `roomDoctors[].zone_name`)
3. **Room cards grid** (`repeat(auto-fill, minmax(300px, 1fr))`):
   - Header: nom + zone badge + type + statut pill (Libre/Occupée) avec dot animé
   - Staff badges: 🩺 Réf. (vert) / 👨‍⚕️ Méd. (bleu) / 🩹 Inf. (violet)
   - Barre d'occupation: `occupiedBeds/totalBeds * 100`
   - **Lits toujours visibles** (pas de toggle) avec statut individuel
4. **Par lit**:
   - Libre → bouton `➕ Affecter` → ouvre panel inline
   - Occupé → bouton `🔓 Libérer` → `resourcesApi.release(bed.id)`
5. **Panel d'affectation inline** (fond bleu clair):
   - `<select>` listant les patients en attente (`queue.visit_status ∉ [in_treatment, discharged, ...]`)
   - Options formatées: `[P2] Nom Prénom · Zone`
   - Bouton `✔ Confirmer` → `resourcesApi.assign(parseInt(visitId), bed.id)` → refetch

**Ordre des paramètres API**: `resourcesApi.assign(visit_id, resource_id)` = `assign(visitId, bed.id)`

---

## 14) Analyse détaillée — Dashboard Accueil (`ReceptionistDashboard`)

### 13.1 Fichiers clés

| Rôle | Fichier |
|------|---------|
| Composant principal | `frontend/src/pages/reception/ReceptionistDashboard.jsx` |
| Vue file enrichie | `frontend/src/components/EnhancedQueueView.jsx` |
| Section salles | `frontend/src/components/ResourcesSection.jsx` |
| Chargement données | `frontend/src/components/RoleDashboard.jsx` → `useDashboardData()` |
| API client | `frontend/src/services/api.js` |
| Route queue backend | `backend/routes/queue.js` |
| Route ressources backend | `backend/routes/resources.js` |

### 13.2 Data loading (Receptionist)

`useDashboardData()` fait en parallèle:
- `queueApi.list()` → GET /api/queue
- `dashboardApi.stats()` → GET /api/dashboard/stats
- `resourcesApi.list()` → GET /api/resources (tous types)
- puis: `resourcesApi.roomsWithDoctors()` → GET /api/resources/rooms-with-doctors

Résultat: `{ queue, stats, resources, roomDoctors }` passé en prop à `ReceptionistDashboard`.
Rafraîchissement: toutes les 30s + WebSocket (`queue:updated`, `visit:status_changed`).

### 13.3 Feature "Appeler" — `callPatient(item)`

**Frontend** (`ReceptionistDashboard.jsx` L123):
```js
async function callPatient(item) {
  const res = await queueApi.callSpecific(item.visit_id || item.id);
  // → POST /api/queue/call-specific { visit_id }
  const routing = res?.data?.routing;
  if (routing?.auto_routed)
    addToast(`orienté(e) vers Dr ${routing.doctor_name} · ${routing.resource_name}`);
  else
    addToast(`appelé(e) · ${routing?.reason}`);
  await refetch();
}
```

**4 points d'entrée UI** (même fonction `callPatient`):
- Section Critical (P1/P2): bouton danger rouge pulsant
- Section Urgent (P3): bouton warning jaune
- Section Routine (P4-P5): bouton primary indigo
- `EnhancedQueueView`: bouton sky bleu (prop `onCallPatient`)

**Backend** `POST /api/queue/call-specific` → `autoRouteVisitToDoctor()`:
1. Consultation active existante → réutilisée (no duplicate)
2. Zone du patient: `emergency_visits.zone_id` ou `ai_triage.zone_id`
3. Candidate = salle dispo + médecin le moins chargé (`ORDER BY active_consultations ASC`)
   - Types éligibles: `room`, `salle`, `box`, `emergency_space`, `dechoc`, `déchocage`
   - Médecin: `is_active = true AND is_available = true`
   - Via table `room_doctor_assignments`
4. Si candidat: INSERT resource_assignments + consultations, UPDATE resources/visit
5. Si non: `auto_routed: false`, visit quand même passée `in_treatment`
6. Emit: `queue:updated`, `visit:status_changed`

**Feature "📞 Appel patient" (recherche téléphone)**:
- Ouvre un input → `patientsApi.search(phone)` → GET /api/patients/search?query=...
- Affiche seulement un toast avec le **nombre** de patients trouvés
- ⚠️ TODO non implémenté: pas de fiche patient, pas d'action possible (voir L115: `// Could show patient details`)

### 13.4 Feature "Rooms" — `ResourcesSection`

**Données source**: `roomDoctors` = résultat de `GET /api/resources/rooms-with-doctors`

Chaque carte de salle contient:
- Nom + zone badge (couleurs par `ZONE_COLORS`)
- Statut Libre/Occupé + bouton ✕ release (`POST /api/resources/:id/release`)
- Barre d'occupancy: `occupiedBeds / roomBeds.length * 100` (calculé client-side)
- Staff: `main_doctor[]` 🩺 (vert), `doctors[]` 👨‍⚕️ (bleu), `nurses[]` 🩹 (violet)
- Toggle ▼ détail des lits → grille de bed cards individuels avec statut + release

**Quick stats bar** (3 compteurs):
- `availableBeds / beds.length` (type ∋ `bed|lit`)
- `availableRooms / rooms.length` (type ∋ `room|salle|box`)
- `availableEmergencySpaces / emergencySpaces.length` (zone/nom/type ∋ `urgence|dechoc|resus|réanimation|emergency`)

**Backend** `GET /api/resources/rooms-with-doctors`:
- Parent resources (salles) + json_agg staff via `room_doctor_assignments`
- Beds enfants groupés par `parent_resource_id`
- ⚠️ N'inclut PAS les patients actuellement dans la salle (contrairement à `/resources/floorplan`)

### 13.5 Affectation manuelle de ressource

En parallèle du bouton "Appeler", chaque ligne patient a un `<select>` + bouton `🛏️`:
```js
const availableResources = (data.resources || []).filter(r => r.status === 'available');
// filtré par zone: r.zone_name === item.zone_name (matching par string)
// limité à: .slice(0, 15)
async function assignResourceToVisit(visitId, patientName) {
  await resourcesApi.assign(visitId, parseInt(selected));
  // → POST /api/resources/assign { visit_id, resource_id }
}
```

### 13.6 Classification des ressources (logique dupliquée)

Même triplet `isBed`/`isRoom`/`isEmergencySpace` défini dans **3 fichiers**:
- `ReceptionistDashboard.jsx` L45-56
- `ResourcesSection.jsx` L36-41
- `RoleDashboard.jsx` L1694-1705 (QueueView)

→ À extraire dans `frontend/src/utils/resourceUtils.js`.

### 13.7 Problèmes identifiés

| Sévérité | Problème | Localisation |
|----------|-----------|--------------|
| 🔴 | `callPatient` (auto-route) + `assignResourceToVisit` (manuel) découplés → risque double-affectation si auto-routing réussit | `ReceptionistDashboard.jsx` L149, L563 |
| 🔴 | Recherche téléphone sans suite: résultat = toast comptage seulement, aucune action | `ReceptionistDashboard.jsx` L106-121 |
| 🔴 | `rooms-with-doctors` ne retourne pas les patients courants dans la salle | `ResourcesSection.jsx`, `resources.js` L294 |
| 🟡 | Patients P3-P5 rendus 2× (EnhancedQueueView + priority lanes) | `ReceptionistDashboard.jsx` L387, L840 |
| 🟡 | `isBed`/`isRoom`/`isEmergencySpace` dupliqués dans 3 fichiers | voir §13.6 |
| 🟡 | Zone matching par string (`r.zone_name === item.zone_name`) dans le select | `ReceptionistDashboard.jsx` L1039 |
| 🟡 | Resources select limité à `slice(0, 15)` | `ReceptionistDashboard.jsx` L1040 |
| 🟡 | Header `ResourcesSection` badge = seulement `availableBeds`, pas rooms/urgences | `ResourcesSection.jsx` L112 |
