# PICU V4 — Spécification exécutable de refonte UI/UX

**Projet :** PICU — Plateforme Intelligente de Coordination des Urgences, CHU Hassan II de Fès  
**Cible :** agent de développement ayant accès au dépôt complet  
**Sources :** `CHU_FES_EMERGENCY_PLATFORM_COMPLETE_ANALYSIS.md` et capture du tableau de supervision Chef de Service transmise le 14/10/2026.  
**Nature :** proposition de refonte. Les éléments décrits comme « à créer » ne sont pas des fonctionnalités vérifiées du dépôt.

## 0. Mission impérative de l'agent

Tu es un architecte frontend senior React, spécialiste UX de logiciels hospitaliers. **Applique** une refonte progressive, fonctionnelle et testée de l'interface PICU. Commence par le tableau de bord Chef de Service, puis généralise les composants transversaux aux autres rôles sans casser les fonctionnalités. Ne te contente pas de produire une maquette ou de réécrire ce document : implémente les changements dans le code, vérifie-les et rends compte des résultats.

**Contraintes non négociables :**
- Ne modifie pas la logique clinique, les permissions backend, les règles de priorité P1–P5, la machine à états, les données de production ou les migrations SQL dans cette étape.
- Préserve les routes `/accueil`, `/nurse`, `/doctor`, `/chief`, `/admin`, `/board` et leurs gardes d'accès.
- Préserve les sept worklists V3, les événements SSE, le polling de secours, les actions sur visites, le plan des lits, les équipes, le drawer patient et les modules IA existants.
- Les actions cliniques restent exclusivement pilotées par les APIs existantes avec contrôles backend. Aucun clic UI ne doit prétendre qu'une mutation a réussi avant confirmation du serveur.
- N'affiche jamais de données patient réelles dans les captures de tests, logs de développement ou documentation.
- N'utilise aucune donnée simulée dans les tableaux de bord réels, sauf si l'application est explicitement en mode démonstration isolé.
- Ne change pas la priorité clinique automatiquement, ne libère pas un lit depuis une simple interaction visuelle et ne confonds pas statut opérationnel et occupation.

## 1. État actuel et problèmes observés

La capture du `/chief` montre : barre supérieure compacte, bouton « Nouveau patient », filtres horizontaux, bloc « Vue d'ensemble » avec six KPI, bannière « Charge normale », bloc « Signaux & coordination », Worklists V3, puis « Pipeline du parcours » en cinq colonnes, dont « Clôturées aujourd'hui ».

**Problèmes observables :**
1. Beaucoup de hauteur consommée avant l'apparition des patients actifs.
2. Conteneurs imbriqués et bordures jaunes répétées, qui brouillent la hiérarchie.
3. Texte secondaire trop petit et contraste faible.
4. Sections vides occupant beaucoup d'espace ; une situation à zéro patient doit rester compacte.
5. Les visites clôturées prennent une colonne de pipeline opérationnel alors qu'elles relèvent surtout de l'historique.
6. Worklists, pipeline et actions sont visuellement séparés, obligeant à scroller et à changer de contexte.
7. Les indicateurs de charge sont visibles, mais les actions urgentes ne sont pas le centre de la page.
8. Les filtres et actions du haut paraissent compressés à la largeur de la capture.

**Ne pas supposer sans vérification :** comportement sur mobile, problèmes de performance, composants effectivement réutilisés, accessibilité clavier, état réel des permissions et disponibilité d'une API d'alertes.

## 2. Résultat attendu

Un **centre de supervision hospitalière** lisible, dense mais non surchargé, adapté aux postes de travail de 1366 px à 1920 px :
- navigation persistante et identifiable ;
- actions critiques et patients actifs visibles dès le premier écran ;
- indicateurs synthétiques compacts ;
- vue opérationnelle principale organisée par tâches ;
- plan des salles et lits accessible sans parcourir plusieurs longues sections ;
- tiroir patient conservant le contexte de navigation ;
- mise à jour temps réel discrète, états de chargement et erreurs explicites ;
- interfaces adaptées aux rôles et accessibles au clavier.

### 2.1 Architecture visuelle cible — écran Chef

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ PICU / Service des urgences       Recherche globale    Synchronisation Profil│
├──────────────┬────────────────────────────────────────────────────────────────┤
│ Navigation   │ Supervision des urgences          [Nouveau patient si autorisé]│
│              │ Statut du service / Dernière mise à jour / Alertes             │
│ Vue générale │ ┌────────┬────────┬────────┬────────┬────────┬────────────┐   │
│ Patients     │ │Actifs  │ P1/P2  │À trier │Attente  │Lits prêts│Blocages  │   │
│ Files        │ └────────┴────────┴────────┴────────┴────────┴────────────┘   │
│ Salles & lits│ ┌────────────────────────────────┬──────────────────────────┐ │
│ Équipes      │ │ Actions et files prioritaires │ Capacité / salles / lits │ │
│ Alertes      │ │ Onglets 7 worklists + filtres │ Occupation et readiness  │ │
│ Statistiques │ │ Liste patients / prochaine    │ Statuts + légende        │ │
│ Mode IA      │ │ action autorisée              │ Actions selon RBAC       │ │
│              │ └────────────────────────────────┴──────────────────────────┘ │
│ Administration│ Activité récente / Historique clôturées (repliable)          │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

Le plan n'est pas une contrainte pixel-perfect ; l'agent doit l'adapter à l'architecture existante.

## 3. Design system commun

### 3.1 Tokens

Créer ou centraliser des variables sémantiques CSS/Tailwind (sans dupliquer les couleurs dans chaque page) : `background`, `surface`, `surface-muted`, `border`, `text-primary`, `text-secondary`, `accent`, `focus-ring`, `success`, `warning`, `danger`, `info`, `critical`.

Palette recommandée (à adapter au thème existant) : fond `#F6F8FB`, surface `#FFFFFF`, texte principal `#17233A`, secondaire `#526178`, bordure `#E1E7EF`, accent `#2563EB`, succès `#15803D`, avertissement `#B45309`, danger `#B91C1C`. Ne jamais coder une priorité par la couleur seule : afficher systématiquement « P1 », « P2 », etc. Le thème de rôle existant (`theme/roleTheme.js`) doit rester compatible ; les états cliniques ont la même signification sur toutes les pages.

Typographie : police sans serif lisible, corps généralement 14–16 px, titres de section 17–20 px, page 24–28 px, annotations rarement sous 12 px. Espacement basé sur une échelle 4/8/12/16/24/32 ; radius modéré 8–12 px. Contraste WCAG AA visé ; focus clavier visible ; cibles interactives suffisamment larges.

### 3.2 Composants à créer ou consolider

Vérifier les composants déjà présents avant d'en ajouter :
- `AppShell` : header, sidebar repliable, fil d'Ariane, zone principale.
- `PageHeader` : titre, contexte, fraîcheur des données, actions autorisées.
- `StatCard` : valeur, libellé, tendance éventuelle, état indisponible.
- `PriorityBadge`, `PatientStatusBadge`, `ResourceStatusBadge` : labels sémantiques.
- `WorklistTabs` : sept listes, compteurs et clavier.
- `PatientWorklistTable` : recherche, tri, colonnes utiles, sélection, actions RBAC.
- `ResourceBoard` : zones → salles → lits/fauteuils, statut et occupation séparés.
- `OperationalAlertList` : alertes existantes, état vide, accès au patient concerné.
- `PatientDrawer` : réutiliser `ChiefVisitDrawer.jsx` ou l'extraire prudemment.
- `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ConnectionStatus`, `ConfirmActionDialog`.

N'ajoute pas une nouvelle bibliothèque UI lourde si Tailwind CSS 4, Lucide et CVA suffisent. Évite les composants dupliqués par rôle.

## 4. Refonte `/chief` — exigences détaillées

### 4.1 Barre de navigation et filtres

- Sidebar persistante sur desktop, repliable, navigation par sections ; sur tablette, menu escamotable.
- Header unique : titre, rôle, identité de session, connexion, dernière actualisation, déconnexion.
- Recherche de patient accessible sans scroller ; placeholder explicite « Nom, code de visite ou CIN ».
- Filtres priorité, zone, statut et worklist regroupés près du tableau concerné ; bouton « Réinitialiser les filtres ».
- Bouton « Nouveau patient » affiché uniquement si l'utilisateur a la capacité effective `register` ; conserver l'API existante.
- Conserver le contexte de recherche et la worklist sélectionnée lors de l'ouverture/fermeture du drawer.

### 4.2 KPIs

Afficher en une rangée desktop (avec wrap) : visites actives, P1/P2, à trier, attente médiane si disponible, lits prêts / total, blocages SLA. Chaque carte : libellé complet, valeur, explication accessible ; `—` si mesure indisponible (ne pas convertir en zéro). Les « clôturées aujourd'hui » passent dans une zone historique secondaire. Définir les métriques depuis les réponses API existantes, sans calcul divergent entre composants.

### 4.3 Zone principale : worklists et patients

- Zone la plus visible : onglets `triage`, `care`, `inCare`, `observation`, `disposition`, `reassessment`, `exams`.
- Afficher des compteurs exacts, avec labels français : À trier, Attente soins, En soins, Observation, Disposition, À réévaluer, Examens/résultats.
- Liste compacte, lignes scannables ; colonnes possibles selon données : priorité, patient/code, temps d'attente, étape, salle/lit, dernier appel, action suivante.
- Tri par défaut conservant l'ordre métier de l'API ; un tri purement visuel doit être identifié comme tel et ne doit jamais devenir une nouvelle priorité clinique.
- Clic ligne → drawer ; action rapide uniquement si autorisée, confirmation quand nécessaire, retour d'erreur explicite.
- Si liste vide : état vide compact de 48–80 px, pas une grande carte vide.
- Ne jamais afficher une action « Affectation intelligente » comme automatique si elle nécessite une validation humaine ou un service IA désactivé.

### 4.4 Colonne droite : capacité et ressources

- Résumé capacité (`normal`, `high_load`, `saturated`) selon API existante.
- Mini-plan des ressources avec groupe zone/salle ; badge d'occupation et statut opérationnel distincts.
- Légende explicite : prêt, occupé, nettoyage, maintenance, bloqué, hors service.
- Clic ressource → détails existants ; ne pas créer d'affectation sans API/autorisation.
- Bouton vers vue complète « Salles & lits ».
- Aucun lit `cleaning` ne doit apparaître comme immédiatement disponible dans l'interface ; toute anomalie renvoyée par l'API doit être signalée, sans correction clinique implicite côté client.

### 4.5 Alertes et activité

- Mettre en avant les signaux SLA existants et les cas de réévaluation nécessitant attention.
- Aucune alerte fictive, aucun délai inventé : lire les seuils configurés et les données disponibles.
- Si l'API ne permet pas l'acquittement, ne pas afficher de bouton « Acquitter » inopérant ; documenter l'amélioration backend comme étape ultérieure.
- Historique des visites clôturées dans un panneau secondaire, repliable ou onglet « Historique », distinct du flux actif.

## 5. Drawer patient — interactions à préserver

Partir de `frontend/src/components/chief/ChiefVisitDrawer.jsx`. Conserver Résumé, Triage, Examens, Mouvements/Historique, et les actions contextuelles existantes. Améliorer :
- en-tête fixe avec code, identité, priorité, étape, localisation et fermeture accessible ;
- onglets clairs ; sections de contenu scrollables indépendamment ;
- actions contextuelles toujours visibles en bas lorsque pertinentes ;
- confirmation explicite des opérations irréversibles ;
- focus trap, Escape lorsque sûr, retour du focus à la ligne d'origine ;
- états `loading`, `saving`, `success`, `conflict`, `error` ;
- sur HTTP 409 : expliquer le conflit, rafraîchir le dossier et demander de réessayer ;
- pas de disparition silencieuse du drawer lors d'une mise à jour SSE.

## 6. Déclinaison par rôle — après stabilisation du Chef

| Rôle | Priorité UI | Éléments à conserver | Amélioration |
|---|---|---|---|
| Accueil `/accueil` | Enregistrement rapide, appel, file | Formulaire existant et action `call` | Formulaire clavier, validation claire, liste compacte |
| Infirmier `/nurse` | Triage, réévaluation, lit | Ma salle, salles/lits, file | Actions triage visibles, plan des ressources contextualisé |
| Médecin `/doctor` | Caseload, consultation, examens | Ma salle, plan des lits, file | Dossier accessible en un clic, examens en attente visibles |
| Chef `/chief` | Pilotage et arbitrage | Supervision, équipes/salles, IA | Command center en deux colonnes, KPI compacts |
| Admin `/admin` | Comptes et sécurité | Gestion utilisateurs, démo | Tables claires, confirmation forte des opérations destructrices |

Les actions affichées doivent correspondre aux capacités réelles du backend (`backend/src/config/roles.js`) et aux restrictions de salle. Ne pas inventer des permissions dans le frontend.

## 7. Temps réel et gestion d'état

Conserver `useVisitEventStream.js` et `GET /api/events/stream` avec polling de secours décrit dans l'analyse. Ne pas ouvrir un flux SSE par composant. Préférer un abonnement partagé et une invalidation ciblée des données. Préserver recherche, filtres, scroll, sélection et drawer pendant le rafraîchissement. Afficher un indicateur discret de reconnexion ou de données possiblement périmées. Éviter flashs, remounts inutiles et requêtes répétées. Nettoyer les listeners à l'unmount. Ne pas masquer les erreurs API par des valeurs zéro.

## 8. Responsive et accessibilité

Tester au minimum 1920×1080, 1440×900, 1366×768, 1024×768 et 390×844. Sur desktop : sidebar + panneau principal. Sur tablette : sidebar escamotable et panneaux empilés. Sur mobile : accès prioritaire aux listes et aux actions, tableaux en cartes ou scroll horizontal contrôlé. Aucun bouton critique coupé ou hors écran. Navigation clavier complète, labels accessibles, aria-live pour les mises à jour importantes sans annonces excessives, icônes accompagnées de texte, contrastes et focus visibles. Respecter `prefers-reduced-motion`.

## 9. Fichiers et services à inspecter avant modification

Références identifiées par l'analyse (confirmer les chemins dans le dépôt actuel) :

- `frontend/src/pages/ChiefDashboardPage.jsx`
- `frontend/src/components/chief/ChiefVisitDrawer.jsx`
- `frontend/src/components/workflow/WorklistsPanel.jsx` (nom de fichier à confirmer)
- `frontend/src/components/workflow/CapacityBanner.jsx` (nom de fichier à confirmer)
- `frontend/src/components/layout/`
- `frontend/src/components/ui/`
- `frontend/src/components/nurse/`
- `frontend/src/components/clinician/`
- `frontend/src/theme/roleTheme.js`
- `frontend/src/hooks/useVisitEventStream.js`
- `frontend/src/App.jsx`
- `backend/src/config/roles.js`
- `backend/src/services/queueService.js`
- `GET /api/queue/worklists`, `GET /api/care/capacity`, `GET /api/events/stream`

Ne pas modifier les services backend pour une simple refonte visuelle. Si une information est absente de l'API, documenter l'écart et utiliser un état « non disponible » ; ne pas fabriquer de données.

## 10. Plan d'exécution obligatoire

### Phase A — Audit et baseline
1. Lire le dépôt, l'analyse et la capture ; inventorier composants, styles, routes, actions, hooks et tests.
2. Exécuter les commandes de lint/build/test existantes si possible, noter les échecs préexistants.
3. Capturer les interfaces existantes avec des données fictives, dans un environnement isolé.
4. Établir un tableau « composant actuel → composant cible » et vérifier les dépendances.

### Phase B — Fondations
1. Centraliser tokens et styles ; conserver les thèmes de rôle.
2. Mettre en place `AppShell`, sidebar, header, responsive, états communs.
3. Ajouter composants de KPI, badges et tableaux réutilisables.
4. Vérifier la navigation et les autorisations avant de continuer.

### Phase C — Chef de Service (priorité absolue)
1. Réorganiser `/chief` selon la disposition décrite.
2. Compacter KPI et états vides.
3. Mettre worklists/patients en premier plan.
4. Afficher ressources et signaux opérationnels dans le panneau latéral.
5. Déplacer les visites clôturées en historique.
6. Conserver équipes/salles, mode IA et toutes les actions actuelles accessibles.
7. Revoir le drawer et le comportement SSE sans casser les opérations.

### Phase D — Autres rôles
Appliquer les fondations communes à `/accueil`, `/nurse`, `/doctor`, `/admin` de façon progressive. Garder les workflows spécialisés ; ne pas transformer toutes les pages en copies du tableau Chef.

### Phase E — Validation
Exécuter lint, build et tests disponibles ; corriger les régressions introduites. Vérifier chaque rôle avec données fictives et tester les actions sensibles sur environnement isolé. Produire captures avant/après anonymisées, liste des fichiers modifiés et anomalies restantes.

## 11. Critères d'acceptation mesurables

- [ ] Toutes les routes et protections RBAC préexistantes fonctionnent.
- [ ] Les sept worklists sont présentes avec les bons compteurs et données.
- [ ] La liste active et les actions prioritaires sont visibles sur 1366×768 sans devoir traverser plusieurs sections de KPI vides.
- [ ] Le tableau Chef reste utilisable avec 0, 10 et 100 patients fictifs.
- [ ] Les visites clôturées ne dominent plus la vue active.
- [ ] Les filtres, le tri, la recherche et la sélection persistent après refresh SSE.
- [ ] Le drawer fonctionne au clavier et ne perd pas ses données à chaque événement.
- [ ] Les badges P1–P5 restent lisibles sans dépendre uniquement des couleurs.
- [ ] Les ressources affichent séparément occupation et disponibilité opérationnelle.
- [ ] Aucun utilisateur ne voit une action qu'il ne peut réellement exécuter ; le backend continue de l'interdire.
- [ ] Aucune nouvelle requête de mutation ne se déclenche à la simple ouverture d'une vue.
- [ ] Aucun faux succès n'est affiché sur erreur 403/409/500.
- [ ] Les états vide, chargement, erreur, hors ligne et reconnexion sont explicites.
- [ ] Aucune donnée sensible n'est introduite dans logs, captures ou mocks partagés.
- [ ] Le build passe, et les tests préexistants restent au moins au même niveau de réussite.

## 12. Scénarios de tests de non-régression

1. **Service vide :** aucun patient actif ; six KPI compacts, worklists vides, lits visibles, historique secondaire.
2. **Afflux :** 30 patients fictifs répartis sur les worklists ; filtres et scroll utilisables.
3. **Cas critique :** P1 clairement visible, sans inventer de nouveau tri clinique.
4. **Réévaluation :** priorité modifiée par action autorisée ; affichage mis à jour après réponse API/SSE.
5. **Appel :** compteur d'appels mis à jour sans retrait du patient de la file.
6. **Placement :** lit prêt et libre ; occupation et liste se mettent à jour.
7. **Conflit :** deux sessions ciblent le même lit ; HTTP 409 lisible, pas de faux placement.
8. **Nettoyage :** lit `cleaning` visuellement non prêt ; ne pas permettre de contournement via le frontend.
9. **Permissions :** réception, infirmier, médecin, chef, admin voient leurs vues/actions autorisées.
10. **Réseau :** SSE interrompu puis rétabli ; fallback, indication de synchronisation, pas de perte de contexte.
11. **Clôture :** patient disparaît des listes actives et apparaît dans l'historique après succès serveur.
12. **Responsive :** aucune action principale inaccessible à 1366×768 ou 390×844.

## 13. Livrables exigés de l'agent

1. **Code réellement modifié** dans le dépôt, sans supprimer les fonctions existantes.
2. `docs/PICU_V4_UI_REFACTOR_CHANGELOG.md` : avant/après, fichiers, décisions, écarts.
3. `docs/PICU_V4_UI_TEST_REPORT.md` : commandes, résultats, scénarios testés/non testés.
4. Captures avant/après anonymisées si l'environnement le permet.
5. Liste explicite des améliorations nécessitant une future évolution backend (alertes acquittables, transfert en deux phases, confirmation de nettoyage, etc.) **sans les implémenter dans cette étape**.

## 14. Conditions d'arrêt et sécurité

Si l'agent détecte que la refonte exigerait une modification des règles cliniques, des permissions, du schéma de base ou des données réelles, **suspendre cette partie**, expliquer la dépendance et continuer les améliorations purement UI sans prendre de décision clinique implicite. Ne jamais exécuter reset/seed sur une base de production. Préserver la possibilité de revenir à la version antérieure via commits atomiques.

## 15. Instruction finale à l'agent

**Commence maintenant par inspecter le code réel, puis implémente les phases A, B et C.** N'attends pas une approbation supplémentaire pour les changements purement frontend sans risque, mais ne dépasse pas le périmètre de sécurité. Une fois le Chef de Service validé, continue les autres rôles si les tests sont satisfaisants. À la fin, indique précisément ce qui a été fait, testé, laissé en attente, et les chemins des fichiers concernés.
