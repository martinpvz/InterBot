import { logger } from '../lib/logger.js';

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;

  logger.error(err.message || 'Unhandled error', {
    statusCode,
    path: req.originalUrl,
    method: req.method,
    details: err.details,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
  });
}

export { errorHandler, notFoundHandler };
