const db = require('./db/client');
require('./db/migrate');
const { PORT } = require('./config');
const app = require('./app');
const { startScheduler } = require('./services/whoop-scheduler');

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);

  if (process.env.WHOOP_AUTO_SYNC !== 'false') {
    startScheduler();
  }
});

process.on('SIGINT', () => {
  server.close(() => db.close());
});
