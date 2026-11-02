const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  if (process.env.LOG_REQUESTS === 'false') return next();

  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      cache: res.getHeader('X-Cache') || null,
      user: req.user ? req.user.username : null,
    });
  });
  next();
};