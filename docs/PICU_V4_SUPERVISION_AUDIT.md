# PICU V4 — Audit Smart Supervision (Phase 0)

Date : 2026-10-14

## Matrice EXISTANT / PARTIEL / ABSENT / À MODIFIER

| Domaine | État | Détail |
|---------|------|--------|
| Dashboard Chef (`ChiefDashboardPage`) | EXISTANT → MODIFIÉ | Worklists, KPI, lits, équipes, historique repliable |
| `operational_alerts` + service | EXISTANT → MODIFIÉ | Cycle `obsolete`, réconciliation, audit événements |
| `GET /api/workflow/supervision` | PARTIEL | Recommandations ; sync alertes retirée du GET |
| API `/api/chief/supervision/*` | ABSENT → **AJOUTÉ** | Overview, pipeline, bottlenecks, alerts, capacity, activity, config, coordination |
| Projections KPI worklists V4 | PARTIEL → **supervisionProjectionService** | Comptages sans fusion destructive des 7 files |
| Goulots explicables | ABSENT → **bottleneckDetectionService** | Signaux instantanés, seuils delay non activés sans approbation CHU |
| UI Alert Center | ABSENT → **OperationalAlertCenter** | Filtres, acquittement, lien visite |
| SSE + polling | EXISTANT | Rafraîchissement supervision branché sur le même flux |
| Seuils SLA delay triage/soins | ABSENT (volontaire) | `supervision_rules_v1` : `enabled: false`, `approved: false` |
| NVIDIA NIM pour supervision | ABSENT (OK) | Aucune dépendance IA requise |

## Dépendances

- Migration V4 workflow (`20261014_v4_smart_workflow_foundation.sql`) requise avant supervision.
- Migration additive `20261014_supervision_command_center.sql` (statut `obsolete`, `operational_alert_events`, config règles).

## Risques résiduels

- Évaluation alertes : timer serveur + `POST /evaluate-alerts` au chargement chef (pas sur GET liste).
- Multi-instance backend : timer non coordonné entre nœuds — documenté dans rollout.
