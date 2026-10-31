const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error('unhandled_error', { error: err.message, path: req.originalUrl });
  res.status(500).json({ error: 'Internal server error' });
};