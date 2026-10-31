const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

let pgliteInstance = null;

const DATA_DIR = path.resolve(__dirname, '../../data/pgdata');

async function getPgLite() {
  if (!pgliteInstance) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    pgliteInstance = new PGlite(DATA_DIR);
    await initSchema(pgliteInstance);
  }
  return pgliteInstance;
}

async function initSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "username" TEXT UNIQUE NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'TEAM',
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
      "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "token" TEXT UNIQUE NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "meeting" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "meetingDate" TIMESTAMP WITH TIME ZONE NOT NULL,
      "nextMeetingDate" TIMESTAMP WITH TIME ZONE,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "meeting_record" (
      "id" TEXT PRIMARY KEY,
      "meetingId" TEXT NOT NULL REFERENCES "meeting"("id") ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "workSinceLastStandup" TEXT NOT NULL DEFAULT '',
      "workRating" INTEGER NOT NULL DEFAULT 5,
      "nextStandupWork" TEXT NOT NULL DEFAULT '',
      "description" TEXT NOT NULL DEFAULT '',
      "acceptanceCriteria" TEXT NOT NULL DEFAULT '',
      "questionsFromMembers" TEXT NOT NULL DEFAULT '',
      "taskAssignment" TEXT NOT NULL DEFAULT '',
      "timeDateEstimate" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_meeting_status ON "meeting" ("status");
    CREATE INDEX IF NOT EXISTS idx_meeting_date ON "meeting" ("meetingDate" DESC);
    CREATE INDEX IF NOT EXISTS idx_record_meeting_order ON "meeting_record" ("meetingId", "sortOrder" ASC);
  `);
}

async function seedDefaultUsers() {
  const db = await getPgLite();

  const teamUsername = (process.env.TEAM_USERNAME || 'Muqecha Team').trim();
  const teamPassword = process.env.TEAM_PASSWORD || 'wegachbeteseb007#';

  const adminUsername = (process.env.ADMIN_USERNAME || 'Muqecha Admin').trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'wegachadmin007#';

  // Seed Team user
  const existingTeam = await db.query(
    'SELECT * FROM "user" WHERE LOWER("username") = LOWER($1)',
    [teamUsername]
  );
  if (existingTeam.rows.length === 0) {
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(teamPassword, 10);

    await db.query(
      'INSERT INTO "user" ("id", "name", "username", "role") VALUES ($1, $2, $3, $4)',
      [userId, 'Muqecha Team Member', teamUsername, 'TEAM']
    );

    await db.query(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password") VALUES ($1, $2, $3, $4, $5)',
      [accountId, teamUsername, 'credential', userId, hashedPassword]
    );
    console.log(`[SEED] Initialized default Team user: ${teamUsername}`);
  }

  // Seed Admin user
  const existingAdmin = await db.query(
    'SELECT * FROM "user" WHERE LOWER("username") = LOWER($1)',
    [adminUsername]
  );
  if (existingAdmin.rows.length === 0) {
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await db.query(
      'INSERT INTO "user" ("id", "name", "username", "role") VALUES ($1, $2, $3, $4)',
      [userId, 'Muqecha Studio Admin', adminUsername, 'ADMIN']
    );

    await db.query(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password") VALUES ($1, $2, $3, $4, $5)',
      [accountId, adminUsername, 'credential', userId, hashedPassword]
    );
    console.log(`[SEED] Initialized default Admin user: ${adminUsername}`);
  }
}

// Database Service Interface
const dbService = {
  getRawDb: getPgLite,
  seedDefaultUsers,

  // Users
  users: {
    findByUsername: async (username) => {
      const db = await getPgLite();
      const res = await db.query(
        'SELECT u.*, a.password as "passwordHash" FROM "user" u LEFT JOIN "account" a ON a."userId" = u."id" WHERE LOWER(u."username") = LOWER($1) LIMIT 1',
        [username]
      );
      return res.rows[0] || null;
    },
    findById: async (id) => {
      const db = await getPgLite();
      const res = await db.query(
        'SELECT "id", "name", "username", "role", "createdAt" FROM "user" WHERE "id" = $1 LIMIT 1',
        [id]
      );
      return res.rows[0] || null;
    }
  },

  // Sessions
  sessions: {
    create: async ({ userId, ipAddress, userAgent, daysValid = 7 }) => {
      const db = await getPgLite();
      const sessionId = crypto.randomUUID();
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

      await db.query(
        'INSERT INTO "session" ("id", "token", "userId", "expiresAt", "ipAddress", "userAgent") VALUES ($1, $2, $3, $4, $5, $6)',
        [sessionId, token, userId, expiresAt, ipAddress || null, userAgent || null]
      );

      return { sessionId, token, expiresAt };
    },
    findByToken: async (token) => {
      const db = await getPgLite();
      const res = await db.query(
        `SELECT s.*, u."id" as "user_id", u."name", u."username", u."role"
         FROM "session" s
         JOIN "user" u ON u."id" = s."userId"
         WHERE s."token" = $1 AND s."expiresAt" > CURRENT_TIMESTAMP
         LIMIT 1`,
        [token]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        token: row.token,
        expiresAt: row.expiresAt,
        user: {
          id: row.user_id,
          name: row.name,
          username: row.username,
          role: row.role
        }
      };
    },
    deleteByToken: async (token) => {
      const db = await getPgLite();
      await db.query('DELETE FROM "session" WHERE "token" = $1', [token]);
    }
  },

  // Meetings
  meetings: {
    findMany: async ({ role }) => {
      const db = await getPgLite();
      let query;
      let params = [];
      if (role === 'ADMIN') {
        query = 'SELECT * FROM "meeting" ORDER BY "meetingDate" DESC, "createdAt" DESC';
      } else {
        query = 'SELECT * FROM "meeting" WHERE "status" = $1 ORDER BY "meetingDate" DESC, "createdAt" DESC';
        params = ['PUBLISHED'];
      }
      const res = await db.query(query, params);
      return res.rows;
    },

    findById: async (id, { role }) => {
      const db = await getPgLite();
      let query;
      let params = [id];
      if (role === 'ADMIN') {
        query = 'SELECT * FROM "meeting" WHERE "id" = $1 LIMIT 1';
      } else {
        query = 'SELECT * FROM "meeting" WHERE "id" = $1 AND "status" = $2 LIMIT 1';
        params = [id, 'PUBLISHED'];
      }
      const mRes = await db.query(query, params);
      if (mRes.rows.length === 0) return null;
      const meeting = mRes.rows[0];

      const rRes = await db.query(
        'SELECT * FROM "meeting_record" WHERE "meetingId" = $1 ORDER BY "sortOrder" ASC, "createdAt" ASC',
        [id]
      );
      meeting.records = rRes.rows;
      return meeting;
    },

    create: async ({ title, meetingDate, initialRowCount = 0, status = 'DRAFT' }) => {
      const db = await getPgLite();
      const meetingId = crypto.randomUUID();
      const dateVal = new Date(meetingDate);

      await db.query(
        'INSERT INTO "meeting" ("id", "title", "meetingDate", "status") VALUES ($1, $2, $3, $4)',
        [meetingId, title, dateVal, status]
      );

      // Create requested number of initial empty participant rows
      const records = [];
      for (let i = 0; i < initialRowCount; i++) {
        const recordId = crypto.randomUUID();
        await db.query(
          `INSERT INTO "meeting_record"
           ("id", "meetingId", "name", "workSinceLastStandup", "workRating", "nextStandupWork", "description", "acceptanceCriteria", "questionsFromMembers", "taskAssignment", "timeDateEstimate", "sortOrder")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [recordId, meetingId, '', '', 5, '', '', '', '', '', '', i]
        );
        records.push({
          id: recordId,
          meetingId,
          name: '',
          workSinceLastStandup: '',
          workRating: 5,
          nextStandupWork: '',
          description: '',
          acceptanceCriteria: '',
          questionsFromMembers: '',
          taskAssignment: '',
          timeDateEstimate: '',
          sortOrder: i
        });
      }

      const res = await db.query('SELECT * FROM "meeting" WHERE "id" = $1', [meetingId]);
      const created = res.rows[0];
      created.records = records;
      return created;
    },

    // Save full meeting (title, dates, records) in a transaction
    saveMeetingWithRecords: async (id, { title, meetingDate, nextMeetingDate, records, status = 'PUBLISHED' }) => {
      const db = await getPgLite();

      // Begin transaction
      await db.query('BEGIN');
      try {
        const mDate = new Date(meetingDate);
        const nextMDate = nextMeetingDate ? new Date(nextMeetingDate) : null;

        await db.query(
          `UPDATE "meeting"
           SET "title" = $1, "meetingDate" = $2, "nextMeetingDate" = $3, "status" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $5`,
          [title, mDate, nextMDate, status, id]
        );

        // Delete previous records and re-insert in transaction
        await db.query('DELETE FROM "meeting_record" WHERE "meetingId" = $1', [id]);

        if (Array.isArray(records)) {
          for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const recordId = r.id || crypto.randomUUID();
            await db.query(
              `INSERT INTO "meeting_record"
               ("id", "meetingId", "name", "workSinceLastStandup", "workRating", "nextStandupWork", "description", "acceptanceCriteria", "questionsFromMembers", "taskAssignment", "timeDateEstimate", "sortOrder")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                recordId,
                id,
                r.name || '',
                r.workSinceLastStandup || '',
                parseInt(r.workRating, 10) || 5,
                r.nextStandupWork || '',
                r.description || '',
                r.acceptanceCriteria || '',
                r.questionsFromMembers || '',
                r.taskAssignment || '',
                r.timeDateEstimate || null,
                i
              ]
            );
          }
        }

        await db.query('COMMIT');

        const mRes = await db.query('SELECT * FROM "meeting" WHERE "id" = $1', [id]);
        const rRes = await db.query('SELECT * FROM "meeting_record" WHERE "meetingId" = $1 ORDER BY "sortOrder" ASC', [id]);
        const updated = mRes.rows[0];
        updated.records = rRes.rows;
        return updated;
      } catch (err) {
        await db.query('ROLLBACK');
        throw err;
      }
    },

    delete: async (id) => {
      const db = await getPgLite();
      await db.query('DELETE FROM "meeting" WHERE "id" = $1', [id]);
      return true;
    }
  }
};

module.exports = dbService;
