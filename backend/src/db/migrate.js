const fs = require('fs');
const path = require('path');
const db = require('./client');

const migrationsDir = path.resolve(__dirname, '../migrations');

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    run_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const ran = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id));
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  if (ran.has(file)) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  db.exec(sql);
  db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
  console.log(`Applied migration ${file}`);
}
