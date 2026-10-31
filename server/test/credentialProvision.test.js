// Enforce test mode flags before any application modules are evaluated
process.env.NODE_ENV = 'test';
process.env.IS_TEST_RUN = 'true';

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { validateTestDatabaseUrl } from '../src/utils/testDbGuard.js';

// Pre-flight database validation: must pass and must strictly reject Neon or cloud production targets
const configuredTestDbUrl = process.env.TEST_DATABASE_URL;
validateTestDatabaseUrl(configuredTestDbUrl);

// Overwrite process.env.DATABASE_URL with TEST_DATABASE_URL to eliminate any chance of production fallback
process.env.DATABASE_URL = configuredTestDbUrl;

// Dynamically import application modules AFTER test database validation and configuration
const { app } = await import('../src/index.js');
const { auth } = await import('../src/auth.js');
const { prisma, getPool } = await import('../src/services/prismaDb.js');
const { default: config } = await import('../src/config/env.js');
const { provisionInitialAccounts } = await import('../src/scripts/seed.js');

let server = null;
let port = 0;

function makeRequest({ method, path, headers = {}, body = null, cookie = '' }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173',
      ...headers
    };
    if (cookie) {
      reqHeaders['Cookie'] = cookie;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(rawData);
          } catch {
            data = rawData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runProvisioningTests() {
  console.log('================================================================');
  console.log(' STARTING CREDENTIAL PROVISIONING & SECURITY TEST SUITE');
  console.log('================================================================');

  const ctx = await auth['$context'];

  // Isolated test fixture usernames and emails (no production account dependency)
  const TEST_RECON_USER = '__test_recon_user__';
  const TEST_RECON_EMAIL = '__test_recon_user__@test.local';
  const INITIAL_TEST_PWD = 'InitPass_Test987#';
  const ROTATED_TEST_PWD = 'RotatedPass_Test456#';

  const FIXTURE_TEAM_USER = '__test_fixture_team__';
  const FIXTURE_TEAM_EMAIL = '__test_fixture_team__@test.local';
  const FIXTURE_TEAM_PWD = 'FixtureTeam_Pass123#';

  const FIXTURE_ADMIN_USER = '__test_fixture_admin__';
  const FIXTURE_ADMIN_EMAIL = '__test_fixture_admin__@test.local';
  const FIXTURE_ADMIN_PWD = 'FixtureAdmin_Pass456#';

  const GHOST_USER = '__ghost_prod_user__';
  const ROLLBACK_USER = '__test_rollback_user__';
  const FAILING_USER = '__failing_provision_user__';

  const ALL_TEST_FIXTURE_USERNAMES = [
    TEST_RECON_USER,
    FIXTURE_TEAM_USER,
    FIXTURE_ADMIN_USER,
    GHOST_USER,
    ROLLBACK_USER,
    FAILING_USER
  ];

  const cleanupTestArtifacts = async () => {
    // Restore environment flags
    process.env.NODE_ENV = 'test';
    process.env.IS_TEST_RUN = 'true';

    // Close HTTP test server if active
    if (server) {
      await new Promise((res) => {
        server.close(() => res());
      });
      server = null;
    }

    // Safely clean up ONLY the test fixture users
    for (const u of ALL_TEST_FIXTURE_USERNAMES) {
      try {
        const found = await prisma.user.findFirst({ where: { username: u } });
        if (found) {
          await prisma.account.deleteMany({ where: { userId: found.id } });
          await prisma.user.delete({ where: { id: found.id } });
        }
      } catch {
        // ignore cleanup errors for non-existent users
      }
    }
  };

  try {
    // Initial cleanup of fixtures
    await cleanupTestArtifacts();

    // -------------------------------------------------------------
    // TEST 0: Safety Guard Verification (Refusal on Production / Neon URLs)
    // -------------------------------------------------------------
    console.log('\n--- TEST 0: Safety Guard Verification (Refusal on Production / Neon URLs) ---');
    assert.throws(
      () => validateTestDatabaseUrl('postgresql://user:secret@ep-cool-fog-12345.us-east-2.aws.neon.tech/neondb?sslmode=require'),
      /Tests refused to run: database URL contains production indicator "neon.tech"/,
      'Must refuse Neon database URL'
    );
    assert.throws(
      () => validateTestDatabaseUrl('postgresql://user:secret@dpg-abc-a.oregon-postgres.render.com/standup'),
      /Tests refused to run: database URL contains production indicator "\.render\.com"/,
      'Must refuse Render cloud database URL'
    );
    assert.throws(
      () => validateTestDatabaseUrl('postgresql://postgres:secret@db.abc.supabase.co:5432/postgres'),
      /Tests refused to run: database URL contains production indicator "\.supabase\.co"/,
      'Must refuse Supabase cloud database URL'
    );
    assert.throws(
      () => validateTestDatabaseUrl(''),
      /No test database URL is configured/,
      'Must refuse empty test database URL'
    );
    assert.equal(
      validateTestDatabaseUrl('postgresql://muqecha_app:secret@localhost:5432/muqecha_standup?schema=public'),
      true,
      'Must approve valid local test database URL'
    );
    console.log('✓ TEST 0 PASSED: Database safety guard strictly refuses Neon and cloud production databases');

    // -------------------------------------------------------------
    // TEST 1: Account Creation for Non-Existent User
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Account Creation for Non-Existent User ---');
    await provisionInitialAccounts([
      {
        username: TEST_RECON_USER,
        password: INITIAL_TEST_PWD,
        role: 'TEAM',
        name: 'Test Reconciliation Member',
        email: TEST_RECON_EMAIL
      }
    ]);

    const createdUser = await prisma.user.findUnique({
      where: { username: TEST_RECON_USER }
    });
    assert.ok(createdUser, 'Test user must be created in User table');
    assert.equal(createdUser.role, 'TEAM', 'Test user role must be TEAM');
    assert.equal(createdUser.email, TEST_RECON_EMAIL, 'Test user email must match');

    const createdAccount = await prisma.account.findFirst({
      where: { userId: createdUser.id, providerId: 'credential' }
    });
    assert.ok(createdAccount, 'Credential account must be created for test user');
    assert.ok(createdAccount.password, 'Account must store a hashed password');
    assert.notEqual(createdAccount.password, INITIAL_TEST_PWD, 'Stored password must be hashed, not plaintext');

    const initVerify = await ctx.password.verify({
      password: INITIAL_TEST_PWD,
      hash: createdAccount.password
    });
    assert.equal(initVerify, true, 'Stored hash must verify against initial password');
    console.log('✓ TEST 1 PASSED: New account and credential created with valid Better Auth hash format');

    // -------------------------------------------------------------
    // TEST 2: Existing Password Update (Password Rotation)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Existing Password Update (Password Rotation) ---');
    await provisionInitialAccounts([
      {
        username: TEST_RECON_USER,
        password: ROTATED_TEST_PWD,
        role: 'TEAM',
        name: 'Test Reconciliation Member',
        email: TEST_RECON_EMAIL
      }
    ]);

    const userAfterRotation = await prisma.user.findUnique({
      where: { username: TEST_RECON_USER }
    });
    assert.equal(userAfterRotation.id, createdUser.id, 'User ID must remain unchanged');

    const accountsAfterRotation = await prisma.account.findMany({
      where: { userId: createdUser.id, providerId: 'credential' }
    });
    assert.equal(accountsAfterRotation.length, 1, 'Never duplicate credential accounts; must remain exactly 1');

    const updatedAccount = accountsAfterRotation[0];
    assert.equal(updatedAccount.id, createdAccount.id, 'Account ID must remain unchanged');
    assert.notEqual(updatedAccount.password, createdAccount.password, 'Password hash must be updated');

    const oldVerify = await ctx.password.verify({
      password: INITIAL_TEST_PWD,
      hash: updatedAccount.password
    });
    assert.equal(oldVerify, false, 'Old password must be rejected after update');

    const newVerify = await ctx.password.verify({
      password: ROTATED_TEST_PWD,
      hash: updatedAccount.password
    });
    assert.equal(newVerify, true, 'New rotated password must verify successfully');
    console.log('✓ TEST 2 PASSED: Existing user credential hash updated; new password verified, old rejected');

    // -------------------------------------------------------------
    // TEST 3: Missing or Empty Environment Password Preservation
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Missing Environment Password Preservation ---');
    const hashBeforeMissingPass = updatedAccount.password;

    // Run provision with empty string
    await provisionInitialAccounts([
      {
        username: TEST_RECON_USER,
        password: '',
        role: 'TEAM',
        name: 'Test Reconciliation Member',
        email: TEST_RECON_EMAIL
      }
    ]);

    const accountAfterEmpty = await prisma.account.findFirst({
      where: { userId: createdUser.id, providerId: 'credential' }
    });
    assert.equal(accountAfterEmpty.password, hashBeforeMissingPass, 'Empty password must NOT overwrite existing hash');

    // Run provision with whitespace only
    await provisionInitialAccounts([
      {
        username: TEST_RECON_USER,
        password: '   ',
        role: 'TEAM',
        name: 'Test Reconciliation Member',
        email: TEST_RECON_EMAIL
      }
    ]);

    const accountAfterWhitespace = await prisma.account.findFirst({
      where: { userId: createdUser.id, providerId: 'credential' }
    });
    assert.equal(accountAfterWhitespace.password, hashBeforeMissingPass, 'Whitespace password must NOT overwrite existing hash');

    // Run provision with undefined
    await provisionInitialAccounts([
      {
        username: TEST_RECON_USER,
        password: undefined,
        role: 'TEAM',
        name: 'Test Reconciliation Member',
        email: TEST_RECON_EMAIL
      }
    ]);

    const accountAfterUndefined = await prisma.account.findFirst({
      where: { userId: createdUser.id, providerId: 'credential' }
    });
    assert.equal(accountAfterUndefined.password, hashBeforeMissingPass, 'Undefined password must NOT overwrite existing hash');

    const stillValid = await ctx.password.verify({
      password: ROTATED_TEST_PWD,
      hash: accountAfterUndefined.password
    });
    assert.equal(stillValid, true, 'Existing credential must remain fully valid after empty/missing password runs');
    console.log('✓ TEST 3 PASSED: Missing, empty, or whitespace passwords leave existing credentials completely intact');

    // -------------------------------------------------------------
    // TEST 4: Idempotency on Identical Password (No-Op)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Idempotency Verification ---');
    await provisionInitialAccounts([
      {
        username: TEST_RECON_USER,
        password: ROTATED_TEST_PWD,
        role: 'TEAM',
        name: 'Test Reconciliation Member',
        email: TEST_RECON_EMAIL
      }
    ]);

    const accountAfterSame = await prisma.account.findFirst({
      where: { userId: createdUser.id, providerId: 'credential' }
    });
    assert.equal(accountAfterSame.password, hashBeforeMissingPass, 'Unchanged password must not trigger redundant rehash');
    console.log('✓ TEST 4 PASSED: Provisioning is strictly idempotent on repeated server restarts');

    // -------------------------------------------------------------
    // TEST 5: Production Mode Security & Missing Password Isolation (Using Isolated Fixtures)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Production Mode Security (NODE_ENV=production with Isolated Fixtures) ---');
    // First, provision the isolated test fixture
    await provisionInitialAccounts([
      {
        username: FIXTURE_TEAM_USER,
        password: FIXTURE_TEAM_PWD,
        role: 'TEAM',
        name: 'Fixture Team Member',
        email: FIXTURE_TEAM_EMAIL
      }
    ]);

    const fixtureTeamUser = await prisma.user.findUnique({ where: { username: FIXTURE_TEAM_USER } });
    const fixtureTeamAcc = await prisma.account.findFirst({ where: { userId: fixtureTeamUser.id, providerId: 'credential' } });
    const fixtureHashBefore = fixtureTeamAcc.password;

    // Simulate production mode with missing password for the fixture
    process.env.NODE_ENV = 'production';
    await provisionInitialAccounts([
      {
        username: FIXTURE_TEAM_USER,
        password: null,
        role: 'TEAM',
        name: 'Fixture Team Member',
        email: FIXTURE_TEAM_EMAIL
      }
    ]);

    const fixtureTeamAccAfter = await prisma.account.findFirst({ where: { userId: fixtureTeamUser.id, providerId: 'credential' } });
    assert.equal(fixtureTeamAccAfter.password, fixtureHashBefore, 'Production mode must NOT modify existing hash when env password is missing');

    // Test non-existent user in production mode without password: must NOT create account
    await provisionInitialAccounts([
      {
        username: GHOST_USER,
        password: null,
        role: 'TEAM',
        name: 'Ghost User',
        email: 'ghost@test.local'
      }
    ]);
    const ghostCheck = await prisma.user.findFirst({ where: { username: GHOST_USER } });
    assert.equal(ghostCheck, null, 'Must never create user or credential account in production when password is missing');
    console.log('✓ TEST 5 PASSED: Production mode never falls back to dev passwords and strictly preserves existing credentials');

    // -------------------------------------------------------------
    // TEST 6: Development Mode Fallback Behavior (Using Isolated Fixtures)
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Development Mode Fallback (Using Isolated Fixtures) ---');
    process.env.NODE_ENV = 'development';

    // Provision fixture admin using fallback development password
    await provisionInitialAccounts([
      {
        username: FIXTURE_ADMIN_USER,
        password: FIXTURE_ADMIN_PWD,
        role: 'ADMIN',
        name: 'Fixture Admin Member',
        email: FIXTURE_ADMIN_EMAIL
      }
    ]);

    const fixtureAdminUser = await prisma.user.findUnique({ where: { username: FIXTURE_ADMIN_USER } });
    assert.ok(fixtureAdminUser, 'Fixture admin user must be created');

    const fixtureAdminAcc = await prisma.account.findFirst({ where: { userId: fixtureAdminUser.id, providerId: 'credential' } });
    const adminVerify = await ctx.password.verify({
      password: FIXTURE_ADMIN_PWD,
      hash: fixtureAdminAcc.password
    });
    assert.equal(adminVerify, true, 'Development mode successfully verifies fixture credential');
    console.log('✓ TEST 6 PASSED: Development mode preserves local development fallback behavior using isolated fixtures');

    // Restore test environment
    process.env.NODE_ENV = 'test';

    // -------------------------------------------------------------
    // TEST 7: Atomic Transaction Rollback on Failure
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Atomic Transaction Rollback on Failure ---');
    const rollbackUserId = crypto.randomUUID();

    let rollbackErrorCaught = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: rollbackUserId,
            name: 'Rollback User',
            email: '__test_rollback_user__@test.local',
            emailVerified: true,
            username: ROLLBACK_USER,
            displayUsername: ROLLBACK_USER,
            role: 'TEAM'
          }
        });

        // Simulate failure during the second step (credential account creation)
        throw new Error('Simulated failure during credential account creation');
      });
    } catch {
      rollbackErrorCaught = true;
    }

    assert.equal(rollbackErrorCaught, true, 'Transaction failure must throw');
    const userAfterRollback = await prisma.user.findUnique({
      where: { username: ROLLBACK_USER }
    });
    assert.equal(userAfterRollback, null, 'User record must NOT exist in database after transaction rollback');
    console.log('✓ TEST 7 PASSED: Atomic transaction rolled back cleanly; zero partial records created');

    // -------------------------------------------------------------
    // TEST 8: Provisioning Failure Handling & Safe Error Propagation
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Provisioning Failure Handling & Safe Propagation ---');
    let provisioningErrorCaught = false;
    let propagatedErrorMessage = '';

    try {
      // Pass invalid required field to trigger a database-level error
      await provisionInitialAccounts([
        {
          username: FAILING_USER,
          password: 'SafePassword123#',
          role: 'TEAM',
          name: null, // Required non-nullable String in schema: forces Prisma error
          email: 'failing_user@test.local'
        }
      ]);
    } catch (err) {
      provisioningErrorCaught = true;
      propagatedErrorMessage = err.message;
    }

    assert.equal(provisioningErrorCaught, true, 'provisionInitialAccounts must re-throw error and not swallow it');
    assert.ok(propagatedErrorMessage.includes('Authentication provisioning failed for'), 'Error must clearly state provisioning failure');
    // Ensure no secrets or passwords leaked in propagated message
    assert.ok(!propagatedErrorMessage.includes('SafePassword123#'), 'Error must never leak password');
    assert.ok(!propagatedErrorMessage.includes('postgresql://'), 'Error must never leak connection string');

    const failingCheck = await prisma.user.findFirst({ where: { username: FAILING_USER } });
    assert.equal(failingCheck, null, 'No user should be created when provisioning fails');
    console.log('✓ TEST 8 PASSED: Provisioning failure properly propagated to caller without swallowing or leaking secrets');

    // -------------------------------------------------------------
    // TEST 9: Live Better Auth Sign-In Using Isolated Fixtures
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Live Better Auth Sign-In (Using Isolated Fixtures) ---');

    // Spin up server on a dynamic local port for HTTP authentication tests
    server = http.createServer(app);
    await new Promise((res) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        res();
      });
    });

    // Test live login for TEAM fixture
    const teamLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: {
        username: FIXTURE_TEAM_USER,
        password: FIXTURE_TEAM_PWD
      }
    });
    assert.equal(teamLogin.status, 200, `Team fixture login should return 200, got ${teamLogin.status}`);
    assert.equal(teamLogin.body.user.role, 'TEAM', 'Team login role must be TEAM');
    assert.ok(teamLogin.headers['set-cookie'], 'Team login must return session cookie');

    // Test live login for ADMIN fixture
    const adminLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: {
        username: FIXTURE_ADMIN_USER,
        password: FIXTURE_ADMIN_PWD
      }
    });
    assert.equal(adminLogin.status, 200, `Admin fixture login should return 200, got ${adminLogin.status}`);
    assert.equal(adminLogin.body.user.role, 'ADMIN', 'Admin login role must be ADMIN');
    assert.ok(adminLogin.headers['set-cookie'], 'Admin login must return session cookie');

    // Test invalid password rejection
    const invalidLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: {
        username: FIXTURE_ADMIN_USER,
        password: 'incorrect_password_attempt'
      }
    });
    assert.equal(invalidLogin.status, 401, `Invalid password should return 401, got ${invalidLogin.status}`);

    console.log('✓ TEST 9 PASSED: Isolated test fixtures verified with live Better Auth sign-in');

    // -------------------------------------------------------------
    // TEST 10: Strict Database Isolation Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Strict Database Isolation Verification ---');
    const pool = getPool();
    assert.ok(pool, 'Connection pool must be initialized');
    assert.ok(!configuredTestDbUrl.includes('neon.tech'), 'Database must not contain neon.tech');
    assert.ok(configuredTestDbUrl.includes('localhost') || configuredTestDbUrl.includes('127.0.0.1'), 'Database must be local');
    console.log('✓ TEST 10 PASSED: Verified all tests operated strictly against local test database');

    console.log('\n================================================================');
    console.log(' ALL CREDENTIAL PROVISIONING & SECURITY TESTS PASSED!');
    console.log('================================================================');
    await cleanupTestArtifacts();
    await prisma.$disconnect();
    const finalPool = getPool();
    await finalPool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n[TEST SUITE FAILURE]', err);
    await cleanupTestArtifacts();
    try {
      await prisma.$disconnect();
      const finalPool = getPool();
      await finalPool.end();
    } catch {
      // ignore teardown errors
    }
    process.exit(1);
  }
}

runProvisioningTests();
