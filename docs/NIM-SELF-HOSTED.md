# NIM self-hosted (phase 13)

Le code agents appelle uniquement `NimProvider` — pas d’URL NVIDIA en dur dans les agents.

## Configuration

```env
AI_ENABLED=true
AI_MODE=collaborative
NIM_BASE_URL=http://nim-gateway.internal:8000/v1
NVIDIA_API_KEY=<token-if-required-by-your-gateway>
```

Les modèles restent configurables via `AI_FAST_MODEL`, `AI_REASONING_MODEL`, `AI_EMBEDDING_MODEL` et le fichier [benchmarks/model_registry.json](../benchmarks/model_registry.json).

## Vérification

1. `GET /api/ai/health` (chef/admin) — statut NIM et métriques circuit breaker.
2. Exécuter [benchmarks/run-triage-benchmark.js](../benchmarks/run-triage-benchmark.js) contre le gateway interne.
3. Aucun changement de code agent requis lors du basculement cloud → self-hosted.
