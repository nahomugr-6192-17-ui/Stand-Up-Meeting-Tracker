import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || '14d6da3b6073abc5cdf93e59e3e9587911625dcc1534791170cb4b427dbaa125',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://muqecha_app:weqachbeteseb007%23@localhost:5432/muqecha_standup?schema=public',
  TEAM_USERNAME: (process.env.TEAM_USERNAME || 'Muqecha Team').trim(),
  TEAM_PASSWORD: process.env.TEAM_PASSWORD || 'weqachbeteseb007#',
  ADMIN_USERNAME: (process.env.ADMIN_USERNAME || 'Muqecha Admin').trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'weqachOGadmin007#'
};

export default config;
