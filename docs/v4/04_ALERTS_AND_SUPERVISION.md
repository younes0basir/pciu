# Phase 4 — Alertes et supervision

## Backend

- Table `operational_alerts` (déduplication par `dedupe_key` pour états open/ack).
- `workflowOrchestratorService.getSupervisionSnapshot()` : recommandations déterministes + sync alertes.
- Types sync : `UNTRIAGED_PATIENT`, `REASSESSMENT_DUE`, `BED_TURNOVER_PENDING`, `CRITICAL_ESCALATION`.

## API

| Route | Accès |
|-------|-------|
| `GET /api/workflow/supervision` | chief |
| `GET /api/workflow/alerts` | authentifié |
| `POST /api/workflow/alerts/:id/acknowledge` | nurse, chief |
| `POST /api/workflow/alerts/:id/resolve` | nurse, chief |
| `GET /api/workflow/resources/board` | authentifié |

## Limites

- Pas de notification hors navigateur (SMS/téléphone) — escalade vitale reste procédure CHU.
- SLA chef (`stuckAlerts`) coexiste avec alertes persistées.
