# Présentation à créer — PICU

Brief pour la soutenance orale, rédigé à partir du rapport de stage.
Ce fichier décrit le fil, le contenu de chaque slide et les visuels à préparer. Les slides elles-mêmes seront produites plus tard.

---

## Cadre

| Élément | Valeur |
|---|---|
| Titre | PICU — Plateforme Intelligente de Coordination des Urgences |
| Type | Rapport de stage de fin d'année |
| Auteur | Younes Basir |
| Établissement | Université Privée de Fès — Département Informatique |
| Terrain | Centre Hospitalier Universitaire Hassan II de Fès |
| Année | 2024-2025 |
| Durée cible | 15 à 20 minutes + questions |
| Nombre de slides | 16 |

**Phrase d'accroche à retenir :** l'IA assiste, l'humain décide.

**Message d'ingénierie à répéter :** ce qui fait la valeur de PICU, c'est un workflow transactionnel explicite et vérifié, pas seulement des écrans.

---

## Fil narratif

1. Le service des urgences manque de visibilité et de coordination.
2. PICU centralise le parcours patient, de l'accueil à la clôture, et le synchronise en temps réel.
3. Le cœur d'ingénierie est la machine à états de la visite, sécurisée par transactions et verrous.
4. Des modules avancés étendent la plateforme : triage structuré, plan des lits, supervision SLA, examens et tâches, transferts et relèves.
5. Une couche d'IA supervise l'assistance, sans jamais décider seule.
6. La plateforme est un socle robuste évalué hors production, pas encore un système déployé à l'hôpital.

Ne pas dérouler les six chapitres un par un. Le jury doit suivre le parcours patient et les garanties d'ingénierie, pas la table des matières.

---

## Slides

### 1 — Page de titre

**À l'écran**

- PICU
- Plateforme Intelligente de Coordination des Urgences
- Younes Basir
- Université Privée de Fès · CHU Hassan II de Fès
- Année universitaire 2024-2025
- Logos UPF et CHU

**Oral (30 s)**
Se présenter, nommer le stage et le service. Annoncer que la présentation suit le parcours d'un patient, de l'arrivée à la sortie, en insistant sur la fiabilité du socle.

---

### 2 — Plan

**À l'écran**

1. Contexte et problématique
2. Besoins et acteurs
3. Méthodologie et conception
4. Réalisation : parcours, ressources, supervision, IA
5. Qualité, sécurité et CI/CD
6. Bilan et perspectives

**Oral (20 s)**
Dire que le cœur est le workflow transactionnel et l'assistance IA supervisée.

---

### 3 — Le terrain

**À l'écran**

- CHU Hassan II : soins, enseignement, recherche, référence régionale Fès–Meknès
- Urgences ouvertes en permanence, adultes et pédiatrie
- Zones : Triage, Déchocage, Pédiatrie, Médecine, Chirurgie, Observation

**Visuel**
Schéma simple des six zones, sans organigramme administratif.

**Oral (1 min)**
Le volume d'arrivées rend l'organisation des flux, des lits et du personnel critique. PICU s'adresse à ce service, pas à l'hôpital entier.

---

### 4 — Ce qui se passe aujourd'hui

**À l'écran — circuit actuel, 4 étapes**

1. Accueil : identité, motif, mode d'arrivée
2. Triage : priorité P1 à P5
3. Orientation : zone, file, lit ou salle, médecin
4. Correction : le médecin peut changer de zone si l'orientation est fausse

**Sous le circuit, les limites**

- pas de vision temps réel de l'occupation
- informations dispersées (oral, papier, outils non reliés)
- ressaisies et pertes
- pas de mesure de la qualité du triage
- attentes allongées par manque de synchronisation

**Oral (1 min 30)**
Le triage reste une décision clinique. Le problème n'est pas l'absence de personnel, c'est l'absence d'un outil commun.

---

### 5 — Problématique et objectifs

**À l'écran — une question**

Comment coordonner les urgences en temps réel, assister le triage par l'IA, et garantir un workflow fiable et traçable de l'arrivée à la sortie ?

**Objectifs, une ligne chacun**

- centraliser patients, visites, ressources et personnel
- modéliser un workflow transactionnel explicite et auditable
- voir l'activité en temps réel sur des vues par rôle
- assister le triage par une IA **supervisée**
- superviser les délais (SLA) et les ressources
- tracer chaque décision

**Oral (1 min)**
Lire la question, puis les objectifs sans les commenter un par un.

---

### 6 — PICU en une vue

**À l'écran**

Application web : tableaux de bord par rôle, file d'attente, plan des lits, supervision, Socket.IO.

**Parcours en une ligne**

Enregistrement → attente → appel → placement (ressource) → consultation → clôture (ou retour en file / transfert)

**Acteurs**

| Rôle | Rôle dans PICU |
|---|---|
| Réceptionniste | patient, visite, appel |
| Infirmier | triage, plan des lits, tâches, examens |
| Médecin | consultation, transfert, réaffectation |
| Chef de service | supervision, SLA, alertes, capacité |
| Administrateur | comptes, rôles, configuration |
| Patient | suivi par code public |

**Visuel**
Diagramme de cas d'utilisation (`use_case_diagram.png`), version allégée si le schéma complet est illisible en projection.

**Oral (1 min 30)**
Insister sur le workflow : chaque action est une transition contrôlée, pas une modification libre de champ.

---

### 7 — Architecture

**À l'écran — trois couches**

| Couche | Techno |
|---|---|
| Présentation | React 19, Vite, Tailwind CSS |
| Application | Node.js, Express, API REST, Socket.IO, JWT, RBAC |
| Données | PostgreSQL (Neon) |

**À côté, trois points seulement**

- séparation routes / services / base (`*Routes.js`, `*Service.js`)
- temps réel : `visit:status_changed`, `queue:updated`, `visit:timeline_updated`
- repli par interrogation périodique si le canal tombe

**Visuel**
Schéma vertical Client → API → PostgreSQL, avec une flèche Socket.IO en retour (`architecture_picu.png`). Pas de liste de fichiers.

**Oral (1 min 30)**
L'architecture est classique et modulaire. Le choix important est le temps réel : un appel ou un placement met à jour tous les postes sans rechargement.

---

### 8 — Le workflow, cœur du système

**À l'écran — la machine à états**

`waiting → placed → in_treatment → discharged / transferred / left_without_seen`

**Ce qui garantit la fiabilité**

- transitions autorisées uniquement
- transactions PostgreSQL + verrous (`FOR UPDATE`)
- clés d'idempotence (pas de doublon)
- un seul lit affecté à la fois
- journal `visit_events` (acteur, états source/cible, horodatage)

**Visuel**
Diagramme d'activité (`activity_diagram.png`).

**Oral (1 min 30)**
C'est le vrai apport : l'appel ne sort pas le patient de la file ; un transfert de lit reste en traitement ; une réaffectation remet le patient en attente.

---

### 9 — Démo du parcours (ou captures)

**À l'écran, dans l'ordre, une capture par rôle**

1. Connexion
2. Dashboard accueil : enregistrement et file
3. Dashboard infirmier : triage et plan des lits
4. Dashboard médecin : patients actifs, transfert
5. Dashboard chef : supervision

**Scénario à raconter**

1. Enregistrement : le patient entre en file (`waiting`).
2. L'infirmier trie puis affecte un lit (`placed`).
3. Le médecin démarre la consultation (`in_treatment`), puis clôture, ou transfère le lit.

**Oral (3 min)**
C'est le cœur de la soutenance. Si une démo live est possible, s'arrêter ici. Sinon enchaîner les captures sans lire l'interface.

**Captures à avoir prêtes** (dossier `rapport-stage/images/`)

- `login_screen.png`
- `dashboard_receptionniste.png`
- `dashboard_infirmier.png`
- `dashboard_medecin.png`
- `dashboard_chef.png`

Administrateur : une seule slide suivante, pas dans ce fil.

---

### 10 — Les autres tableaux de bord

**À l'écran**

- Chef de service : pipeline patients, SLA, alertes, capacité, équipes de salle
- Administrateur : utilisateurs, rôles, configuration
- Patient : suivi web par code public (statut en temps réel)

**Oral (45 s)**
Même donnée, vues différentes. Ne pas détailler les écrans.

---

### 11 — L'assistance IA, supervisée

**À l'écran — principes**

- fournisseur : NVIDIA NIM (modèles fast / reasoning / embedding)
- quatre intentions : triage, flux de lits, capacité, documentation
- chaque appel tracé (`agent_runs`, `agent_recommendations`)

**Politique d'actions**

| Outil IA | Risque | Approbation |
|---|---|---|
| triage / clôture | critique | oui |
| placement / transfert | haut | oui |
| appel / retour | moyen | oui |
| tâche de réévaluation | faible | non (supervisé) |

**Garde-fous**

- mode `disabled / collaborative / supervised_autonomy / full_control_simulation`
- le mode simulation est interdit sur des visites réelles
- mode « shadow » pour comparer la proposition IA à la décision humaine

**Oral (2 min)**
L'IA ne pose pas de diagnostic. Elle propose, journalise, et n'agit seule que sur des actions à faible risque. Toute action clinique exige une approbation humaine.

**Visuel**
Schéma pipeline : réception → agent → recommandation → politique → approbation humaine → action.

---

### 12 — Ce qui a été vérifié

**À l'écran — un tableau, rien d'autre**

| Test / script | Vérifie |
|---|---|
| `test:v4` | Lit en nettoyage non affectable ; libération → nettoyage ; transition « prêt » refusée |
| `test:supervision` | Un seuil SLA non approuvé reste inactif |
| `test:registration` | Indices d'enregistrement sans modifier la priorité clinique |
| Cas concurrence | Deux affectations simultanées du même lit → un succès, un conflit |
| Cas idempotence | Double enregistrement → une seule visite |
| Parcours E2E | Transitions cohérentes, aucun code inattendu |

**Sous le tableau, une phrase**

La fiabilité ne vient pas de l'écran, mais des contraintes en base et des tests.

**Oral (1 min 30)**
Expliquer le cas de concurrence : c'est l'exemple qui montre la différence entre une maquette et un système.

**Visuel**
Tableau seul (pas de capture d'exécution).

---

### 13 — Sécurité et industrialisation

**À l'écran — trois lignes**

| Domaine | Mise en œuvre |
|---|---|
| Accès | RBAC par capacités + JWT, comptes inactifs rejetés |
| Intégrité / traçabilité | Transactions, contraintes SQL, journal `visit_events` |
| Secrets / CI | `.env` jamais versionnés ; pipeline GitHub Actions « secret guard » |

**Oral (1 min)**
Expliquer que le contrôle d'accès est à deux niveaux (rôle + capacité), et que la CI bloque tout secret committé. Assumer que la CI reste minimale : tests et déploiement automatisés sont une perspective.

---

### 14 — Bilan

**Ce que PICU apporte**

- une seule source pour le parcours patient
- un workflow explicite, fiable et traçable
- des vues par rôle synchronisées en temps réel
- une supervision opérationnelle (SLA, alertes)
- une assistance IA supervisée et journalisée
- un socle prêt pour l'interopérabilité SIH

**Ce que PICU ne fait pas encore**

- pas de déploiement clinique ni de validation médicale
- précision du triage IA perfectible (d'où la supervision)
- CI/CD partielle (secrets couverts, pas encore tests/déploiement)
- pas d'interopérabilité HL7/FHIR avec le SIH
- couverture de tests inégale selon les modules

**Oral (1 min 30)**
Assumer les limites. C'est ce qui distingue un prototype démontré d'un système validé.

---

### 15 — Perspectives

**À l'écran — cinq pistes, du plus proche au plus lointain**

1. Étendre la CI/CD (tests, lint, build, déploiement automatisés)
2. Industrialiser l'évaluation du triage IA en mode shadow
3. Interopérabilité HL7/FHIR avec le SIH du CHU
4. Indicateurs de pilotage avancés (acceptation IA, réaffectation, attente par zone)
5. Démarche de validation clinique encadrée

**Phrase de clôture de la slide**
L'IA assiste, l'humain décide.

**Oral (1 min)**

---

### 16 — Conclusion

**À l'écran**

PICU couvre le parcours patient des urgences du CHU Hassan II : enregistrement, triage, file, placement, consultation, transfert, clôture.

Trois rappels :

- workflow transactionnel explicite et testé
- assistance IA supervisée et traçable
- socle prêt pour l'industrialisation et l'interopérabilité

Merci. Questions.

**Oral (45 s)**
Ne pas relire les perspectives. Revenir à la phrase d'accroche.

---

## Démo live (si la soutenance le permet)

Préparer le scénario avant, avec des comptes déjà créés.

1. Réceptionniste : enregistrer un patient (ou utiliser un patient de démo).
2. Infirmier : trier, affecter un lit libre.
3. Médecin : démarrer la consultation, transférer de lit, puis clôturer.
4. Chef : montrer le pipeline, les SLA et les alertes.
5. Patient : suivre la visite par code public.

Prévoir les captures de la slide 9 en secours si le réseau ou la base ne répondent pas. Ne pas dépendre d'un appel LLM en direct.

---

## Visuels à produire avant de monter les slides

Déjà prévus pour le rapport (`rapport-stage/images/` et `DIAGRAM_PROMPTS.md`) :

| Fichier | Slide |
|---|---|
| `logo_upf.png`, `logo_chu.png` | 1 |
| `use_case_diagram.png` | 6 |
| `architecture_picu.png` | 7 |
| `activity_diagram.png` | 8 |
| `sequence_diagram.png` | annexe orale, pas une slide dédiée |
| `class_diagram.png` | ne pas projeter : illisible |
| captures dashboards | 9 et 10 |

Slides à dessiner en plus du rapport :

- frise du parcours patient (slides 4, 6, 9)
- machine à états (slide 8)
- pipeline IA → politique → approbation (slide 11)

Palette : fond clair, bleu hospitalier, une couleur d'alerte pour P1. Une idée par slide. Pas de blocs de code, pas de dictionnaire de données, pas de liste d'endpoints.

---

## Questions probables

**Pourquoi une IA si elle ne décide pas ?**
Elle accélère et homogénéise une première proposition (priorité, zone, organisation des lits). La décision reste humaine ; toute action clinique exige une approbation.

**L'IA peut-elle se tromper sur un cas vital ?**
Oui, c'est pourquoi elle est encadrée : recommandations journalisées, politique de risque, approbation humaine obligatoire pour le triage et la clôture, mode shadow pour l'évaluation.

**Que se passe-t-il si le médecin conteste la zone ?**
Réaffectation : clôture de la consultation, libération de la ressource, retour du patient en file (`waiting`) dans la nouvelle zone, événement journalisé.

**Pourquoi ne pas avoir laissé le patient « transféré » après une réaffectation ?**
Parce qu'une réaffectation remet le patient dans le flux ; seul un vrai transfert hors service clôture la visite.

**Comment garantissez-vous qu'un lit n'est pas affecté deux fois ?**
Transaction + verrou sur la visite, contrôle d'absence d'affectation active, réponse 409 au second appel. Vérifié par test.

**Qu'est-ce qui a été testé automatiquement ?**
Invariants de ressources (`test:v4`), règles de supervision (`test:supervision`), indices d'enregistrement (`test:registration`), plus des cas de concurrence, d'idempotence et un parcours de bout en bout.

**Pourquoi cette stack ?**
React et Express permettent des tableaux de bord par rôle et une API claire. PostgreSQL porte les contraintes, les transactions et l'audit. Socket.IO synchronise les postes du service.

**Le patient voit-il des données cliniques ?**
Non. Il suit le statut de sa visite avec un code public. Le détail clinique reste sur les postes authentifiés (JWT, rôles) et n'est pas exposé.

**Pourquoi pas d'intégration au dossier hospitalier ?**
Hors périmètre du stage. La perspective est HL7/FHIR ; le modèle (visite, zones, journaux) est conçu pour s'y brancher.

---

## À laisser hors slides

- remerciements et résumé bilingue
- liste des acronymes
- dictionnaire de données et schéma relationnel complet
- catalogue d'endpoints
- détails des migrations, noms de fichiers JSX
- diagramme de classes complet

Ces éléments restent dans le rapport si le jury les demande.
