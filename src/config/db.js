const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({ connectionString: env.databaseUrl, max: 20 });

pool.on('error', (err) => {
  logger.error('postgres_pool_error', { error: err.message });
});

module.exports = pool;