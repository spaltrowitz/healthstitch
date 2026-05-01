const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');

const pool = new Pool({
  connectionString: DATABASE_URL,
  options: '-c search_path=healthstitch,public'
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: async () => {
    const client = await pool.connect();
    await client.query('SET search_path TO healthstitch, public');
    return client;
  },
  end: () => pool.end()
};
