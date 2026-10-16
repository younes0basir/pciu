# PICU — Contenu complet de la présentation de soutenance

**Projet :** Plateforme Intelligente de Coordination des Urgences (PICU)  
**Stage :** Département Informatique, Direction Générale du CHU Hassan II de Fès  
**Format cible :** 17 diapositives, 18 à 20 minutes (adaptable)  
**Langue :** Français  
**Angle directeur :** De l'analyse métier à la réalisation d'une application hospitalière, avec une démarche d'ingénierie logicielle, des mécanismes de fiabilité et une stratégie de qualité.

> **Important — intégrité académique :** le document d'analyse du dépôt est une référence issue d'une exploration par agent, non une certification indépendante. Avant la soutenance, vérifier les fonctionnalités dans le dépôt, les résultats des tests, l'état de la CI/CD et le statut des évolutions V4. Ne jamais présenter comme déployé, certifié ou validé cliniquement ce qui ne l'est pas. Les textes « à confirmer » sont à personnaliser.

## Guide d'utilisation

Pour chaque diapositive : **Texte à afficher** = contenu bref à placer sur PowerPoint ; **Script oral** = notes du présentateur ; **Visuel / preuve** = image ou artefact à préparer ; **Transition** = phrase de liaison. Ne pas copier le script entier sur la diapositive.

---

# PARTIE I — CONTEXTE ET CADRAGE

## Diapositive 1 — Page de garde (30 s)

### Texte à afficher

**PICU — Plateforme Intelligente de Coordination des Urgences**  
*Conception et développement d'une plateforme web de coordination et de supervision des flux de patients aux urgences*

Stage au Département Informatique — Direction Générale du CHU Hassan II de Fès  
Présenté par : **[Nom et prénom]**  
Encadrant professionnel : **[Nom]** · Encadrant pédagogique : **[Nom]**  
Établissement de formation : **[Nom]** · Année universitaire : **[Année]**

### Script oral

Bonjour Mesdames et Messieurs les membres du jury. Je vous remercie pour votre présence. Je vais vous présenter mon projet de stage, intitulé PICU, une plateforme web destinée à structurer le suivi des patients et à faciliter la coordination des différents intervenants d'un service des urgences. Au-delà de ses fonctionnalités, je mettrai particulièrement en valeur la démarche d'ingénierie logicielle adoptée : analyse des besoins, conception, architecture, sécurité, tests et perspectives d'industrialisation.

### Visuel / preuve

Page sobre, titre, logos institutionnels **uniquement si leur utilisation est autorisée**, capture authentique de la plateforme en arrière-plan discret. Aucun logo inventé.

### Transition

Pour commencer, je vais situer le projet dans son environnement professionnel.

## Diapositive 2 — Organisme d'accueil et mission (55 s)

### Texte à afficher

**Cadre du stage**
- CHU Hassan II de Fès : environnement hospitalier universitaire.
- Département Informatique de la Direction Générale.
- Projet à l'interface entre besoins opérationnels et système d'information.

**Mission :** concevoir et développer une solution numérique de coordination des urgences.

### Script oral

Mon stage s'est déroulé au sein du Département Informatique de la Direction Générale du CHU Hassan II de Fès. Ce contexte m'a confronté à une problématique métier où la circulation de l'information, la disponibilité des ressources et la répartition des responsabilités sont particulièrement importantes. Ma mission a consisté à concevoir et développer une application web permettant de représenter et de suivre ces opérations de manière structurée.

### Visuel / preuve

Organigramme simplifié du cadre d'accueil, validé avec l'encadrant ; photographie institutionnelle autorisée, facultative.

### Transition

Cette mission répond à plusieurs difficultés potentielles de coordination dans un parcours patient complexe.

## Diapositive 3 — Problématique (1 min)

### Texte à afficher

**Un parcours multi-acteurs et multi-étapes**
- Accueil et identification du patient.
- Triage et priorisation.
- Files d'attente et affectation des ressources.
- Prise en charge, examens, orientation et sortie.

**Problématique :** *Comment centraliser et fiabiliser le suivi du parcours patient tout en facilitant la coordination des équipes et des ressources ?*

### Script oral

Le service des urgences implique plusieurs professionnels qui interviennent à différentes étapes. Un patient peut être enregistré à l'accueil, évalué au triage, placé dans une file d'attente, puis affecté à une ressource avant sa prise en charge. Dans ce contexte, il est essentiel de partager une information cohérente et actualisée. Le projet cherche à répondre à cette problématique par une plateforme commune, sans se substituer au jugement clinique des professionnels.

### Visuel / preuve

Parcours linéaire simple : Arrivée → Accueil → Triage → Attente → Soins → Orientation.

### Transition

À partir de cette problématique, j'ai défini des objectifs fonctionnels et techniques.

## Diapositive 4 — Objectifs et périmètre (55 s)

### Texte à afficher

**Objectif général :** centraliser et structurer la coordination des urgences.

**Objectifs opérationnels**
- Enregistrer les patients et leurs visites.
- Organiser le triage et les files par priorité.
- Suivre les salles, lits et affectations.
- Proposer des interfaces adaptées aux rôles.
- Assurer la traçabilité et la synchronisation.

**Objectifs techniques :** modularité, intégrité des données, sécurité et évolutivité.

### Script oral

Le projet poursuit deux catégories d'objectifs. Sur le plan métier, il vise à offrir une vision cohérente du parcours patient et de l'utilisation des ressources. Sur le plan technique, il vise à fournir une application modulaire, dont les opérations sensibles sont sécurisées et traçables. J'ai donc considéré dès la conception non seulement les écrans à développer, mais également les règles métier et les contraintes de cohérence entre utilisateurs.

### Visuel / preuve

Cinq pictogrammes autour de PICU : patient, priorité, lit, équipe, audit.

### Transition

La première étape de réalisation a consisté à transformer ces objectifs en besoins précis.

---

# PARTIE II — ANALYSE, MÉTHODE ET CONCEPTION

## Diapositive 5 — Analyse des besoins et acteurs (1 min 10)

### Texte à afficher

**Cinq profils principaux**
- **Accueil :** enregistrement et consultation administrative.
- **Infirmier :** triage, suivi et actions autorisées.
- **Médecin :** consultation et décisions médicales.
- **Chef de service :** coordination et supervision.
- **Administrateur :** comptes, rôles et paramétrage.

**Exigences transversales :** contrôle d'accès, traçabilité, cohérence, temps réel.

### Script oral

L'analyse fonctionnelle a permis de distinguer cinq catégories d'utilisateurs. Chaque profil possède des besoins spécifiques et un périmètre d'action différent. Cette distinction est importante : une opération de triage ou une décision médicale ne doit pas être accessible à tous les utilisateurs. Les besoins ont ensuite été formalisés en fonctionnalités, règles métier et permissions. Le diagramme de cas d'utilisation résume cette répartition.

### Visuel / preuve

**`use_case_diagram.png`** — diagramme validé à partir du code réel. Éviter les associations UML arbitraires ; vérifier chaque capacité RBAC.

### Transition

Pour répondre à ces besoins, le développement a été structuré autour d'une progression par modules.

## Diapositive 6 — Méthodologie de développement (1 min 15)

### Texte à afficher

**Démarche itérative et incrémentale**

1. Analyser les besoins et règles métier.
2. Concevoir les modèles et interfaces.
3. Développer les modules frontend et backend.
4. Vérifier les comportements et corriger les anomalies.
5. Intégrer les modules et améliorer progressivement.

**Principes :** séparation des responsabilités · modularité · validation progressive.

### Script oral

J'ai organisé le travail comme une progression fonctionnelle : partir du modèle des patients et des visites, construire les interactions principales, puis étendre le système au triage, aux ressources et à la supervision. Cette approche permet de réduire la complexité en traitant les modules progressivement. Chaque nouvelle fonction doit respecter les règles métier existantes. Je préfère parler ici de démarche itérative et incrémentale plutôt que de revendiquer Scrum sans preuves de sprints, de cérémonies et de suivi formalisé.

### Visuel / preuve

Cycle en cinq étapes avec flèche de retour. Ajouter des jalons ou captures de commits **si disponibles**.

### Transition

Cette démarche s'appuie sur une architecture technique clairement séparée en couches.

## Diapositive 7 — Architecture logicielle (1 min 15)

### Texte à afficher

**Architecture en trois couches**

| Couche | Technologies | Responsabilité |
|---|---|---|
| Présentation | React 19, Vite, Tailwind CSS | Interfaces et interactions |
| Logique métier | Node.js, Express | API, règles métier, autorisations |
| Persistance | PostgreSQL (Neon) | Données, transactions, intégrité |

**Communications :** API REST/JSON et événements SSE pour la synchronisation.

### Script oral

L'architecture repose sur trois couches. Le frontend React présente les tableaux de bord et transmet les actions de l'utilisateur. Le backend Node.js et Express centralise les règles métier et les contrôles d'autorisation. PostgreSQL conserve les données et garantit leur cohérence transactionnelle. Les échanges habituels utilisent une API REST, tandis que les Server-Sent Events permettent de signaler les changements aux interfaces connectées. Cette séparation améliore la maintenabilité et évite de confier les décisions sensibles uniquement au navigateur.

### Visuel / preuve

**`architecture_picu.png`** — version simplifiée sans logo institutionnel non autorisé. Schéma : Utilisateurs → React → Express → PostgreSQL ; SSE en retour.

### Transition

Au-delà des technologies, la difficulté principale réside dans la modélisation correcte des données et des états.

## Diapositive 8 — Modélisation UML et règles métier (1 min 20)

### Texte à afficher

**Conception structurelle et comportementale**
- **Classes / données :** Patient, Visite, Utilisateur, Salle, Lit, Affectation, Événement.
- **Diagramme de séquence :** enregistrement et création d'une visite.
- **Diagramme d'activité :** étapes du parcours patient.
- **États métier :** triage, attente, soins, observation, orientation, clôture.

**Règle critique :** une même ressource ne doit pas être affectée simultanément à plusieurs visites actives.

### Script oral

J'ai distingué deux dimensions de conception. La dimension structurelle décrit les entités et leurs relations, notamment le lien entre un patient et ses visites successives. La dimension comportementale décrit les transitions d'une visite, les interactions entre les composants et les décisions possibles. Cette modélisation est essentielle pour éviter des incohérences comme une double affectation de lit ou une transition de statut non autorisée. Les diagrammes présentés doivent refléter l'implémentation réelle et non uniquement un fonctionnement théorique.

### Visuel / preuve

Miniatures ou zooms ciblés de **`class_diagram.png`**, **`sequence_diagram.png`**, **`activity_diagram.png`**. Ne pas afficher trois schémas illisibles sur une même diapositive : privilégier un diagramme principal et les deux autres en annexe.

### Transition

Une fois la conception définie, la qualité de réalisation dépend aussi de l'organisation du code.

---

# PARTIE III — INDUSTRIALISATION, QUALITÉ ET SÉCURITÉ

## Diapositive 9 — Organisation du code et versionnement (55 s)

### Texte à afficher

**Un projet structuré par responsabilités**
- Frontend : pages, composants, hooks et services API.
- Backend : routes, services métier, accès aux données.
- Base : schéma relationnel et migrations.
- Évolutions : modules indépendants et interfaces réutilisables.

**Versionnement :** Git **[préciser les pratiques réellement utilisées]**.

### Script oral

Le dépôt est organisé pour séparer les responsabilités. Côté frontend, les composants et pages sont structurés selon les besoins des utilisateurs. Côté backend, les routes HTTP délèguent les opérations aux services métier. Cette organisation facilite la recherche d'anomalies, l'ajout de fonctionnalités et les tests ciblés. Pour le versionnement, je présenterai uniquement les pratiques effectivement utilisées, par exemple l'historique des commits et, si elles existent, les branches et les demandes de fusion.

### Visuel / preuve

Capture authentique de l'arborescence du dépôt et de l'historique Git.

### Transition

La structuration du code facilite ensuite la mise en place d'une stratégie de validation.

## Diapositive 10 — Stratégie de tests et assurance qualité (1 min 25)

### Texte à afficher

**Valider les fonctionnalités et les invariants métier**

| Niveau | Exemple de scénario |
|---|---|
| Unitaire | Calcul de la priorité dans une file |
| Intégration | Création de visite et écriture en base |
| Fonctionnel / E2E | Accueil → triage → affectation → clôture |
| Sécurité | Refus d'une action non autorisée |
| Concurrence | Deux utilisateurs demandent le même lit |

**Indicateurs :** tests exécutés **[N]**, réussis **[N]**, échecs **[N]**, couverture **[% si mesurée]**.

### Script oral

La qualité d'une application de coordination hospitalière ne peut pas être évaluée uniquement par l'apparence des écrans. Il faut vérifier les règles métier, les échanges avec la base, les droits d'accès et les comportements concurrents. Un exemple particulièrement révélateur est l'affectation d'un lit : si deux utilisateurs agissent simultanément, le système doit préserver une seule affectation active. Je présenterai ici les scénarios effectivement exécutés et leurs résultats, en distinguant les tests automatisés des vérifications manuelles.

### Visuel / preuve

Pyramide des tests + capture terminal ou rapport réel. **Ne pas inventer de taux de couverture ni de résultats.**

### Transition

Pour rendre ces contrôles reproductibles, une chaîne d'intégration continue représente une étape importante.

## Diapositive 11 — CI/CD et démarche DevOps (1 min 10)

### Texte à afficher

**Chaîne de qualité et de livraison — état à confirmer**

`Commit / Pull Request → Installation → Lint / Build → Tests → Vérification sécurité → Staging → Validation → Déploiement`

**Bénéfices :** contrôles reproductibles, détection précoce des régressions, livraison maîtrisée.

**Statut du projet :** **[Pipeline opérationnel / En cours d'intégration / Perspective]**.

### Script oral — variante A : pipeline réellement exécuté

Pour renforcer la fiabilité des évolutions, j'ai configuré une chaîne d'intégration continue qui se déclenche à chaque modification du dépôt. Elle exécute les contrôles de qualité, construit l'application et lance les tests définis. Une livraison n'est envisagée qu'après validation des étapes nécessaires. Voici une exécution réelle du pipeline et les résultats obtenus.

### Script oral — variante B : pipeline non encore implémenté

La plateforme est structurée pour permettre son industrialisation. La prochaine étape consiste à automatiser les vérifications à chaque modification du dépôt grâce à un pipeline CI/CD. Le schéma présente l'enchaînement envisagé : construction, tests, contrôles de sécurité, environnement de validation et livraison contrôlée. Je distingue cette architecture cible des mécanismes déjà réalisés dans le projet.

### Visuel / preuve

Capture GitHub Actions ou équivalent **si opérationnel** ; sinon diagramme explicitement marqué **« pipeline cible »**. Ne pas présenter un déploiement en production hospitalière sans validation institutionnelle.

### Transition

Cette démarche de qualité est complétée par des mécanismes de sécurité et de cohérence intégrés au backend.

## Diapositive 12 — Sécurité, traçabilité et concurrence (1 min 20)

### Texte à afficher

**Protection et cohérence des opérations**
- Authentification et contrôle des capacités par rôle (RBAC).
- Validation des actions côté serveur.
- Transactions PostgreSQL et verrouillages ciblés.
- Historique des événements de visite (`visit_events`).
- Synchronisation SSE avec mécanismes de récupération.

**Cas d'étude :** prévenir la double affectation d'un lit.

### Script oral

L'application traite des opérations dont la cohérence est essentielle. Les permissions ne sont pas seulement masquées dans l'interface : elles doivent être vérifiées côté serveur. Pour les opérations critiques, comme l'affectation d'une ressource, les transactions et les verrous en base limitent les conflits entre utilisateurs. L'historique des événements permet de retracer les changements de parcours. Enfin, la synchronisation temps réel améliore la visibilité, mais la base de données reste la source de vérité. Les exigences de confidentialité et la conformité réglementaire nécessitent une validation institutionnelle distincte.

### Visuel / preuve

Schéma simplifié « Demande → Autorisation → Transaction → Audit → Notification » et, si possible, capture d'un test de concurrence réussi.

### Transition

Ces choix techniques prennent tout leur sens lorsqu'on observe le parcours réel d'un patient dans PICU.

---

# PARTIE IV — RÉALISATION ET DÉMONSTRATION

## Diapositive 13 — Parcours patient et files d'attente (1 min 15)

### Texte à afficher

**Workflow opérationnel**

`Enregistrement → Triage → File priorisée → Affectation → Soins / Examens → Orientation → Clôture`

**Fonctionnalités**
- Niveaux de priorité P1 à P5.
- Listes de travail adaptées aux étapes du parcours.
- États et transitions contrôlés.
- Mise à jour des tableaux de bord.

**Principe :** les priorités cliniques relèvent des professionnels habilités.

### Script oral

Voici le cœur fonctionnel de PICU. Une visite est créée à l'accueil, puis le patient est évalué au triage. La priorité attribuée influence son positionnement dans les listes de travail. Le parcours se poursuit avec l'affectation d'une ressource, la prise en charge et, selon les besoins, les examens ou l'observation. Le système permet de suivre les étapes et d'en conserver l'historique. La plateforme facilite l'organisation ; elle ne remplace pas les décisions médicales.

### Visuel / preuve

Capture de la file d'attente et **`activity_diagram.png`** en version simplifiée. **Vérifier** les transitions exactes dans le code.

### Transition

Le suivi des patients doit être associé à une vision cohérente des ressources disponibles.

## Diapositive 14 — Gestion des ressources et affectations (1 min 05)

### Texte à afficher

**Gestion des salles et des lits**
- Organisation : zones → salles → lits.
- Disponibilité et états opérationnels.
- Affectations, transferts et libérations.
- Coordination des équipes par salle.
- Prévention des conflits d'occupation.

**Point de vigilance :** distinguer un lit libéré d'un lit réellement prêt à recevoir un nouveau patient.

### Script oral

Le module de ressources permet de représenter les zones, les salles et les lits, puis de suivre les affectations associées aux visites. Une difficulté importante est de ne pas confondre la fin d'occupation avec la disponibilité opérationnelle d'un lit. Par exemple, une étape de nettoyage peut être nécessaire avant toute nouvelle affectation. Ce point a été identifié comme une amélioration de sécurité prioritaire dans la feuille de route V4 ; son statut de réalisation doit être confirmé avant la soutenance.

### Visuel / preuve

Capture réelle du plan de lits ; annoter les états et distinguer les fonctions V3 existantes des évolutions V4.

### Transition

L'ensemble de ces données est ensuite consolidé pour les différents profils utilisateurs.

## Diapositive 15 — Tableaux de bord et supervision (1 min 05)

### Texte à afficher

**Une interface adaptée à chaque responsabilité**
- Accueil : enregistrement et suivi administratif.
- Infirmier : triage et listes de travail.
- Médecin : prise en charge et suivi clinique.
- Chef de service : vue d'ensemble et ressources.
- Administrateur : gestion du système.

**Temps réel :** événements SSE et rafraîchissement de secours.

### Script oral

PICU propose plusieurs tableaux de bord adaptés aux missions des utilisateurs. Cette séparation réduit le bruit informationnel et met en avant les actions utiles à chaque rôle. Pour la supervision, le chef de service dispose d'une vision transversale de l'activité. Les mises à jour sont diffusées grâce aux événements SSE, avec un mécanisme de récupération en cas de perte de connexion. La refonte V4 du centre de supervision vise à améliorer la lisibilité des indicateurs et le traitement des alertes ; elle doit être présentée selon son état réel d'avancement.

### Visuel / preuve

Montage de 2 à 3 captures authentiques (accueil, infirmier, chef). Utiliser des données fictives, sans données personnelles réelles.

### Transition

Je vais maintenant illustrer l'enchaînement de ces modules par un scénario de démonstration.

## Diapositive 16 — Démonstration et résultats (1 min 35)

### Texte à afficher

**Scénario de démonstration**
1. Enregistrer un patient fictif.
2. Réaliser le triage et attribuer une priorité.
3. Observer la file d'attente.
4. Affecter une salle ou un lit disponible.
5. Suivre la prise en charge.
6. Orienter puis clôturer la visite.

**Résultats vérifiés :** **[compléter avec les scénarios et résultats réels]**.

### Script oral

Pour illustrer le fonctionnement, je pars d'un patient fictif enregistré par l'agent d'accueil. L'infirmier réalise ensuite le triage et lui attribue un niveau de priorité. Nous pouvons constater sa présence dans la liste de travail correspondante. Lorsqu'une ressource est disponible, une affectation est réalisée et l'information se répercute sur les tableaux de bord. Enfin, le parcours se poursuit jusqu'à l'orientation et à la clôture. Cette démonstration doit être complétée par les résultats de tests afin de distinguer une fonctionnalité visible d'une fonctionnalité réellement validée.

### Visuel / preuve

Démonstration live **avec plan B vidéo/captures**, jeu de données fictives, scénario préparé, compte de chaque rôle. Si une fonction n'est pas opérationnelle, ne pas la simuler comme si elle l'était.

### Transition

Cette réalisation m'a permis de dégager plusieurs enseignements techniques et pistes d'évolution.

---

# PARTIE V — BILAN ET PERSPECTIVES

## Diapositive 17 — Bilan, limites et perspectives (1 min 20)

### Texte à afficher

**Apports du projet**
- Traduction d'un processus hospitalier en règles métier.
- Architecture full-stack modulaire.
- Gestion des rôles, états et ressources.
- Prise en compte de l'intégrité et de la traçabilité.

**Limites et perspectives**
- Renforcement des tests automatisés et de la CI/CD.
- Amélioration de l'ergonomie et de la supervision.
- Validation métier et clinique avec les professionnels.
- Assistance IA future via NVIDIA NIM, sous contrôle humain.

**Conclusion :** une base logicielle évolutive pour améliorer la coordination opérationnelle des urgences.

### Script oral

Ce stage m'a permis de mettre en pratique des compétences qui vont au-delà du développement d'interfaces : analyse métier, modélisation, architecture full-stack, gestion de la cohérence des données et prise en compte des risques. PICU constitue une base évolutive, mais plusieurs étapes restent nécessaires avant tout usage hospitalier réel : approfondissement des tests, industrialisation des livraisons, validation des processus par les professionnels et vérifications de sécurité. À plus long terme, des fonctions d'assistance intelligente pourraient être envisagées, tout en conservant la décision clinique sous responsabilité humaine. Je vous remercie de votre attention et je suis à votre disposition pour vos questions.

### Visuel / preuve

Deux colonnes « Réalisations » et « Perspectives » ; phrase finale courte.

---

# ANNEXE A — PLAN DE TEMPS

| Diapo | Sujet | Durée indicative |
|---|---|---:|
| 1 | Page de garde | 0:30 |
| 2 | Organisme d'accueil | 0:55 |
| 3 | Problématique | 1:00 |
| 4 | Objectifs | 0:55 |
| 5 | Besoins | 1:10 |
| 6 | Méthodologie | 1:15 |
| 7 | Architecture | 1:15 |
| 8 | UML | 1:20 |
| 9 | Code et Git | 0:55 |
| 10 | Tests | 1:25 |
| 11 | CI/CD | 1:10 |
| 12 | Sécurité | 1:20 |
| 13 | Workflow | 1:15 |
| 14 | Ressources | 1:05 |
| 15 | Supervision | 1:05 |
| 16 | Démonstration | 1:35 |
| 17 | Conclusion | 1:20 |

**Total estimé : ~19 min 30 s**, à ajuster après répétition chronométrée.

# ANNEXE B — VISUELS À PRÉPARER

| Fichier / preuve | Diapositive | Vérification nécessaire |
|---|---:|---|
| `use_case_diagram.png` | 5 | Acteurs et droits cohérents avec RBAC |
| `architecture_picu.png` | 7 | Technologies et flux REST/SSE corrects |
| `class_diagram.png` | 8 / annexe | Associations et attributs conformes au schéma réel |
| `sequence_diagram.png` | 8 / annexe | Ordre des opérations conforme au code |
| `activity_diagram.png` | 13 | Transitions conformes au workflow |
| Capture du dépôt et commits | 9 | Historique authentique |
| Rapport de tests | 10 | Commandes, résultats, date, environnement |
| Pipeline CI/CD | 11 | Statut réel : opérationnel ou cible |
| Test concurrence sur lit | 12 | Résultat réellement obtenu |
| Captures des dashboards | 13–15 | Données fictives et interfaces actuelles |
| Démonstration / vidéo | 16 | Scénario reproductible |

# ANNEXE C — PREUVES À RÉUNIR AVANT LA SOUTENANCE

- [ ] Confirmer l'intitulé officiel du stage, la formation, les encadrants et les dates.
- [ ] Vérifier les rôles et capacités dans le code.
- [ ] Vérifier les statuts des visites, les étapes de soins et les règles de triage.
- [ ] Contrôler les diagrammes UML par rapport à la base et aux API.
- [ ] Exécuter les tests disponibles et archiver leurs sorties.
- [ ] Indiquer les tests non encore implémentés.
- [ ] Confirmer le statut réel de Git, des branches et des revues.
- [ ] Confirmer l'existence et l'exécution effective d'un pipeline CI/CD.
- [ ] Tester le scénario de démonstration avec des données fictives.
- [ ] Distinguer V3 existant, V4 implémenté et V4 planifié.
- [ ] Ne pas annoncer de gain de temps, de performance ou d'efficacité clinique sans mesure.
- [ ] Vérifier la conformité des illustrations, logos et captures avec les autorisations de l'établissement.

# ANNEXE D — QUESTIONS PROBABLES DU JURY ET RÉPONSES COURTES

**Pourquoi React / Express / PostgreSQL ?**  
Pour séparer la présentation, les règles métier et la persistance. PostgreSQL offre notamment des transactions et des contraintes adaptées aux opérations nécessitant de la cohérence.

**Pourquoi SSE plutôt que du polling seul ?**  
SSE permet de diffuser les changements du serveur vers les interfaces avec moins de latence perçue ; un mécanisme de récupération reste utile si la connexion est interrompue.

**Comment éviter une double affectation de lit ?**  
Par une vérification côté serveur, dans une transaction, avec verrouillage et contraintes adaptées. L'interface seule ne suffit pas.

**Avez-vous utilisé Scrum ?**  
Répondre selon les pratiques réelles. Une approche itérative et incrémentale ne constitue pas automatiquement Scrum.

**Avez-vous réellement mis en place la CI/CD ?**  
Montrer une exécution authentique si oui ; sinon présenter honnêtement le pipeline cible et les étapes restantes.

**Votre application peut-elle être utilisée directement dans un CHU ?**  
Pas sans validations institutionnelles, métier, cliniques, de sécurité et de protection des données, ainsi que des tests d'exploitation adaptés.

**L'IA prend-elle des décisions médicales ?**  
Non : toute assistance envisagée doit être contrôlée et validée par les professionnels habilités. Les fonctions d'IA planifiées ne doivent pas être confondues avec le workflow déterministe existant.

**Quel a été votre principal défi technique ?**  
Choisir un défi réel et prouvable : cohérence des états, gestion concurrente des ressources, autorisations, synchronisation ou modélisation des processus.

---

# ANNEXE E — DIRECTIVES DE DESIGN POWERPOINT

- Format **16:9** ; fond clair, bleu marine et accent turquoise ; cohérence avec le contexte hospitalier.
- Une idée centrale par diapositive ; 4 à 6 éléments visuels maximum quand c'est possible.
- Préférer les diagrammes épurés et les captures annotées aux paragraphes longs.
- Réserver les détails techniques et les réponses aux questions dans les notes et annexes.
- Éviter les diagrammes générés non vérifiés : certaines relations, cardinalités ou étapes peuvent être incorrectes.
- Éviter tout nom de patient, CIN, téléphone ou donnée clinique réelle dans les captures.
- Indiquer clairement **« réalisé »**, **« en cours »** ou **« perspective »** pour les éléments V4, CI/CD et IA.

**Document de travail :** prêt pour validation du contenu avant création des diapositives. Les scripts sont des propositions de formulation, à adapter à la réalité du stage et au niveau de maîtrise du présentateur.
