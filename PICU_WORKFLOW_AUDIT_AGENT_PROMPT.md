# PICU — Prompt d'audit complet du workflow des urgences

## Rôle et mission
Tu es un architecte logiciel senior, auditeur full-stack et analyste de processus hospitaliers. Tu interviens sur le dépôt existant de **PICU — Plateforme Intelligente de Coordination des Urgences**, développé dans le cadre d'un stage au Département Informatique de la Direction Générale du CHU Hassan II de Fès.

**MISSION : AUDITER, NE PAS REFACTORISER.** Inspecte le code réellement présent et la configuration du dépôt pour reconstituer précisément le parcours patient, identifier les risques et produire un rapport vérifiable. Ne présume jamais qu'une fonctionnalité décrite dans une spécification V4 est implémentée. Les documents d'analyse et prompts précédents sont des références secondaires ; le dépôt et les migrations effectives sont les sources primaires.

## 0. Règles non négociables
1. Travail en **lecture seule** : aucun changement de code, de schéma, de configuration ou de données ; aucune migration exécutée. N'exécute pas de test destructif sur une base réelle.
2. Ne te connecte pas à une base de production sans autorisation explicite. Utilise une base isolée avec des données fictives pour les tests éventuels.
3. Ne collecte ni ne publie de données nominatives de patients, secrets, JWT, mots de passe ou chaînes de connexion. Masque les éléments sensibles dans les extraits.
4. Sépare systématiquement **observé dans le code**, **confirmé par un test**, **déduit**, **non vérifié**, **prévu mais absent**.
5. Chaque affirmation technique importante doit citer `chemin/fichier:ligne(s)`, endpoint, table ou test. Si la numérotation est impossible, citer fonction, symbole et chemin exacts.
6. Ne transforme pas des hypothèses cliniques en règles validées. Les niveaux de triage, délais, protocoles, critères de priorité et habilitations doivent être confirmés par les responsables cliniques du CHU.
7. Ne confonds pas état clinique, statut de visite, étape de soins, file d'attente, localisation physique, occupation et état opérationnel d'un lit.
8. N'invente ni métrique de performance, ni résultat de test, ni conformité réglementaire.

## 1. Inventaire et architecture réelle
- Identifier la structure du dépôt, versions, frameworks, scripts, migrations, tests, configurations et éventuels modules V3/V4.
- Cartographier frontend React (routes, pages par rôle, hooks, stores, composants workflow), backend Express (routes, contrôleurs, services, middlewares), PostgreSQL (tables, colonnes, contraintes, index, triggers) et SSE/polling.
- Établir la correspondance UI → requête HTTP → middleware → service métier → transaction SQL → événement → rafraîchissement UI.
- Vérifier l'existence effective des dashboards Accueil, Infirmier, Médecin, Chef de service, Administrateur et leurs capacités.

## 2. Reconstituer le parcours patient de bout en bout
Auditer, dans cet ordre, en décrivant les chemins nominaux et alternatifs :
1. Arrivée / identification d'un patient : création, recherche, dédoublonnage, données minimales, patient non identifié, visite existante.
2. Enregistrement de visite : acteur, validations, statut initial, horodatage, numéro de visite, transaction, événements.
3. Triage infirmier : évaluation, priorité P1–P5, changement de priorité, données requises, auteur et historique ; cas critique et réévaluation.
4. Placement dans les files : triage, care, inCare, observation, disposition, reassessment, exams si présentes ; critères d'appartenance, ordre et rafraîchissement.
5. Affectation à une zone / salle / lit : préconditions, disponibilité réelle, équipe, compatibilité, occupation, conflits, verrouillage.
6. Prise en charge médicale : début, consultation, décisions, examens, résultats, observation, transferts et réaffectations.
7. Orientation / sortie / clôture : décisions possibles, validations, libération du lit, nettoyage, statut final, historique, réouverture éventuelle.
8. Exceptions : annulation, abandon, doublon, transfert interrompu, erreur API, déconnexion, SSE indisponible, actions simultanées.

Pour chaque étape, produire un tableau : **état avant | déclencheur | acteur habilité | endpoint | service | conditions | transaction | état après | événement SSE | interface impactée | preuve**.

## 3. Machines à états et invariants
- Extraire toutes les valeurs réelles de `visits.status`, `visits.care_stage`, `patient_location`, priorité, état de lit et affectation.
- Construire une matrice de transitions autorisées et interdites ; identifier les transitions implicites, non contrôlées ou contradictoires.
- Vérifier notamment : une visite clôturée ne peut pas continuer à progresser sans procédure explicite ; un lit ne peut pas avoir deux affectations actives ; un lit en nettoyage/maintenance/hors service ne doit pas être proposé comme prêt ; une sortie ne signifie pas automatiquement que le lit est prêt.
- Identifier les endroits où l'UI peut diverger de la vérité serveur et où plusieurs statuts se contredisent.
- Proposer un diagramme d'états **AS-IS** fidèle au code et, séparément, un diagramme **TO-BE** de correction si nécessaire.

## 4. Files d'attente, priorités et temporalité
- Identifier le calcul SQL / applicatif exact des worklists, les filtres et l'ordre de priorité (ex. priorité, criticité, date d'arrivée, identifiant), en citant le code.
- Vérifier égalités, valeurs nulles, changements de priorité, cas critiques, pagination, patients disparus des files, visites orphelines.
- Distinguer délai d'attente mesuré, délai configuré, seuil métier et seuil cliniquement validé. Ne pas inventer de SLA.
- Examiner les horodatages, fuseaux horaires, cohérence serveur/client et calcul des durées.

## 5. Ressources et coordination
- Vérifier la structure `zones -> rooms -> beds` si elle existe ; états opérationnels et occupation dérivée des affectations.
- Auditer création, réservation, affectation, transfert, libération, nettoyage et remise à disposition ; examiner transactions et verrouillages.
- Vérifier gestion des équipes et affectation aux salles, contraintes de capacité, actions du chef de service et conflits de droits.
- Rechercher explicitement le risque `cleaning -> ready` automatique et la remise à `ready` à la sortie : confirmer ou infirmer avec preuves.

## 6. Sécurité, audit et confidentialité
- Cartographier authentification, JWT, RBAC et contrôle de capacité **côté backend**, pour chaque transition sensible.
- Vérifier l'accès horizontal (IDOR), validation des entrées, transactions atomiques, idempotence des requêtes et gestion des erreurs.
- Examiner la journalisation (`visit_events`, `resource_status_events`, etc.) : auteur, action, avant/après, date, corrélation, complétude.
- Vérifier que les flux SSE et les tableaux de bord n'exposent pas d'informations au-delà des droits du rôle.
- Décrire les écarts observés sans prétendre certifier une conformité juridique ou médicale.

## 7. Temps réel, résilience et concurrence
- Examiner `/api/events/stream`, `useVisitEventStream`, abonnements, reconnexion, polling de secours, invalidation de cache et rafraîchissement des listes.
- Tester conceptuellement ou sur environnement isolé : double affectation du même lit, triage simultané, transfert concurrent, clôture pendant consultation, répétition d'une requête, perte de connexion, événement manqué.
- Vérifier si la base garantit l'invariant, et pas seulement l'interface.

## 8. Expérience utilisateur et rôle de chaque acteur
- Reconstituer les écrans, actions et informations disponibles pour Accueil, Infirmier, Médecin, Chef de service et Administrateur.
- Repérer les étapes bloquantes, clics inutiles, informations manquantes, ambiguïtés de statut, messages d'erreur faibles, actions dangereuses non confirmées.
- Examiner accessibilité, réactivité, lisibilité en situation de stress, fraîcheur des données, confirmations et indicateurs de chargement.
- Ne pas proposer de refonte visuelle générale à ce stade : signaler uniquement les problèmes qui affectent le workflow.

## 9. Tests existants et couverture manquante
- Inventorier scripts et suites de tests réellement présentes, catégories, dépendances et prérequis.
- Exécuter uniquement les vérifications non destructives autorisées ; si l'environnement ne permet pas l'exécution, écrire **NON EXÉCUTÉ** et expliquer pourquoi.
- Fournir une matrice de scénarios P0/P1/P2 : identifiant, préconditions, étapes, résultat attendu, résultat observé, statut, preuve.
- Scénarios minimaux : inscription nouveau patient, patient déjà connu, triage P1, changement de priorité, affectation de lit, double affectation concurrente, lit en nettoyage, transfert, examen, clôture, droits insuffisants, perte SSE, audit.
- Distinguer couverture fonctionnelle des simples fichiers de tests existants.

## 10. Audit de cohérence des diagrammes pour le rapport de stage
Produire une version factuelle des informations nécessaires à :
- **Cas d'utilisation** : acteurs, permissions et fonctionnalités réelles.
- **Diagramme de classes** : entités, relations, cardinalités, énumérations, attributs réels ; signaler les différences entre UML métier et schéma SQL.
- **Diagramme de séquence — enregistrement** : requête(s) HTTP réelles, validations, transaction, ordre de création patient/visite, génération de numéro, SSE, réponses et erreurs. Ne pas inventer de service indépendant.
- **Diagramme d'activité — parcours patient** : branches réelles, décisions, états, étapes facultatives, acteurs responsables.
- **Architecture trois couches** : composants réels et flux REST/SSE/PostgreSQL.

**Important :** fournir du **PlantUML ou Mermaid compilable** pour chaque diagramme proposé, en distinguant `AS-IS` et `TO-BE` ; signaler tout détail non confirmé. Aucun logo institutionnel n'est nécessaire.

## 11. Analyse des écarts V3 / V4
Comparer, seulement si les documents existent dans le dépôt, l'implémentation actuelle aux intentions de :
- Smart Emergency Workflow ;
- Smart Resource Management ;
- Smart Supervision / Command Center ;
- UI/UX Refactor.

Pour chaque fonctionnalité : **implémentée et vérifiée | implémentée non testée | partielle | absente | impossible à déterminer**. Les fichiers de prompt ne prouvent jamais qu'une fonctionnalité est réalisée.

## 12. Classification des risques et recommandations
Classer les constats :
- **P0 — Sécurité / intégrité critique** : risque de double affectation, contournement d'autorisation, incohérence grave de statut, lit non prêt affecté.
- **P1 — Blocage métier important** : patient perdu d'une file, mauvaise transition, transfert non atomique, perte d'information.
- **P2 — Robustesse / qualité** : rafraîchissement, erreurs, observabilité, tests manquants.
- **P3 — Ergonomie / maintenabilité** : améliorations sans impact immédiat sur la sécurité.

Chaque constat doit comporter : `ID`, sévérité, scénario de reproduction, cause probable, preuves `fichier:ligne`, impact, correction recommandée, test de non-régression, dépendances et statut de vérification. Ne jamais annoncer un problème sans preuve ou le marquer comme hypothèse.

## 13. Livrables obligatoires
Créer dans un dossier `docs/audit-workflow/` (documentation uniquement, sans toucher au code applicatif) :
1. `PICU_WORKFLOW_AUDIT_COMPLET.md` — synthèse exécutive, méthode, architecture, parcours AS-IS, matrices de transitions, sécurité, ressources, temps réel, tests et conclusions.
2. `PICU_WORKFLOW_TRACEABILITY_MATRIX.md` — exigences → UI → API → services → tables → événements → tests.
3. `PICU_WORKFLOW_RISK_REGISTER.md` — anomalies classées P0 à P3, preuves et corrections.
4. `PICU_WORKFLOW_TEST_PLAN.md` — scénarios reproductibles, prérequis, résultats et limites.
5. `PICU_WORKFLOW_V3_V4_GAP_ANALYSIS.md` — tableau de conformité à chaque spécification réellement disponible.
6. `diagrams/` — sources PlantUML/Mermaid AS-IS : cas d'utilisation, architecture, séquence d'enregistrement, activité parcours patient, classes/ERD et états ; TO-BE distinct si proposé.
7. `PICU_WORKFLOW_REPORT_FACTS.md` — faits confirmés utilisables dans le rapport de stage, avec preuves, et liste de formulations à éviter.

## 14. Format de la synthèse finale
Commencer par :
- **État réel du workflow en 10 lignes** ;
- **5 risques majeurs classés** ;
- **3 parcours testés ou non testés** ;
- **Tableau de couverture des modules** ;
- **Plan de remédiation priorisé** (P0 d'abord, puis P1/P2/P3) ;
- **Questions métier à valider avec le CHU**.

Finir par une liste explicite : `Ce que j'ai vérifié`, `Ce que je n'ai pas pu vérifier`, `Ce que je recommande`, `Ce que je n'ai pas modifié`.

## 15. Consigne de démarrage
**Commence immédiatement par explorer le dépôt en lecture seule.** Affiche d'abord la cartographie des modules et un plan d'audit court, puis mène l'inspection et produis les fichiers documentaires. N'effectue aucune modification fonctionnelle. Si un point nécessite un accès, un environnement de test ou une décision clinique absente, note le blocage et poursuis le reste de l'audit.
