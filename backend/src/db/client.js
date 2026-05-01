const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');

const pool = new Pool({ connectionString: DATABASE_URL });

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end()
};
