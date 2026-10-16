# Enregistrement patient intelligent (V4)

## Périmètre

- Parcours en 3 étapes (identité → signalement → confirmation) partagé Accueil et Chef.
- **Signalement accueil** distinct du triage clinique (`registration_priority` sans `clinical_priority_validated_at`).
- Suggestions **déterministes** via [`backend/src/config/registrationHints.js`](../backend/src/config/registrationHints.js) — mots-clés opérationnels, **non diagnostiques**, revue CHU avant extension.
- Aucune modification automatique de `priority` ou `critical_flag` depuis les hints.

## API

| Route | Description |
|-------|-------------|
| `GET /api/visits/register/preflight?nationalId=` | Patient connu, visite active, taille file triage |
| `GET /api/visits/register/hints?...` | Suggestions lecture seule |
| `POST /api/visits/register` | Inchangé (écriture transactionnelle) |

## Tests

```bash
cd backend && npm run test:registration
```

## Limites

- Pas d’IA sur l’enregistrement.
- Preflight/hints ne créent pas de données en base.
