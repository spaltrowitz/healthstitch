const db = require('./db/client');
const migrate = require('./db/migrate');
const { PORT } = require('./config');
const app = require('./app');
const { startScheduler } = require('./services/whoop-scheduler');

async function start() {
  await migrate();

  const server = app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);

    if (process.env.WHOOP_AUTO_SYNC !== 'false') {
      startScheduler();
    }
  });

  process.on('SIGINT', () => {
    server.close(() => db.end());
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
