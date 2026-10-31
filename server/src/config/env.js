const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config(); // Fallback to current working directory

module.exports = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'muqecha-super-secret-session-key-2026',
  TEAM_USERNAME: process.env.TEAM_USERNAME || 'Muqecha Team',
  TEAM_PASSWORD: process.env.TEAM_PASSWORD || 'wegachbeteseb007#',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'Muqecha Admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'wegachadmin007#',
  DATABASE_URL: process.env.DATABASE_URL
};

