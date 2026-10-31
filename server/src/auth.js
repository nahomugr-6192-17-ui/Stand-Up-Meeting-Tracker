import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { username } from 'better-auth/plugins';
import { prisma } from './services/prismaDb.js';
import config from './config/env.js';

export const auth = betterAuth({
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,

  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true // Internal server provisioning only; no public registration
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'TEAM',
        input: false // Crucial: Never allow role to be set or modified by frontend
      }
    }
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (val) => {
        // Allow alphanumeric characters, spaces, underscores, and hyphens (existing usernames have spaces)
        return /^[a-zA-Z0-9 _-]{3,30}$/.test(val);
      },
      usernameNormalization: false, // Do not alter or lowercase usernames; preserves exact credentials
      immutableUsername: true,
      displayUsername: true
    })
  ],

  trustedOrigins: [
    config.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ],

  rateLimit: {
    window: 60, // 60 seconds
    max: 10 // Max 10 attempts per minute per IP for authentication
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24 // 1 day
  },

  advanced: {
    useSecureCookies: config.NODE_ENV === 'production'
  }
});

export default auth;

