const router = require('express').Router();
const pool = require('../config/db');
const { redis, isRedisUp } = require('../config/redis');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const metrics = require('../middleware/metrics');

// Public health check
router.get('/health', async (req, res) => {
  const components = { api: 'up', postgres: 'down', redis: 'down' };

  try {
    await pool.query('SELECT 1');
    components.postgres = 'up';
  } catch (err) {
    components.postgres = 'down';
  }

  if (isRedisUp()) {
    try {
      await redis.ping();
      components.redis = 'up';
    } catch (err) {
      components.redis = 'down';
    }
  }

  // PostgreSQL is critical. Redis is optional (graceful degradation).
  let status = 'ok';
  if (components.postgres === 'down') status = 'down';
  else if (components.redis === 'down') status = 'degraded';

  res.status(status === 'down' ? 503 : 200).json({
    status,
    components,
    time: new Date().toISOString(),
  });
});

// Admin-only metrics
router.get('/metrics', auth, role('admin'), (req, res) => {
  res.json({ ...metrics.snapshot(), redis: isRedisUp() ? 'up' : 'down' });
});

router.post('/metrics/reset', auth, role('admin'), (req, res) => {
  metrics.reset();
  res.json({ message: 'Metrics reset' });
});

module.exports = router;