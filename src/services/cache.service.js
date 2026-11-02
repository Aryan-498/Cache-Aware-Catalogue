const { redis, isRedisUp } = require('../config/redis');
const env = require('../config/env');
const logger = require('../utils/logger');

exports.getOrLoad = async (key, ttl, loader, { bypass = false } = {}) => {
  // Cache switched off (env flag or ?nocache=true)
  if (!env.cacheEnabled || bypass) {
    return { value: await loader(), status: 'BYPASS' };
  }

  // Redis is known to be down -> go straight to the database
  if (!isRedisUp()) {
    return { value: await loader(), status: 'DOWN' };
  }

  // 1. Try the cache
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return { value: JSON.parse(cached), status: 'HIT' };
    }
  } catch (err) {
    logger.warn('cache_read_failed', { key, error: err.message });
    return { value: await loader(), status: 'DOWN' };
  }

  // 2. Miss: load from the database
  const value = await loader();

  // 3. Save a copy (never cache "not found")
  if (value !== null && value !== undefined) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
      logger.info('cache_set', { key, ttl });
    } catch (err) {
      logger.warn('cache_write_failed', { key, error: err.message });
    }
  }

  return { value, status: 'MISS' };
};