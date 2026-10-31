const pool = require('./config/db');
const { redis } = require('./config/redis');
const logger = require('./utils/logger');

(async () => {
  await new Promise((r) => setTimeout(r, 500)); // let Redis connect

  try {
    const r = await pool.query('SELECT now()');
    logger.info('postgres_connected', { time: r.rows[0].now });
  } catch (e) {
    logger.error('postgres_failed', { error: e.message });
  }

  try {
    const pong = await redis.ping();
    logger.info('redis_ping', { reply: pong });
  } catch (e) {
    logger.error('redis_failed', { error: e.message });
  }

  process.exit(0);
})();