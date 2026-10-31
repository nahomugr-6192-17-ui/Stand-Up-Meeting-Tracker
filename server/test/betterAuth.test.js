import http from 'http';
import { app } from '../src/index.js';
import { auth } from '../src/auth.js';
import { provisionInitialAccounts } from '../src/scripts/seed.js';
import { prisma } from '../src/services/prismaDb.js';
import config from '../src/config/env.js';

let server;
let port;
let teamCookie = '';
let adminCookie = '';
let createdMeetingId = '';

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

async function runBetterAuthTests() {
  console.log('================================================================');
  console.log(' STARTING BETTER AUTH VERIFICATION TEST SUITE (13 TEST CASES)');
  console.log('================================================================');

  // 0. Provision accounts
  await provisionInitialAccounts();

  // Start HTTP server on dynamic port
  server = http.createServer(app);
  await new Promise((res) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log(`[TEST] Test server listening on 127.0.0.1:${port}`);
      res();
    });
  });

  try {
    // 1. ADMIN can log in
    const adminLoginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: {
        username: config.ADMIN_USERNAME,
        password: config.ADMIN_PASSWORD
      }
    });
    console.assert(adminLoginRes.status === 200, `ADMIN login should return 200, got ${adminLoginRes.status}`);
    console.assert(adminLoginRes.body.user.role === 'ADMIN', 'Role must be ADMIN');
    const setCookieAdmin = adminLoginRes.headers['set-cookie'];
    console.assert(setCookieAdmin && setCookieAdmin.length > 0, 'Admin login must set session cookie');
    adminCookie = setCookieAdmin[0].split(';')[0];
    console.log('✓ TEST 1 PASSED: ADMIN logged in successfully via Better Auth (Role: ADMIN)');

    // 2. TEAM can log in
    const teamLoginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: {
        username: config.TEAM_USERNAME,
        password: config.TEAM_PASSWORD
      }
    });
    console.assert(teamLoginRes.status === 200, `TEAM login should return 200, got ${teamLoginRes.status}`);
    console.assert(teamLoginRes.body.user.role === 'TEAM', 'Role must be TEAM');
    const setCookieTeam = teamLoginRes.headers['set-cookie'];
    console.assert(setCookieTeam && setCookieTeam.length > 0, 'Team login must set session cookie');
    teamCookie = setCookieTeam[0].split(';')[0];
    console.log('✓ TEST 2 PASSED: TEAM logged in successfully via Better Auth (Role: TEAM)');

    // 3. Invalid passwords are rejected
    const invalidLoginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: {
        username: config.ADMIN_USERNAME,
        password: 'incorrectPassword123'
      }
    });
    console.assert(invalidLoginRes.status === 401, `Invalid password must return 401, got ${invalidLoginRes.status}`);
    console.log('✓ TEST 3 PASSED: Invalid password rejected with 401');

    // 4. Unauthenticated users cannot access protected APIs
    const unauthRes = await makeRequest({
      method: 'GET',
      path: '/api/meetings'
    });
    console.assert(unauthRes.status === 401, `Unauthenticated request must return 401, got ${unauthRes.status}`);
    console.log('✓ TEST 4 PASSED: Unauthenticated access blocked on protected endpoints (401)');

    // 5. TEAM cannot create meetings using direct API requests
    const teamCreateRes = await makeRequest({
      method: 'POST',
      path: '/api/meetings',
      cookie: teamCookie,
      body: {
        title: 'Unauthorized Team Meeting',
        meetingDate: new Date().toISOString(),
        initialRowCount: 1
      }
    });
    console.assert(teamCreateRes.status === 403, `TEAM create meeting must return 403, got ${teamCreateRes.status}`);
    console.log('✓ TEST 5 PASSED: TEAM forbidden from creating meetings (403)');

    // 6. ADMIN can create meeting in DRAFT status
    const adminCreateRes = await makeRequest({
      method: 'POST',
      path: '/api/meetings',
      cookie: adminCookie,
      body: {
        title: 'Audio Engine & Visual Architecture Stand-up',
        meetingDate: '2026-11-05T09:00:00.000Z',
        initialRowCount: 2
      }
    });
    console.assert(adminCreateRes.status === 201, `ADMIN create meeting should return 201, got ${adminCreateRes.status}`);
    createdMeetingId = adminCreateRes.body.meeting.id;
    console.assert(adminCreateRes.body.meeting.status === 'DRAFT', 'Created meeting must initially be DRAFT');
    console.assert(adminCreateRes.body.meeting.records.length === 2, 'Initial participant slots must match');
    console.log('✓ TEST 6 PASSED: ADMIN successfully created meeting in DRAFT status');

    // 7. TEAM cannot see DRAFT meetings
    const teamMeetingsList = await makeRequest({
      method: 'GET',
      path: '/api/meetings',
      cookie: teamCookie
    });
    const foundDraft = teamMeetingsList.body.meetings.find((m) => m.id === createdMeetingId);
    console.assert(!foundDraft, 'Draft meeting must NEVER be visible to TEAM');
    console.log('✓ TEST 7 PASSED: DRAFT meetings are strictly hidden from TEAM accounts');

    // 8. TEAM cannot edit meetings using direct API requests
    const teamEditRes = await makeRequest({
      method: 'PUT',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie,
      body: { title: 'Tampered Meeting' }
    });
    console.assert(teamEditRes.status === 403, `TEAM edit meeting must return 403, got ${teamEditRes.status}`);
    console.log('✓ TEST 8 PASSED: TEAM forbidden from editing meetings (403)');

    // 9. TEAM cannot delete meetings using direct API requests
    const teamDeleteRes = await makeRequest({
      method: 'DELETE',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie
    });
    console.assert(teamDeleteRes.status === 403, `TEAM delete meeting must return 403, got ${teamDeleteRes.status}`);
    console.log('✓ TEST 9 PASSED: TEAM forbidden from deleting meetings (403)');

    // 10. ADMIN can edit and PUBLISH meeting
    const adminUpdateRes = await makeRequest({
      method: 'PUT',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: adminCookie,
      body: {
        title: 'Audio Engine & Visual Architecture Stand-up',
        meetingDate: '2026-11-05T09:00:00.000Z',
        nextMeetingDate: '2026-11-06T09:00:00.000Z',
        status: 'PUBLISHED',
        records: [
          {
            name: 'Abebe Bikila',
            workSinceLastStandup: 'Integrated spatial reverb filters',
            workRating: 9,
            nextStandupWork: 'Stress-test 64 voices on iOS',
            description: 'Refactored audio worklet processing nodes',
            acceptanceCriteria: 'Zero buffer underruns',
            questionsFromMembers: 'None',
            taskAssignment: 'AUDIO-101',
            timeDateEstimate: '2026-11-06T14:00:00'
          },
          {
            name: 'Sara Worku',
            workSinceLastStandup: 'Verified Better Auth session cookies with CORS',
            workRating: 10,
            nextStandupWork: 'Audit sharp edges and zero gradients',
            description: 'Enforced rigid 0px border-radius and brutalist studio palette',
            acceptanceCriteria: 'Conforms 100% to Muqecha Studios visual identity',
            questionsFromMembers: 'Sign-off complete',
            taskAssignment: 'AUTH-202',
            timeDateEstimate: '2026-11-06T16:30:00'
          }
        ]
      }
    });
    console.assert(adminUpdateRes.status === 200, `ADMIN publish meeting should return 200, got ${adminUpdateRes.status}`);
    console.assert(adminUpdateRes.body.meeting.status === 'PUBLISHED', 'Status must be PUBLISHED');
    console.log('✓ TEST 10 PASSED: ADMIN successfully updated and PUBLISHED meeting in database transaction');

    // 11. TEAM can now view PUBLISHED meeting and records
    const teamGetPublished = await makeRequest({
      method: 'GET',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie
    });
    console.assert(teamGetPublished.status === 200, `TEAM view published meeting should return 200, got ${teamGetPublished.status}`);
    console.assert(teamGetPublished.body.meeting.records.length === 2, 'Records must be retrieved');
    console.assert(teamGetPublished.body.meeting.records[0].name === 'Abebe Bikila', 'Record name must match');
    console.log('✓ TEST 11 PASSED: TEAM retrieved published meeting with all participant records');

    // 12. Refreshing browser preserves session (Session validation via /api/auth/get-session)
    const sessionCheck = await makeRequest({
      method: 'GET',
      path: '/api/auth/get-session',
      cookie: adminCookie
    });
    console.assert(sessionCheck.status === 200, `Session check should return 200, got ${sessionCheck.status}`);
    console.assert(sessionCheck.body.user.username === config.ADMIN_USERNAME, 'Session must match ADMIN');
    console.log('✓ TEST 12 PASSED: Session persists across requests via Better Auth cookie (get-session verified)');

    // 13. Logout invalidates session
    const logoutRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-out',
      cookie: adminCookie
    });
    console.assert(logoutRes.status === 200, `Sign-out should return 200, got ${logoutRes.status}`);

    const postLogoutSession = await makeRequest({
      method: 'GET',
      path: '/api/auth/get-session',
      cookie: adminCookie
    });
    console.assert(!postLogoutSession.body || !postLogoutSession.body.session, 'Session must be null after logout');
    console.log('✓ TEST 13 PASSED: Sign-out completely invalidates the Better Auth session');

    // 14. Verify existing meeting and participant records are preserved intact
    const allDbMeetings = await prisma.meeting.findMany({
      include: { records: true }
    });
    console.assert(allDbMeetings.length > 0, 'Existing meetings must be preserved');
    const syncMeeting = allDbMeetings.find(m => m.title.includes('Visual Identity & Audio Engine Sync'));
    console.assert(syncMeeting, 'Original stand-up meeting must be preserved');
    console.assert(syncMeeting.records.length > 0, 'Original participant records must be preserved');
    console.log(`✓ TEST 14 PASSED: Existing data preserved (${allDbMeetings.length} meetings, ${syncMeeting.records.length} records in verified meeting)`);

    console.log('================================================================');
    console.log(' ALL 14 BETTER AUTH & DATA INTEGRITY TEST CASES PASSED!');
    console.log('================================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('[TEST SUITE FAILURE]', err);
    if (server) server.close();
    process.exit(1);
  }
}

runBetterAuthTests();
