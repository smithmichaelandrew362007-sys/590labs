/**
 * Centralized error handling middleware.
 * Prevents sensitive stack traces from leaking to client responses.
 */
function errorHandler(err, req, res, next) {
  console.error('[590 LABS SERVER ERROR]', {
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred. Please try again.'
  });
}

module.exports = errorHandler;
