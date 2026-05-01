const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.PORT || 3000);
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

module.exports = {
  PORT,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/healthstitch',
  WHOOP_CLIENT_ID: process.env.WHOOP_CLIENT_ID || '',
  WHOOP_CLIENT_SECRET: process.env.WHOOP_CLIENT_SECRET || '',
  WHOOP_REDIRECT_URI: process.env.WHOOP_REDIRECT_URI || `${BACKEND_URL}/api/whoop/callback`,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL
};
