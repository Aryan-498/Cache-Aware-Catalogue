const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
require('./config/redis'); // starts the Redis connection

app.listen(env.port, () => {
  logger.info('server_started', { port: env.port });
});