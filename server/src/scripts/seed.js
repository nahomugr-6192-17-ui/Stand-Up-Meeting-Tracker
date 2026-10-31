import crypto from 'crypto';
import { auth } from '../auth.js';
import { prisma } from '../services/prismaDb.js';
import config from '../config/env.js';

export async function provisionInitialAccounts() {
  const teamUsername = config.TEAM_USERNAME;
  const teamPassword = config.TEAM_PASSWORD;
  const adminUsername = config.ADMIN_USERNAME;
  const adminPassword = config.ADMIN_PASSWORD;

  const ctx = await auth['$context'];

  const accountsToProvision = [
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
      const hashedPassword = await ctx.password.hash(acc.password);

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
        const existingAccount = await prisma.account.findFirst({
          where: { userId: existingUser.id, providerId: 'credential' }
        });
        if (existingAccount) {
          console.log(`[AUTH PROVISION] Existing ${existingUser.role} account for "${acc.username}" is verified and preserved.`);
          continue;
        }
      }

      if (!existingUser) {
        const userId = crypto.randomUUID();

        await prisma.user.create({
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

        await prisma.account.create({
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

        console.log(`[AUTH PROVISION] Created ${acc.role} account for "${acc.username}"`);
      } else {
        // Reconcile existing account: update role and password hash securely
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: acc.name,
            username: acc.username,
            displayUsername: acc.username,
            role: acc.role,
            email: acc.email,
            emailVerified: true,
            updatedAt: new Date()
          }
        });

        // Delete any redundant/stale credential accounts for this user and recreate cleanly
        await prisma.account.deleteMany({
          where: {
            userId: existingUser.id,
            providerId: 'credential'
          }
        });

        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            accountId: existingUser.id,
            providerId: 'credential',
            userId: existingUser.id,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        console.log(`[AUTH PROVISION] Reconciled ${acc.role} account for "${acc.username}"`);
      }
    } catch (err) {
      console.error(`[AUTH PROVISION ERROR] Failed to provision account for "${acc.username}":`, err.message);
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
      console.error('[AUTH PROVISION FATAL ERROR]', err);
      process.exit(1);
    });
}
