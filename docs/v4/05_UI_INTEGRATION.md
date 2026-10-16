# Phase 5 — Intégration UI

## Livré

- Badge priorité : signalement accueil vs triage validé (`StatusBadge.jsx`).
- Worklist chief : `PatientWorklistTable` utilise `displayPriority` / `priorityValidated`.
- Drawer patient : priorité contextualisée.
- Plateau lits chef : bouton **Confirmer prêt** sur lits `cleaning` → `POST /care/resources/:id/confirm-ready`.
- KPI P1/P2 chef : compte priorité **validée** ou `criticalFlag`.
- Comptage lits assignables : `operational_status === 'ready'` uniquement (`chiefUtils.js`, pipeline placement).

## Non branché (extension facile)

- Panneau dédié ack/résolution alertes workflow (API prête).
- Accueil : remplacer badges tableaux legacy par `PriorityBadge` (liste `AccueilQueueList`).
