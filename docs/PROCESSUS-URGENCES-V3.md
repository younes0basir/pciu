# Processus des urgences V3 — Smart Emergency Flow

> **Statut du document :** spécification cible pour faire évoluer le workflow actuel.  
> **Objectif :** remplacer le modèle centré sur `waiting → placed → in_treatment` par un workflow d’urgences plus robuste, tout en conservant les points solides existants : visite unique, file calculée, plan des ressources, rôles, transactions et historique.  
> **IA :** aucune IA n’est nécessaire pour faire fonctionner cette version. L’architecture est simplement préparée pour une intégration ultérieure d’agents.

---

## 1. Principes généraux

Une **visite** suit le patient pendant tout son passage aux urgences.

Dans la nouvelle version, une seule colonne de statut ne doit plus représenter à la fois :

- l’urgence clinique ;
- l’étape de prise en charge ;
- la position physique ;
- l’occupation d’un lit ;
- la décision de sortie.

Le système sépare donc cinq dimensions :

| Dimension | Exemple |
|---|---|
| Priorité clinique | P1, P2, P3, P4, P5 |
| Étape de soins | triage, attente, soins, observation, décision, terminé |
| Localisation | accueil, attente, salle, box, lit, fauteuil |
| Ressource | D1, Box A1, Fauteuil 2, aucune |
| Décision finale | sortie, hospitalisation, transfert, départ avant prise en charge |

### Règle fondamentale

Le parcours patient et la localisation physique sont liés, mais **indépendants**.

Exemples :

- un patient peut être en consultation sans lit ;
- un patient peut changer de lit sans changer de visite ;
- un patient peut être en observation sans consultation active ;
- un patient critique peut être envoyé directement en SAUV avant la fin des formalités administratives ;
- un patient peut attendre une hospitalisation tout en restant physiquement aux urgences.

---

# 2. Vue générale du workflow

```text
ARRIVÉE
   ↓
DÉTECTION IMMÉDIATE D’UNE URGENCE CRITIQUE
   │
   ├── Critique / instable
   │       ↓
   │   PRISE EN CHARGE IMMÉDIATE
   │       ↓
   │   SAUV / DÉCHOQUAGE
   │       ↓
   │   Triage / données administratives complétés dès que possible
   │
   └── Pas de danger immédiat détecté
           ↓
         TRIAGE
      Priorité P1–P5
           ↓
       ORIENTATION
     ┌─────┼───────────┐
     ↓     ↓           ↓
   SAUV   BOX     AMBULATOIRE
     │     │           │
     └─────┴───────────┘
           ↓
    AFFECTATION D’UNE
       RESSOURCE
   lit / box / fauteuil
           ↓
    PRISE EN CHARGE
           ↓
 Examens / soins / actes
           ↓
      RÉÉVALUATION
       ↙        ↘
 aggravation   amélioration
     ↓            ↓
  escalade    observation /
              décision
                  ↓
          DÉCISION MÉDICALE
        ┌────────┼─────────┐
        ↓        ↓         ↓
      SORTIE  HOSPITAL.  TRANSFERT
                  ↓
             CLÔTURE
                  ↓
      LIBÉRATION DE RESSOURCE
                  ↓
     nettoyage / maintenance
                  ↓
              DISPONIBLE
```

Ce diagramme décrit le workflow logiciel. Les règles cliniques précises doivent rester configurables et validées par l’établissement.

---

# 3. États principaux de la visite

Le champ principal recommandé est `care_stage`.

Valeurs proposées :

| `care_stage` | Signification |
|---|---|
| `registered` | Visite créée |
| `triage_pending` | En attente de triage |
| `waiting_care` | Triage effectué, attente de prise en charge |
| `in_care` | Prise en charge active |
| `in_observation` | Observation / surveillance |
| `disposition_pending` | Décision prise ou presque prise, destination en attente |
| `completed` | Passage terminé |

Le champ `care_stage` ne doit pas indiquer le lit ou la salle.

---

# 4. Priorité clinique

La priorité clinique reste P1 à P5 :

| Priorité | Sens fonctionnel |
|---|---|
| P1 | Critique / prise en charge immédiate |
| P2 | Très urgent |
| P3 | Urgent / standard |
| P4 | Peu urgent |
| P5 | Faible urgence |

Les définitions cliniques exactes et les seuils doivent être configurés selon le protocole retenu par l’établissement.

## 4.1 Priorité finale

Dans la version sans IA :

```text
triage_priority = priorité validée manuellement
final_priority  = triage_priority
```

Le triage est réalisé par un professionnel autorisé.

## 4.2 Réévaluation

La priorité n’est jamais considérée comme définitive pendant toute la durée d’attente.

Une réévaluation peut :

- conserver la priorité ;
- augmenter l’urgence ;
- diminuer l’urgence si le protocole local l’autorise ;
- déclencher une prise en charge immédiate ;
- changer le circuit d’orientation.

Chaque changement doit être historisé.

---

# 5. Détection d’urgence avant le triage complet

Une urgence critique ne doit pas attendre la fin du parcours administratif.

Le système doit permettre :

```text
patient arrive
    ↓
danger immédiat suspecté
    ↓
critical_flag = true
    ↓
alerte équipe clinique
    ↓
orientation immédiate vers zone critique
    ↓
administratif + triage complétés dès que possible
```

Le `critical_flag` est distinct de la priorité finale.

Il permet de déclencher rapidement le workflow d’urgence sans prétendre remplacer le triage clinique.

---

# 6. Admission et enregistrement

L’accueil crée ou retrouve le patient puis crée la visite.

## Données administratives principales

| Champ | Règle |
|---|---|
| Prénom, nom | obligatoires sauf procédure critique locale |
| CIN | facultative |
| Téléphone | facultatif |
| Mode d’arrivée | à pied, ambulance, brancard, autre |
| Motif principal | obligatoire dès que possible |
| Date / heure d’arrivée | automatique |
| Code visite | automatique |

Code public recommandé :

```text
V-AAMMJJ-XXXX
```

Le motif principal initial doit rester traçable.

Si une correction est nécessaire, elle doit être enregistrée comme correction ou note clinique, sans effacer silencieusement la donnée d’origine.

---

# 7. Règles d’unicité des visites

Par défaut :

- un patient ne peut avoir qu’une visite active ;
- une visite est active tant que `care_stage != completed` ;
- les créations concurrentes doivent être protégées en base de données ;
- les fusions de doublons doivent être réservées à des rôles autorisés et auditées.

---

# 8. Triage

Le triage devient une étape explicite et historisée.

Table recommandée :

```text
triage_assessments
```

Chaque évaluation peut contenir :

```text
visit_id
priority
assessment_type
clinical_note
vitals
orientation
performed_by
performed_at
reason_for_change
```

`assessment_type` peut par exemple être :

```text
initial
reassessment
escalation
```

La visite conserve la priorité finale courante pour faciliter les recherches et les affichages.

---

# 9. Orientation

Le triage peut proposer ou définir un circuit.

Exemples de circuits :

```text
critical
acute
standard
ambulatory
observation
isolation
```

Les circuits sont configurables.

L’orientation ne réserve pas obligatoirement une ressource.

Exemple :

```text
orientation = acute
care_stage  = waiting_care
resource    = aucune
```

---

# 10. Worklists — remplacement de la file unique

La file globale actuelle reste possible comme vue générale, mais le système doit surtout proposer plusieurs **worklists calculées** à partir des mêmes visites.

Aucune position n’est stockée définitivement.

## 10.1 À trier

Patients :

```text
care_stage = triage_pending
```

## 10.2 Attente de soins

Patients :

```text
care_stage = waiting_care
```

Tri recommandé :

1. priorité clinique ;
2. règles d’escalade configurées ;
3. heure d’arrivée ;
4. identifiant de visite.

## 10.3 En soins

```text
care_stage = in_care
```

## 10.4 Examens / résultats en attente

Patients avec au moins une tâche ou un examen en attente.

## 10.5 Observation

```text
care_stage = in_observation
```

## 10.6 Décision / disposition en attente

```text
care_stage = disposition_pending
```

Cette vue est importante pour identifier les patients qui doivent être hospitalisés ou transférés mais qui restent physiquement aux urgences.

## 10.7 À réévaluer

Vue calculée à partir :

- de la priorité ;
- du délai depuis le dernier triage ;
- des événements récents ;
- du protocole configuré.

Une alerte de délai ne modifie jamais automatiquement la priorité clinique.

---

# 11. Appel du patient

L’appel reste une action indépendante.

Il ne change pas automatiquement `care_stage`.

Il enregistre :

```text
last_called_at
call_count
called_by
```

La visite peut continuer d’apparaître dans sa worklist tant qu’une autre action n’a pas changé son état.

---

# 12. Modèle des zones, salles et ressources

Le plan représente le bâtiment et les ressources opérationnelles.

Structure :

```text
Hospital / Emergency Department
        ↓
       Zone
        ↓
       Room
        ↓
     Resource
```

## 12.1 Zones

Exemples :

```text
Triage
Déchoquage / SAUV
Soins aigus
Surveillance rapide
Soins ambulatoires
Observation
Isolement
```

## 12.2 Salles

Exemples :

```text
Salle SAUV 1
Salle SAUV 2
Box A
Box B
Secteur ambulatoire
Salle observation
```

## 12.3 Ressources

Une ressource n’est plus forcément un lit.

`resource_type` :

```text
bed
chair
box
triage_station
consultation_station
other
```

Exemples :

```text
Lit D1
Lit D2
Box A1
Fauteuil 1
Poste triage 1
```

---

# 13. État opérationnel des ressources

L’occupation et la disponibilité opérationnelle sont séparées.

## 13.1 Occupation

L’occupation est calculée à partir de `resource_assignments`.

Une ressource est occupée si elle possède une affectation active.

## 13.2 État opérationnel

Champ recommandé :

```text
operational_status
```

Valeurs :

```text
ready
cleaning
maintenance
blocked
out_of_service
```

Ainsi :

```text
Lit D1
occupation          = libre
operational_status  = cleaning
```

signifie que le lit est vide mais pas encore utilisable.

---

# 14. Affectation d’une ressource

Une affectation est un objet métier distinct.

Table :

```text
resource_assignments
```

Champs principaux :

```text
id
visit_id
resource_id
assigned_at
assigned_by
released_at
released_by
assignment_reason
```

## Règles

- une ressource ne peut avoir qu’une affectation active ;
- une visite ne peut avoir qu’une ressource principale active, sauf cas explicitement prévu ;
- une ressource doit être active et `ready` ;
- la compatibilité de la zone et du type de ressource doit être vérifiée ;
- le backend doit refaire toutes les validations au moment de la transaction.

---

# 15. Placement

Workflow :

```text
patient waiting_care
      ↓
professionnel ouvre "Affecter une ressource"
      ↓
système affiche les ressources autorisées et utilisables
      ↓
professionnel choisit
      ↓
backend revérifie :
  - permissions
  - visite active
  - ressource active
  - ressource ready
  - absence d’affectation active
      ↓
transaction
      ↓
resource_assignment créé
      ↓
localisation mise à jour
      ↓
événement historisé
```

L’affectation d’un lit ne doit pas automatiquement signifier que la consultation a commencé.

---

# 16. Transfert entre ressources

Le transfert est une action normale du workflow.

```text
D1 → D2
Box A → Observation
Fauteuil → Lit
```

Le transfert doit être atomique :

1. vérifier la nouvelle ressource ;
2. créer la nouvelle affectation ;
3. fermer l’ancienne affectation ;
4. enregistrer le mouvement ;
5. conserver la même visite.

Il ne faut jamais :

- clôturer puis recréer la visite ;
- perdre l’historique ;
- avoir temporairement deux affectations principales actives à cause d’une erreur de concurrence.

---

# 17. Localisation du patient

La localisation n’est plus déduite uniquement du statut.

Exemples :

```text
waiting_area
triage
room
resource
diagnostic_area
observation
external_transfer
discharged
```

Le système peut enregistrer une localisation simplifiée lorsqu’aucune ressource précise n’est affectée.

---

# 18. Début de prise en charge

Action :

```text
startCare()
```

Transition principale :

```text
waiting_care → in_care
```

Mais le système peut aussi accepter un démarrage direct depuis `triage_pending` dans un circuit critique.

Le démarrage des soins n’exige pas obligatoirement un lit.

---

# 19. Consultation et soins

Pendant `in_care`, le dossier peut contenir :

- notes cliniques ;
- diagnostic provisoire ;
- actes ;
- prescriptions ;
- examens ;
- tâches ;
- observations ;
- décisions ;
- changements d’orientation ;
- demandes d’avis.

Les permissions dépendent du rôle et du périmètre de prise en charge.

---

# 20. Examens et tâches

Le workflow doit permettre d’attendre un examen ou une action sans bloquer toute la visite.

Exemple :

```text
in_care
   ↓
examen demandé
   ↓
task = pending
   ↓
patient visible dans "Résultats / examens"
   ↓
résultat reçu
   ↓
réévaluation
```

La ressource peut être conservée ou libérée selon le processus local.

---

# 21. Observation

L’observation devient un état propre.

Transition :

```text
in_care → in_observation
```

Le patient peut :

- garder la même ressource ;
- être transféré vers une zone d’observation ;
- être réévalué ;
- revenir en `in_care` ;
- passer à `disposition_pending`.

---

# 22. Aggravation et escalade

À tout moment avant `completed`, une aggravation peut déclencher :

```text
priority update
orientation update
critical_flag
team alert
resource transfer
care_stage update
```

Exemple :

```text
P3 en observation
      ↓
aggravation
      ↓
réévaluation
      ↓
P1
      ↓
SAUV
      ↓
in_care
```

Le système doit conserver tout l’historique.

---

# 23. Décision médicale et disposition

La décision finale est indépendante du statut physique.

Champ :

```text
outcome
```

Valeurs proposées :

```text
discharged
admitted
transferred
left_before_seen
left_during_care
other
```

Lorsqu’une décision existe mais que le patient reste aux urgences :

```text
care_stage = disposition_pending
```

Exemple :

```text
outcome = admitted
care_stage = disposition_pending
```

Le patient reste visible jusqu’à son départ réel du service.

---

# 24. Boarding / attente d’hospitalisation

Le système doit distinguer :

```text
patient medically ready for admission
```

de :

```text
patient physically transferred out of ED
```

Cette différence permet de mesurer les patients en attente de lit d’hospitalisation.

Le dashboard doit pouvoir afficher :

- nombre de patients `disposition_pending` ;
- temps depuis la décision d’hospitalisation ;
- ressources des urgences encore occupées par ces patients.

---

# 25. Clôture

La visite ne passe à `completed` que lorsque le passage aux urgences est réellement terminé.

Exemples :

```text
sortie physique
transfert effectif
hospitalisation avec départ du service
départ du patient
```

Lors de la clôture :

- `outcome` doit être renseigné ;
- l’heure de fin est enregistrée ;
- les affectations actives sont fermées ;
- la ressource est libérée ;
- la ressource peut passer en `cleaning` ;
- un événement de clôture est ajouté.

---

# 26. Nettoyage, maintenance et retour en service

Libérer une ressource ne signifie pas forcément qu’elle devient immédiatement disponible.

Exemple :

```text
patient leaves D1
      ↓
assignment released
      ↓
D1 occupation = libre
      ↓
operational_status = cleaning
      ↓
nettoyage terminé
      ↓
operational_status = ready
```

La maintenance suit le même principe.

---

# 27. Plan des salles et ressources

Le plan doit afficher une hiérarchie :

```text
ZONE
  └── SALLE
       └── RESSOURCE
```

## Une carte de ressource libre affiche

- nom ;
- type ;
- état opérationnel ;
- équipements / capacités utiles ;
- salle ;
- zone.

## Une carte occupée affiche

- identité autorisée du patient ;
- priorité ;
- code visite ;
- étape de soins ;
- heure d’affectation ;
- équipe responsable ;
- alertes importantes.

Le motif clinique détaillé ne doit pas être affiché partout par défaut.

---

# 28. Filtres du plan

Filtres recommandés :

```text
Tous
Libres
Occupés
Ready
Nettoyage
Maintenance
Bloqués
P1/P2
Ma salle
Mon équipe
Observation
Disposition pending
```

Recherche :

```text
nom patient
code visite
ressource
salle
zone
```

---

# 29. Dashboard opérationnel

Le dashboard ne doit pas afficher uniquement le taux d’occupation.

Indicateurs utiles :

```text
patients arrivés
patients à trier
patients waiting_care
P1/P2 actifs
patients à réévaluer
patients in_care
patients in_observation
patients disposition_pending
ressources libres et ready
ressources cleaning
ressources maintenance
temps d’attente
temps depuis décision d’hospitalisation
```

---

# 30. Niveaux de charge

Le système peut calculer un niveau opérationnel configurable :

```text
normal
high_load
saturated
```

Ces niveaux ne doivent pas être basés uniquement sur le pourcentage de lits occupés.

Ils peuvent prendre en compte :

- occupation ;
- nombre de P1/P2 ;
- file d’attente ;
- nombre de ressources indisponibles ;
- patients en attente de disposition ;
- capacité des équipes ;
- délais.

Les seuils sont configurables.

---

# 31. Workflow de saturation

Lorsque l’état devient `high_load` ou `saturated`, le système ne modifie pas les décisions cliniques.

Il :

- met en évidence les goulots d’étranglement ;
- alerte le chef / superviseur ;
- affiche les ressources en nettoyage ou bloquées ;
- affiche les patients en attente de disposition ;
- met en avant les patients nécessitant une réévaluation ;
- facilite la redistribution des équipes selon les droits ;
- journalise l’activation d’une procédure locale de capacité.

---

# 32. Équipes et responsabilités

L’équipe ne doit plus être obligatoirement figée à une salle de manière définitive.

Tables proposées :

```text
care_teams
care_team_members
care_team_assignments
```

Un professionnel peut avoir :

- une équipe principale ;
- une affectation temporaire ;
- un périmètre de salle ;
- un périmètre patient.

Une visite peut avoir :

```text
responsible_nurse
responsible_doctor
responsible_team
```

avec historique.

---

# 33. Rôles

Rôles principaux :

```text
reception
nurse
doctor
chief
admin
```

Les rôles donnent des capacités de base.

Les droits réels dépendent aussi :

- de l’équipe ;
- de la salle ;
- de la visite ;
- de l’action ;
- du contexte.

---

# 34. Accueil

Peut :

- créer / identifier un patient ;
- créer la visite ;
- compléter les informations administratives ;
- appeler ;
- suivre le statut administratif autorisé.

Ne peut pas par défaut :

- valider le triage clinique ;
- modifier la priorité finale ;
- décider une sortie médicale ;
- effectuer une action clinique.

---

# 35. Infirmier

Peut selon ses permissions :

- faire le triage ;
- faire une réévaluation ;
- ajuster la priorité ;
- orienter ;
- affecter une ressource ;
- transférer un patient ;
- documenter soins et surveillance ;
- démarrer certaines étapes de prise en charge ;
- déclencher une escalade ;
- participer à la clôture si le workflow local l’autorise.

---

# 36. Médecin

Peut selon ses permissions :

- ouvrir les dossiers qui lui sont affectés ;
- démarrer / poursuivre la consultation ;
- documenter diagnostics et décisions ;
- prescrire ;
- demander des examens ;
- réévaluer ;
- décider une sortie, hospitalisation ou transfert ;
- transférer la responsabilité médicale.

---

# 37. Chef / superviseur

Peut :

- voir l’ensemble du flux ;
- voir la charge et les blocages ;
- voir toutes les ressources ;
- superviser les affectations ;
- effectuer certaines actions exceptionnelles autorisées ;
- redistribuer des responsabilités ;
- activer une procédure de capacité ;
- voir les indicateurs opérationnels.

Toute action exceptionnelle doit être auditée.

---

# 38. Administrateur

Gère :

- comptes ;
- rôles ;
- permissions ;
- zones ;
- salles ;
- ressources ;
- types de ressources ;
- équipes ;
- paramètres ;
- seuils opérationnels.

L’administrateur ne devient pas automatiquement un acteur clinique.

---

# 39. Historique métier

Conserver et enrichir :

```text
visit_events
```

Événements recommandés :

```text
visit.registered
visit.administrative_updated

triage.requested
triage.completed
triage.reassessed
priority.changed

orientation.changed

patient.called

care.started
care.paused
care.resumed

resource.assigned
resource.transferred
resource.released

observation.started
observation.ended

disposition.decided
disposition.changed

visit.completed

capacity.high_load
capacity.saturated
```

Chaque événement contient au minimum :

```text
event_id
visit_id
event_type
actor_type
actor_id
timestamp
metadata
```

---

# 40. Audit

Créer également :

```text
audit_logs
```

Pour tracer :

- accès sensibles ;
- modifications administratives ;
- changements de permission ;
- changements de configuration ;
- actions exceptionnelles ;
- opérations effectuées par un futur agent.

`visit_events` décrit l’histoire métier.

`audit_logs` décrit la traçabilité de sécurité.

---

# 41. Transactions et concurrence

Toutes les actions importantes doivent être transactionnelles.

En particulier :

```text
create visit
assign resource
transfer resource
release resource
close visit
change critical priority
```

Le backend doit empêcher :

- deux visites sur la même ressource ;
- deux affectations principales actives pour la même visite ;
- deux visites actives interdites pour le même patient ;
- les doubles validations dues à des clics répétés ;
- les états impossibles.

---

# 42. Services métier recommandés

Le frontend ne doit pas modifier directement la base.

```text
VisitService
  registerVisit()
  updateAdministrativeData()
  completeVisit()

TriageService
  startTriage()
  recordTriage()
  reassess()
  updatePriority()
  updateOrientation()

QueueService
  getTriageQueue()
  getCareQueue()
  getReassessmentQueue()

ResourceService
  listResources()
  listAvailableResources()
  assignResource()
  transferResource()
  releaseResource()
  changeOperationalStatus()

CareService
  startCare()
  saveClinicalNote()
  requestExam()
  recordResult()
  startObservation()
  endObservation()
  decideDisposition()

TeamService
  assignTeam()
  assignProfessional()
  transferResponsibility()

CapacityService
  calculateLoad()
  activateEscalation()
  closeEscalation()
```

---

# 43. Architecture technique cible

```text
FRONTEND
   ↓
API / AUTH
   ↓
PERMISSION ENGINE
   ↓
DOMAIN SERVICES
   ↓
RULES / VALIDATIONS
   ↓
DATABASE
   ↓
EVENTS / AUDIT
```

Les règles importantes doivent vivre dans le backend.

Le frontend sert à présenter et déclencher les actions.

---

# 44. Architecture ouverte à l’automatisation future

La V3 fonctionne entièrement sans IA.

Cependant, les services métier doivent pouvoir être appelés plus tard par d’autres composants autorisés.

Aucun futur agent ne doit écrire directement dans la base.

Architecture future :

```text
          USERS
            ↓
         FRONTEND
            ↓
        API / AUTH
            ↓
      ACTION GATEWAY
            ↓
   PERMISSIONS + RULES
            ↓
      DOMAIN SERVICES
            ↓
         DATABASE
```

Un futur agent passe par `ACTION GATEWAY` exactement comme une interface contrôlée.

---

# 45. Modes futurs des agents

Ces modes ne sont pas nécessaires pour la V3 actuelle.

Ils sont seulement réservés dans la conception.

## 45.1 `disabled`

Aucun agent actif.

Mode initial recommandé lors du déploiement de la V3.

## 45.2 `collaborative`

Mode futur par défaut.

L’agent :

- analyse ;
- signale ;
- propose ;
- explique.

Un professionnel valide les décisions cliniques.

Exemple futur :

```text
AI priority suggestion = P2
clinician priority      = P1
final priority          = P1
```

## 45.3 `supervised_autonomy`

L’agent peut exécuter automatiquement uniquement les actions explicitement autorisées et à risque limité.

Exemples possibles :

- créer une alerte ;
- créer une tâche de réévaluation ;
- préparer une synthèse ;
- identifier des ressources compatibles ;
- mettre à jour une worklist ;
- déclencher une notification ;
- préparer une proposition de transfert.

Les règles du backend restent obligatoires.

## 45.4 `full_control_simulation`

Mode réservé :

```text
development
sandbox
simulation
formation
tests
```

L’agent peut simuler :

```text
triage
orientation
affectation
transfert
observation
disposition
clôture
```

sur des patients fictifs.

Il permet de tester la plateforme sous charge.

Le `full_control_simulation` n’est pas le mode clinique de production.

---

# 46. Futur triage assisté par agent

Préparer les champs sans les utiliser maintenant :

```text
ai_priority
ai_confidence
ai_reason
ai_model
ai_run_id
```

La priorité clinique réelle reste :

```text
clinician_priority
final_priority
validated_by
validated_at
```

Le système doit toujours pouvoir fonctionner avec :

```text
ai_priority = null
```

---

# 47. Action Gateway futur

Lorsqu’un agent est ajouté, toute action passe par :

```text
AGENT
   ↓
ACTION GATEWAY
   ↓
mode autorisé ?
   ↓
permission autorisée ?
   ↓
validation humaine requise ?
   ↓
règles métier valides ?
   ↓
DOMAIN SERVICE
   ↓
DATABASE
```

Cela permet de changer de fournisseur ou de modèle IA plus tard sans reconstruire le cœur de l’application.

---

# 48. Écrans principaux

## 48.1 Accueil

Affiche :

- nouvel enregistrement ;
- recherche patient ;
- visites actives ;
- patients appelables ;
- statut administratif.

## 48.2 Triage

Affiche :

- patients à trier ;
- priorité ;
- données de triage ;
- réévaluations ;
- orientation ;
- patients signalés critiques.

## 48.3 Worklists

Onglets :

```text
À trier
Attente soins
En soins
Examens / résultats
Observation
Disposition
À réévaluer
```

## 48.4 Plan des ressources

Vue :

```text
Zone
  Salle
    Ressource
```

Avec filtres et disponibilité opérationnelle.

## 48.5 Dossier patient

Onglets :

```text
Résumé
Triage
Soins
Examens
Observation
Mouvements
Équipe
Décision
Historique
```

## 48.6 Command Center / Chef

Affiche :

- flux global ;
- saturation ;
- P1/P2 ;
- temps d’attente ;
- ressources ;
- observation ;
- boarding ;
- alertes ;
- réévaluations dues.

---

# 49. Exemple complet

## Étape 1 — arrivée

Amina arrive avec douleur thoracique.

```text
care_stage = registered
```

## Étape 2 — triage

L’infirmier réalise le triage.

```text
priority    = P2
orientation = acute
care_stage  = waiting_care
```

## Étape 3 — attente

Amina apparaît dans :

```text
Attente soins
P2
```

## Étape 4 — affectation

D1 est :

```text
occupation         = libre
operational_status = ready
```

L’infirmier l’affecte.

```text
resource = D1
```

Amina disparaît de la worklist des patients sans ressource, mais reste visible dans les vues pertinentes.

## Étape 5 — soins

```text
care_stage = in_care
```

Le médecin démarre la prise en charge.

## Étape 6 — examens

Un examen est demandé.

```text
exam.status = pending
```

Amina apparaît également dans la worklist :

```text
Examens / résultats
```

## Étape 7 — observation

Après évaluation :

```text
care_stage = in_observation
```

Elle est transférée :

```text
D1 → OBS-1
```

D1 est libéré puis passe en nettoyage.

## Étape 8 — décision

Le médecin décide une hospitalisation.

```text
outcome    = admitted
care_stage = disposition_pending
```

Amina reste physiquement en OBS-1.

Elle apparaît dans :

```text
Disposition pending
```

## Étape 9 — transfert effectif

Un lit d’hospitalisation devient disponible.

Amina quitte les urgences.

```text
care_stage = completed
```

OBS-1 est libéré puis passe en nettoyage.

---

# 50. Exemple critique

Un patient arrive en ambulance, instable.

Le workflow autorise :

```text
ARRIVÉE
   ↓
critical_flag = true
   ↓
SAUV immédiatement
   ↓
resource D1
   ↓
in_care
   ↓
triage / administratif complétés en parallèle
```

Le système ne force pas :

```text
accueil → attente → appel → lit
```

pour un patient critique.

---

# 51. Exemple d’aggravation

Patient P3 en observation.

```text
P3
↓
nouveau signe inquiétant
↓
réévaluation infirmier
↓
P1
↓
critical_flag
↓
transfert OBS-2 → D2
↓
in_care
```

Tout changement est historisé.

---

# 52. Exemple de saturation

Le service contient :

```text
10 ressources
9 occupées
1 nettoyage
6 patients waiting_care
3 patients disposition_pending
2 P1/P2
```

Le système peut passer :

```text
load_status = saturated
```

Le Command Center affiche :

- aucune ressource immédiatement `ready` ;
- patients à réévaluer ;
- ressources en nettoyage ;
- patients en attente d’hospitalisation ;
- charge P1/P2 ;
- actions de coordination disponibles au chef.

Il ne change automatiquement aucune priorité clinique.

---

# 53. Structure de données cible

Tables principales recommandées :

```text
patients
visits

triage_assessments

zones
rooms
resources
resource_assignments
resource_status_events

care_teams
care_team_members
care_team_assignments

consultations
clinical_notes
care_tasks
exams

visit_events
audit_logs
```

Tables futures possibles :

```text
agent_runs
agent_recommendations
agent_actions
agent_approvals
```

Elles ne sont pas nécessaires maintenant.

---

# 54. Colonnes principales de `visits`

Exemple :

```text
id
public_code
patient_id

care_stage

current_priority
current_orientation
critical_flag

outcome

arrived_at
care_started_at
disposition_decided_at
completed_at

created_by
created_at
updated_at
```

La salle et le lit ne doivent pas être stockés comme unique source de vérité dans `visits`.

Ils sont obtenus depuis l’affectation active.

---

# 55. Contraintes importantes en base

À implémenter autant que possible comme contraintes, index uniques ou transactions :

```text
1 active visit / patient selon règle locale

1 active main resource_assignment / visit

1 active resource_assignment / resource

valid care_stage transitions

resource must be active

resource operational_status must allow assignment
```

Les vérifications frontend ne suffisent pas.

---

# 56. Règles de transition

Transitions principales :

```text
registered
   → triage_pending
   → waiting_care
   → in_care
   → in_observation
   → disposition_pending
   → completed
```

Mais certaines transitions alternatives sont nécessaires :

```text
registered → in_care
```

pour circuit critique.

```text
in_observation → in_care
```

pour aggravation.

```text
waiting_care → completed
```

pour départ avant prise en charge, selon workflow autorisé.

```text
in_care → completed
```

pour sortie directe.

```text
in_care → disposition_pending
```

pour admission / transfert.

Le moteur de transitions doit être centralisé dans le backend.

---

# 57. Ce qui remplace les anciens statuts

Ancien modèle :

```text
waiting
placed
in_treatment
discharged
transferred
left_without_seen
```

Nouveau modèle :

```text
care_stage
current_priority
resource_assignment
outcome
```

Exemples :

```text
ancien waiting
→ care_stage = triage_pending ou waiting_care
```

```text
ancien placed
→ care_stage = waiting_care
  + active resource_assignment
```

```text
ancien in_treatment
→ care_stage = in_care
  + active resource_assignment éventuelle
```

```text
ancien discharged
→ care_stage = completed
  + outcome = discharged
```

```text
ancien transferred
→ care_stage = completed
  + outcome = transferred
```

```text
ancien left_without_seen
→ care_stage = completed
  + outcome = left_before_seen
```

---

# 58. Plan de migration depuis la version actuelle

## Phase 1 — compatibilité

Ajouter :

```text
care_stage
current_priority
current_orientation
critical_flag
outcome
```

sans supprimer immédiatement l’ancien `status`.

## Phase 2 — ressources

Créer ou adapter :

```text
zones
rooms
resources
resource_assignments
resource_status_events
```

Migrer les affectations actuelles.

## Phase 3 — triage

Créer :

```text
triage_assessments
```

Migrer la priorité actuelle comme évaluation initiale ou comme donnée historique migrée.

## Phase 4 — services métier

Déplacer les actions actuelles vers :

```text
VisitService
TriageService
ResourceService
CareService
TeamService
```

## Phase 5 — nouvelles vues

Ajouter :

```text
Triage Board
Worklists
Smart Resource Board
Command Center
```

## Phase 6 — suppression de la dépendance à l’ancien statut

Le champ historique peut être conservé temporairement en lecture seule.

Les nouvelles règles utilisent le nouveau modèle.

## Phase 7 — architecture future

Ajouter seulement les points d’extension nécessaires :

```text
Action Gateway
structured events
service APIs
audit
```

Aucun agent IA n’est requis.

---

# 59. Critères d’acceptation essentiels

La V3 est considérée fonctionnelle lorsque :

- [ ] un patient critique peut être pris en charge sans être bloqué par l’administratif ;
- [ ] le triage et les réévaluations sont historisés ;
- [ ] la priorité est indépendante du lit ;
- [ ] une consultation peut exister sans lit ;
- [ ] un patient peut changer de lit sans changer de visite ;
- [ ] l’occupation d’une ressource est indépendante de son état opérationnel ;
- [ ] un lit en nettoyage n’est pas proposé comme disponible ;
- [ ] deux patients ne peuvent jamais occuper la même ressource ;
- [ ] une visite ne peut pas perdre son historique lors d’un transfert ;
- [ ] l’observation est une étape distincte ;
- [ ] une décision d’hospitalisation peut exister avant le départ réel des urgences ;
- [ ] le boarding est visible ;
- [ ] les patients à réévaluer sont visibles ;
- [ ] le chef dispose d’une vue de saturation ;
- [ ] les permissions sont vérifiées côté backend ;
- [ ] les actions critiques sont transactionnelles ;
- [ ] `visit_events` conserve l’histoire métier ;
- [ ] les accès sensibles sont audités ;
- [ ] la plateforme fonctionne entièrement sans IA ;
- [ ] de futurs agents pourront appeler les services sans accès direct à la base.

---

# 60. Résumé cible

```text
                EMERGENCY FLOW V3

ARRIVÉE
   ↓
CRITICAL CHECK ───────→ SAUV IMMÉDIAT SI NÉCESSAIRE
   ↓
TRIAGE / RÉÉVALUATION
   ↓
PRIORITÉ P1–P5
   ↓
ORIENTATION
   ↓
WORKLIST
   ↓
RESSOURCE SI NÉCESSAIRE
   ↓
PRISE EN CHARGE
   ↓
EXAMENS / SOINS
   ↓
RÉÉVALUATION
   ↕
OBSERVATION
   ↓
DÉCISION
   ↓
SORTIE / HOSPITALISATION / TRANSFERT
   ↓
DÉPART RÉEL
   ↓
CLÔTURE
   ↓
LIBÉRATION
   ↓
NETTOYAGE / MAINTENANCE
   ↓
RESSOURCE READY
```

Architecture des données :

```text
VISITE
 ├── priorité clinique
 ├── étape de soins
 ├── orientation
 ├── localisation
 ├── affectation de ressource
 ├── équipe responsable
 ├── décision
 └── historique
```

Architecture future :

```text
Human Users
     │
Future Agents
     │
     ↓
ACTION GATEWAY
     ↓
PERMISSIONS
     ↓
RULES
     ↓
DOMAIN SERVICES
     ↓
DATABASE
```

Le système doit rester opérationnel même si aucun agent n’est installé ou disponible.

---

# 61. Décision d’architecture

La V3 adopte donc les choix suivants :

1. **La visite reste l’objet central du parcours.**
2. **Le statut unique surchargé est remplacé par plusieurs dimensions métier.**
3. **Le triage devient une étape explicite et réévaluable.**
4. **Le circuit critique peut bypasser l’attente administrative normale.**
5. **La file unique devient un ensemble de worklists calculées.**
6. **Les lits deviennent des ressources typées parmi d’autres.**
7. **Occupation et disponibilité opérationnelle sont séparées.**
8. **Les transferts deviennent des opérations normales et historisées.**
9. **Observation et disposition sont représentées explicitement.**
10. **La saturation est traitée comme un problème de flux global, pas seulement comme un taux de lits occupés.**
11. **Les équipes et responsabilités deviennent flexibles mais contrôlées.**
12. **Toutes les actions critiques passent par des services métier et des transactions.**
13. **L’architecture est ouverte aux futurs agents, sans dépendre d’eux.**
14. **Le mode futur par défaut des agents sera collaboratif.**
15. **L’autonomie supervisée pourra être ajoutée pour les actions autorisées.**
16. **Le contrôle total des agents est réservé aux simulations et tests.**

---

## Fin du document

Cette spécification remplace fonctionnellement l’ancien workflow tout en permettant une migration progressive sans réécriture brutale de la plateforme.
