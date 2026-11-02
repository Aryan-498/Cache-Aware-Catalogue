const { redis, isRedisUp } = require('../config/redis');
const env = require('../config/env');
const logger = require('../utils/logger');

exports.getOrLoad = async (key, ttl, loader, { bypass = false } = {}) => {
  if (!env.cacheEnabled || bypass) {
    return { value: await loader(), status: 'BYPASS' };
  }
  if (!isRedisUp()) {
    return { value: await loader(), status: 'DOWN' };
  }

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return { value: JSON.parse(cached), status: 'HIT' };
    }
  } catch (err) {
    logger.warn('cache_read_failed', { key, error: err.message });
    return { value: await loader(), status: 'DOWN' };
  }

  const value = await loader();

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

// Delete every key that matches a pattern (SCAN is safe on large datasets)
const deleteByPattern = async (pattern) => {
  let cursor = '0';
  let removed = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length) removed += await redis.del(...keys);
  } while (cursor !== '0');
  return removed;
};

// Called after every successful write: remove the product copy and all list copies
exports.invalidateProduct = async (id) => {
  if (!env.cacheEnabled) return;
  if (!isRedisUp()) {
    logger.warn('invalidate_skipped_redis_down', { id });
    return; // the cache is flushed on recovery instead
  }
  try {
    let removed = 0;
    if (id) removed += await redis.del(`product:${id}`);
    removed += await deleteByPattern('products:list:*');
    logger.info('cache_invalidated', { id, removed });
  } catch (err) {
    logger.warn('invalidate_failed', { id, error: err.message });
  }
};

exports.flushAll = async () => {
  if (!isRedisUp()) return false;
  await redis.flushdb();
  logger.info('cache_flushed_manually');
  return true;
};