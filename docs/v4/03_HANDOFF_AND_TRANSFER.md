# Phase 3 — Passations et transferts

## Transferts

| Endpoint | Rôle |
|----------|------|
| `POST /api/workflow/visits/:id/transfer-requests` | Prépare transfert (`transfer_requests`, statut `pending`) |
| `POST /api/workflow/transfers/:id/confirm` | Exécute `transferResource` + confirme |
| `POST /api/workflow/transfers/:id/cancel` | Annule sans mutation lit |

Transfert legacy immédiat conservé : `POST /api/care/visits/:id/transfer`.

Lit source après transfert confirmé : **turnover `cleaning`**, pas `ready`.

## Handoffs

| Endpoint | Description |
|----------|-------------|
| `POST /api/workflow/visits/:id/handoffs` | Demande en attente |
| `POST /api/workflow/handoffs/:id/respond` | Accept/refuse (destinataire) |
| `GET /api/workflow/visits/:id/handoffs` | Historique |

Responsabilité clinique existante **non retirée** tant que statut `pending`.

## UI

- API client : `frontend/src/api/workflow.js` (transfert + confirm lit).
