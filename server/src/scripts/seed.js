import crypto from 'crypto';
import { auth } from '../auth.js';
import { prisma } from '../services/prismaDb.js';
import config from '../config/env.js';

function sanitizeErrorMessage(msg) {
  if (!msg) return 'Unknown error occurred';
  return String(msg)
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(password|secret|hash|token)\s*[:=]\s*['"]?[^'"]+['"]?/gi, '$1: [REDACTED]');
}

export async function provisionInitialAccounts(customAccounts = null) {
  const isProduction = (process.env.NODE_ENV || config.NODE_ENV) === 'production';
  const teamUsername = (process.env.TEAM_USERNAME || config.TEAM_USERNAME || 'Muqecha Team').trim();
  const teamPassword = isProduction
    ? (process.env.TEAM_PASSWORD && process.env.TEAM_PASSWORD.trim() ? process.env.TEAM_PASSWORD : null)
    : (process.env.TEAM_PASSWORD && process.env.TEAM_PASSWORD.trim() ? process.env.TEAM_PASSWORD : config.TEAM_PASSWORD);

  const adminUsername = (process.env.ADMIN_USERNAME || config.ADMIN_USERNAME || 'Muqecha Admin').trim();
  const adminPassword = isProduction
    ? (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() ? process.env.ADMIN_PASSWORD : null)
    : (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() ? process.env.ADMIN_PASSWORD : config.ADMIN_PASSWORD);

  const ctx = await auth['$context'];

  const accountsToProvision = customAccounts || [
    {
      username: teamUsername,
      password: teamPassword,
      role: 'TEAM',
      name: 'Muqecha Team Member',
      email: 'team@muqecha.studio'
    },
    {
      username: adminUsername,
      password: adminPassword,
      role: 'ADMIN',
      name: 'Muqecha Studio Admin',
      email: 'admin@muqecha.studio'
    }
  ];

  for (const acc of accountsToProvision) {
    try {
      const hasPassword = Boolean(acc.password && typeof acc.password === 'string' && acc.password.trim());

      // Check if user already exists by username or email
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: acc.username },
            { email: acc.email }
          ]
        }
      });

      if (existingUser) {
        // Find existing credential account for this user
        const existingAccount = await prisma.account.findFirst({
          where: { userId: existingUser.id, providerId: 'credential' }
        });

        if (existingAccount) {
          if (!hasPassword) {
            if (isProduction) {
              console.warn(`[AUTH PROVISION WARNING] Production password missing or blank for "${acc.username}". Preserving existing credentials without modification.`);
            } else {
              console.log(`[AUTH PROVISION] No environment password provided for "${acc.username}". Preserving existing credentials.`);
            }
            continue;
          }

          // Check if current stored hash already matches the environment password
          const isSamePassword = existingAccount.password && await ctx.password.verify({
            password: acc.password,
            hash: existingAccount.password
          });

          if (isSamePassword) {
            console.log(`[AUTH PROVISION] Existing ${existingUser.role} account for "${acc.username}" verified (password matches).`);
            continue;
          }

          // Password has changed: hash using Better Auth's actual scrypt engine
          const newPasswordHash = await ctx.password.hash(acc.password);
          await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              password: newPasswordHash,
              updatedAt: new Date()
            }
          });

          console.log(`[AUTH PROVISION] Updated password credential for existing ${existingUser.role} account "${acc.username}".`);
          continue;
        } else {
          // User exists, but lacks credential account
          if (!hasPassword) {
            console.warn(`[AUTH PROVISION WARNING] ${isProduction ? 'Production password missing or blank' : 'No environment password provided'} for "${acc.username}". Cannot create credential account.`);
            continue;
          }

          const newPasswordHash = await ctx.password.hash(acc.password);
          await prisma.account.create({
            data: {
              id: crypto.randomUUID(),
              accountId: existingUser.id,
              providerId: 'credential',
              userId: existingUser.id,
              password: newPasswordHash,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });

          console.log(`[AUTH PROVISION] Linked new credential account for existing user "${acc.username}".`);
          continue;
        }
      }

      // If user does NOT exist, atomically create both user and credential account
      if (!hasPassword) {
        console.warn(`[AUTH PROVISION WARNING] Cannot create new account for "${acc.username}": ${isProduction ? 'production password is required' : 'password is required'}.`);
        continue;
      }

      const hashedPassword = await ctx.password.hash(acc.password);
      const userId = crypto.randomUUID();

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            name: acc.name,
            email: acc.email,
            emailVerified: true,
            username: acc.username,
            displayUsername: acc.username,
            role: acc.role,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        await tx.account.create({
          data: {
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: 'credential',
            userId: userId,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      console.log(`[AUTH PROVISION] Created ${acc.role} account for "${acc.username}"`);
    } catch (err) {
      const safeMessage = sanitizeErrorMessage(err.message);
      console.error(`[AUTH PROVISION ERROR] Failed to provision account for "${acc.username}":`, safeMessage);
      throw new Error(`Authentication provisioning failed for "${acc.username}": ${safeMessage}`);
    }
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  provisionInitialAccounts()
    .then(() => {
      console.log('[AUTH PROVISION] Provisioning process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[AUTH PROVISION FATAL ERROR]', sanitizeErrorMessage(err.message));
      process.exit(1);
    });
}
