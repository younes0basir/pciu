# Agent visit tools (`createVisitTools`)

Stable write surface for the AI Action Gateway (phase 9+). All methods delegate to the same domain services as the HTTP API.

| Tool | Service | Capability (role) | Notes |
|------|---------|-------------------|--------|
| `register(data)` | `visitService.registerVisit` | `register` | receptionist, chief |
| `call(visitId)` | `visitService.callVisit` | `call` | receptionist, chief |
| `place(visitId, bedId)` | `visitService.placeVisit` | `place` | nurse, chief |
| `start(visitId, data)` | `visitService.startConsultation` | `start` | nurse, doctor, chief |
| `fill(visitId, data)` | `visitService.updateConsultation` | `fill` | nurse, doctor, chief |
| `triage(visitId, data)` | `triageService.recordTriage` | `triage` | nurse, chief — structured V3 triage |
| `transfer(visitId, bedId)` | `resourceService.transferResource` | `place` | nurse, chief |
| `close(visitId, data)` | `visitService.closeVisit` | `close` | nurse, doctor, chief |
| `return(visitId, data)` | `visitService.returnVisit` | `return` | nurse, chief |

Pass `actionContext` with `actorType: 'agent'`, `agentRunId`, and `idempotencyKey` when invoking from the gateway.
