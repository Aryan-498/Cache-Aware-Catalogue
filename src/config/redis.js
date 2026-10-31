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

redis.on('ready', () => {
  up = true;
  logger.info('redis_up');
});

redis.on('close', () => {
  if (up) {
    up = false;
    logger.warn('redis_down');
  }
});

redis.on('error', () => {}); // state changes are logged above

module.exports = { redis, isRedisUp: () => up };