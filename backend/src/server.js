const db = require('./db/client');
require('./db/migrate');
const { PORT } = require('./config');
const app = require('./app');

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => db.close());
});
