const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  const inner = err.errors && err.errors[0];
  logger.error('unhandled_error', {
    error: err.message || (inner && inner.message) || String(err),
    code: err.code || (inner && inner.code),
    path: req.originalUrl,
  });
  res.status(500).json({ error: 'Internal server error' });
};