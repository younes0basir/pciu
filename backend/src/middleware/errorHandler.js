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
