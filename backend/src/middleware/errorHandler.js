function errorHandler(err, _req, res, _next) {
  // PostgreSQL unique constraint error (e.g. 23505)
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Conflict: A record with this unique identifier already exists.',
      detail: err.detail,
    });
  }

  // PostgreSQL foreign key violation (e.g. 23503)
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referenced entity does not exist.',
      detail: err.detail,
    });
  }

  // PostgreSQL check constraint violation (e.g. 23514)
  if (err.code === '23514') {
    return res.status(400).json({
      error: 'Data violates database constraint.',
      detail: err.detail,
    });
  }

  if (err.code === 'NIM_TIMEOUT') {
    return res.status(504).json({
      error:
        'Délai dépassé lors de l’appel NIM. Réessayez ou augmentez AI_TIMEOUT_MS (ex. 60000).',
    });
  }

  if (err.code === 'NIM_EMPTY_STRUCTURED' || err.code === 'NIM_INVALID_JSON') {
    return res.status(502).json({
      error:
        err.code === 'NIM_INVALID_JSON'
          ? 'Réponse IA illisible (JSON invalide). Réessayez.'
          : 'Réponse IA vide. Réessayez ou changez de modèle NIM.',
    });
  }

  if (err.code === 'NIM_HTTP_ERROR') {
    const upstream = err.status || err.upstreamStatus;
    const detail = err.message || 'NIM request failed';
    console.error('NIM upstream error:', { upstream, detail, nimBody: err.nimBody });
    return res.status(502).json({
      error:
        upstream === 404
          ? `Modèle NIM introuvable ou non activé sur votre compte NVIDIA. Vérifiez AI_REASONING_MODEL / AI_FAST_MODEL (${detail}).`
          : `Service NIM indisponible (${upstream ?? 'erreur'}): ${detail}`,
    });
  }

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('Unhandled server error:', err);
  }

  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500 ? 'Internal server error' : message,
  });
}

module.exports = { errorHandler };
