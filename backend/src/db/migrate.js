const fs = require('fs');
const path = require('path');
const db = require('./client');

const migrationsDir = path.resolve(__dirname, '../migrations');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      run_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await db.query('SELECT id FROM schema_migrations');
  const ran = new Set(rows.map((row) => row.id));
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (ran.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
    console.log(`Applied migration ${file}`);
  }
}

module.exports = migrate;
