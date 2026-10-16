# PICU V4 — Journal des Modifications UI/UX (Changelog)

**Date :** 14 Octobre 2026  
**Auteur :** Architecte Frontend & UX PICU  
**Contexte :** Refonte UI/UX de la Plateforme Intelligente de Coordination des Urgences (PICU), CHU Hassan II de Fès, selon les spécifications exécutables de `PICU_V4_UI_UX_REFACTOR_IMPLEMENTATION.md`.

---

## 1. Synthèse globale de l'intervention

La refonte V4 transforme l'interface de supervision du Chef de Service et les composants transversaux en un **véritable centre de commandement hospitalier ergonomique et dense** :
- **Consommation verticale optimisée :** Les 6 KPIs prioritaires tiennent désormais sur une seule rangée desktop sans scroll.
- **Organisation opérationnelle en deux colonnes :** 
  - Colonne gauche/centrale (~65%) dédiée au flux patient actif : placement prioritaire de la tête de file et les 7 worklists V3 avec filtres intégrés et lignes scannables.
  - Colonne droite (~35%) dédiée à la capacité, aux signaux SLA et au plateau de lits.
- **Relégation de l'historique :** Les visites clôturées du jour sont déplacées dans une section secondaire repliable (accordéon), désencombrant le flux aigu.
- **Design System sémantique :** Remplacement des bordures répétitives par une palette médicale sobre conforme aux recommandations hospitalières (WCAG AA, texte contrasté, fond `#F6F8FB`, surface `#FFFFFF`, bordures subtiles `#E1E7EF`).
- **Tiroir patient fiabilisé :** En-tête et barre d'actions fixes, gestion explicite des conflits de concurrence HTTP 409 et persistance totale de l'état pendant les rafraîchissements SSE.

---

## 2. Inventaire des fichiers créés et modifiés

### A. Fondations & Design System (Phase B)
1. [`frontend/src/index.css`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/index.css) :
   - Définition des variables sémantiques CSS et tokens Tailwind : `--background`, `--foreground`, `--surface`, `--surface-muted`, `--border`, `--text-primary`, `--text-secondary`, `--accent`, `--success`, `--warning`, `--danger`, `--critical`, `--focus-ring`.
   - Adoucissement des bordures criardes au profit d'une palette clinique apaisante et lisible.
2. [`frontend/src/components/ui/StatusBadge.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/ui/StatusBadge.jsx) *(Nouveau)* :
   - `PriorityBadge` : rendu normalisé P1 à P5 (avec pastille de couleur, texte explicite, infobulle de délai clinique et badge « CRITIQUE » dédié). Respecte la règle d'accessibilité (ne jamais coder une priorité par la couleur seule).
   - `PatientStatusBadge` : libellés français clairs des étapes cliniques (`triage_pending`, `waiting_care`, `in_care`, `in_observation`, `disposition_pending`).
   - `ResourceStatusBadge` : distinction formelle entre occupation (Occupé / Libre) et statut opérationnel (Prêt, Nettoyage, Maintenance, Bloqué, Hors service).
3. [`frontend/src/components/ui/EmptyState.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/ui/EmptyState.jsx) *(Nouveau)* :
   - État vide compact (48–80 px) avec icône discrète, titre et description, évitant les grandes surfaces blanches inutiles.
   - `SearchEmptyState` pour les cas de filtrage sans correspondance.
4. [`frontend/src/components/ui/LoadingAndError.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/ui/LoadingAndError.jsx) *(Nouveau)* :
   - Composants `LoadingSkeleton` accessible et `ErrorState` avec bouton « Réessayer ».
5. [`frontend/src/components/ui/StatCard.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/ui/StatCard.jsx) *(Nouveau)* :
   - Carte KPI compacte affichant valeur, libellé complet, explication et statut `—` en cas de donnée indisponible (sans conversion erronée en zéro).
6. [`frontend/src/components/ui/ConfirmActionDialog.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/ui/ConfirmActionDialog.jsx) *(Nouveau)* :
   - Boîte de dialogue accessible (ARIA modal, gestion de la touche Échap et piégeage du focus) pour sécuriser les actions cliniques irréversibles (clôture, libération de lit, etc.).

### B. Shell & Composants de Navigation (Phase B & C)
7. [`frontend/src/components/layout/AppShell.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/layout/AppShell.jsx) *(Nouveau)* :
   - Shell applicatif responsive avec barre latérale persistante (repliable de 224 px à 64 px avec mémorisation `localStorage`), tiroir escamotable sur mobile/tablette.
   - En-tête unique intégrant le titre du service, le rôle de session, la barre de recherche globale de patients (`Nom, code, CIN`), l'indicateur de synchronisation SSE / backend en ligne avec heure de fraîcheur, et la déconnexion.

### C. Écran Chef de Service (Phase C)
8. [`frontend/src/components/chief/ChiefKpiBar.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/chief/ChiefKpiBar.jsx) *(Refactorisé)* :
   - Les 6 KPIs prescrits regroupés en une rangée compacte :
     1. *Visites actives* (`active`)
     2. *Urgents P1 / P2* (`priority12` avec anneau de mise en valeur)
     3. *À trier* (file d'attente sans premier appel)
     4. *Attente médiane* (délai depuis l'arrivée, affiché en `XhYY` ou `—`)
     5. *Lits prêts / Total* (distinguant les lits opérationnels libres du total)
     6. *Blocages SLA* (dépassements de temps d'étape)
9. [`frontend/src/components/workflow/PatientWorklistTable.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/workflow/PatientWorklistTable.jsx) *(Nouveau)* :
   - Tableau opérationnel central regroupant les 7 worklists V3 (`triage`, `care`, `inCare`, `observation`, `disposition`, `reassessment`, `exams`).
   - Compteurs exacts sur chaque onglet.
   - Filtres intégrés (recherche, sélecteur de priorité P1–P2 / P1–P3 / P1–P5, filtre de zone).
   - Lignes de tableau compactes et hautement scannables avec badges P1–P5, code visite, plainte principale, délai d'attente écoulé, statut lit/salle et actions rapides autorisées (`Appeler`, `Au lit`).
   - Accessibilité clavier complète (`Entrée` / `Espace` pour ouvrir le dossier).
10. [`frontend/src/components/chief/ChiefResourceOverviewPanel.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/chief/ChiefResourceOverviewPanel.jsx) *(Nouveau)* :
    - Intégration du bandeau de charge du service (`CapacityBanner` : normal, charge élevée, saturé).
    - Liste des alertes SLA actives (accès direct en 1 clic au dossier patient).
    - Mini-plateau des ressources regroupé par Zone et par Salle, avec pastille d'occupation et statut opérationnel séparés.
    - Légende explicite (Prêt libre, Occupé, Nettoyage, Bloqué/Maintenance).
    - Accès direct au plan complet des lits.
11. [`frontend/src/components/chief/ChiefHistorySection.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/chief/ChiefHistorySection.jsx) *(Nouveau)* :
    - Panneau secondaire repliable dédié aux visites clôturées du jour et au registre général.
    - Évite l'encombrement du premier écran par des données historiques terminées.
12. [`frontend/src/components/chief/ChiefVisitDrawer.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/components/chief/ChiefVisitDrawer.jsx) *(Refactorisé)* :
    - En-tête fixe avec code visite, identité patient, priorité, étape clinique et bouton de fermeture accessible (avec raccourci Échap).
    - Détection et explication conviviale des conflits de concurrence HTTP 409 (tentative de prise de lit déjà assigné ou modification concurrente) avec invitation à réessayer.
    - Barre d'action contextuelle fixée au bas du tiroir pour un accès immédiat sans devoir scroller.
    - Modal de confirmation avant retour en salle d'attente.
    - Préservation totale de l'ouverture pendant les réceptions d'événements SSE.
13. [`frontend/src/pages/ChiefDashboardPage.jsx`](file:///c:/Users/ken/Documents/upf/pciu/frontend/src/pages/ChiefDashboardPage.jsx) *(Refactorisé)* :
    - Intégration du nouvel `AppShell` et réorganisation complète en disposition 2 colonnes.
    - Synchronisation simultanée des worklists et de l'overview sur le cycle de polling (30 s) et le flux SSE temps réel.
    - Maintien rigoureux des onglets `teams` (Équipes & salles) et `ai` (Pilotage IA).

---

## 3. Décisions d'architecture et conformité aux règles

- **Règles cliniques et RBAC :** Aucune logique clinique frontend inventée. Les actions (`call`, `place`, `return`, `close`, `critical`, etc.) appellent exclusivement les endpoints existants.
- **Résilience SSE & État :** Les états de sélection (`drawerVisitId`), de recherche (`search`), de filtres (`priorityFilter`, `zoneFilter`) et d'onglet actif (`activeWorklistTab`) sont entièrement préservés lors de la réception d'un événement `visit_updated` ou `queue_updated`.
- **Indicateurs de charge :** L'indicateur de charge lit directement `calculateLoad()` via `/api/care/capacity` sans recalcul divergent côté client.
- **Zéro fausse donnée :** En cas d'indisponibilité d'une métrique (ex: attente médiane lorsqu'aucun patient n'est encore entré), la valeur affichée est `—` et non `0`.
