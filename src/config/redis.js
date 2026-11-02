const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,     // fail fast instead of waiting
  enableOfflineQueue: false,   // don't queue commands while disconnected
  connectTimeout: 2000,
  retryStrategy: (times) => Math.min(times * 500, 5000), // keep reconnecting
});

let up = false;
let hasBeenDown = false;

redis.on('ready', async () => {
  up = true;
  logger.info('redis_up');
  // Writes may have happened while Redis was down, so old cached copies
  // could be stale. Clear the cache once on recovery.
  if (hasBeenDown) {
    hasBeenDown = false;
    try {
      await redis.flushdb();
      logger.info('cache_flushed_after_recovery');
    } catch (err) {
      logger.warn('flush_after_recovery_failed', { error: err.message });
    }
  }
});

redis.on('close', () => {
  if (up) {
    up = false;
    hasBeenDown = true;
    logger.warn('redis_down');
  }
});

redis.on('error', () => {}); // state changes are logged above

module.exports = { redis, isRedisUp: () => up };