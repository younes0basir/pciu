# Catalogue des règles — Supervision V4

| rule_key | Source données | Seuil | Statut approbation | Propriétaire cible |
|----------|----------------|-------|--------------------|--------------------|
| `UNTRIAGED_PATIENT` | worklist `triage` | — | Opérationnel actif | Infirmier triage |
| `REASSESSMENT_DUE` | worklist `reassessment` | `reassessment_interval_minutes` (≥15, défaut 60) | Configurable chef/admin | Infirmier |
| `CRITICAL_ESCALATION` | `critical_flag` + file care | — | Opérationnel actif | Chef |
| `BED_TURNOVER_PENDING` | lits `operational_status=cleaning` | — | Opérationnel actif | Infirmier / lit |
| `ROOM_TEAM_INCOMPLETE` | `room_teams` | — | Opérationnel actif | Chef |
| `triage_pending_delay` | timestamps arrivée | minutes (JSON) | **Non configuré** (`enabled: false`) | CHU à valider |
| `care_wait_delay` | file care | minutes (JSON) | **Non configuré** | CHU à valider |
| `exam_pending_delay` | file exams | minutes (JSON) | **Non configuré** | CHU à valider |
| `disposition_delay` | file disposition | minutes (JSON) | **Non configuré** | CHU à valider |
| `bed_turnover_delay` | statut cleaning + durée | minutes (JSON) | **Non configuré** | CHU à valider |
| `capacity_pressure` | lits prêts vs attente | heuristique | `approved: false` | CHU à valider |

Version règles : `v4-supervision-draft` (`workflow_settings.supervision_rules_v1`).
