const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
require('./config/redis'); // starts the Redis connection

// 3rd argument is the connection backlog (queue of waiting connections)
app.listen(env.port, '0.0.0.0', 2048, () => {
  logger.info('server_started', { port: env.port });
});