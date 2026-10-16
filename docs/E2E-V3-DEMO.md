# Parcours E2E V3 (démo / validation Phase 0)

Scénario manuel avant intégration IA :

1. **Accueil** — enregistrer un patient (`register`), vérifier file d’attente.
2. **Infirmier** — triage structuré (`POST /care/visits/:id/triage` / UI `NurseTriagePanel`), priorité 1–5.
3. **Infirmier** — appel si nécessaire, **placement lit** (`place`).
4. **Médecin / infirmier** — démarrer consultation (`start`), remplir notes (`fill`).
5. **Clôture** — `close` avec outcome (ex. `discharged`).
6. **Admin** (optionnel) — reset DB démo, batch arrivées `demoArrivalService`.

Critère : transitions visibles dans `visit_events`, `care_stage` cohérent, sans erreur 4xx/5xx.
