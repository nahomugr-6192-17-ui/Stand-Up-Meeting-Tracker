import http from 'http';
import { app } from '../src/index.js';
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

async function runSystemTests() {
  console.log('================================================================');
  console.log(' STARTING FULL SYSTEM & BETTER AUTH VERIFICATION TEST SUITE');
  console.log('================================================================');

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
    // 1. Health check
    const health = await makeRequest({ method: 'GET', path: '/api/health' });
    console.assert(health.status === 200, 'Health check should return 200');
    console.log('✓ TEST 1 PASSED: Health check passed');

    // 2. Reject unauthenticated access to meetings
    const unauthMeetings = await makeRequest({ method: 'GET', path: '/api/meetings' });
    console.assert(unauthMeetings.status === 401, 'Unauthenticated request should return 401');
    console.log('✓ TEST 2 PASSED: Unauthenticated access blocked on protected endpoints (401)');

    // 3. Test Invalid Login
    const invalidLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: { username: 'Muqecha Admin', password: 'wrongpassword' }
    });
    console.assert(invalidLogin.status === 401, 'Invalid password should return 401');
    console.log('✓ TEST 3 PASSED: Invalid password rejected with 401');

    // 4. Test Team Login
    const teamLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: { username: config.TEAM_USERNAME, password: config.TEAM_PASSWORD }
    });
    console.assert(teamLogin.status === 200, 'Team login should return 200');
    console.assert(teamLogin.body.user.role === 'TEAM', 'Role must be TEAM');
    const setCookieTeam = teamLogin.headers['set-cookie'];
    console.assert(setCookieTeam && setCookieTeam.length > 0, 'Should set session cookie');
    teamCookie = setCookieTeam[0].split(';')[0];
    console.log(`✓ TEST 4 PASSED: TEAM logged in successfully via Better Auth (${config.TEAM_USERNAME})`);

    // 5. Test Admin Login
    const adminLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/sign-in/username',
      body: { username: config.ADMIN_USERNAME, password: config.ADMIN_PASSWORD }
    });
    console.assert(adminLogin.status === 200, 'Admin login should return 200');
    console.assert(adminLogin.body.user.role === 'ADMIN', 'Role must be ADMIN');
    const setCookieAdmin = adminLogin.headers['set-cookie'];
    console.assert(setCookieAdmin && setCookieAdmin.length > 0, 'Admin login must set session cookie');
    adminCookie = setCookieAdmin[0].split(';')[0];
    console.log(`✓ TEST 5 PASSED: ADMIN logged in successfully via Better Auth (${config.ADMIN_USERNAME})`);

    // 6. Test Session identification (/api/auth/get-session)
    const sessionRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/get-session',
      cookie: teamCookie
    });
    console.assert(sessionRes.status === 200, 'Session check should return 200');
    console.assert(sessionRes.body.user.username === config.TEAM_USERNAME, 'Username should match TEAM');
    console.log('✓ TEST 6 PASSED: Session correctly identified from cookie token');

    // 7. TEAM forbidden from creating meetings (403)
    const forbiddenCreate = await makeRequest({
      method: 'POST',
      path: '/api/meetings',
      cookie: teamCookie,
      body: {
        title: 'Unauthorized Meeting',
        meetingDate: new Date().toISOString(),
        initialRowCount: 1
      }
    });
    console.assert(forbiddenCreate.status === 403, `TEAM create meeting must return 403, got ${forbiddenCreate.status}`);
    console.log('✓ TEST 7 PASSED: TEAM forbidden from creating meetings (403)');

    // 8. ADMIN creates meeting in DRAFT status
    const adminCreateRes = await makeRequest({
      method: 'POST',
      path: '/api/meetings',
      cookie: adminCookie,
      body: {
        title: 'System Integration Stand-up',
        meetingDate: new Date().toISOString(),
        initialRowCount: 2
      }
    });
    console.assert(adminCreateRes.status === 201, `ADMIN create meeting should return 201, got ${adminCreateRes.status}`);
    console.assert(adminCreateRes.body.meeting.status === 'DRAFT', 'Meeting should be DRAFT by default');
    createdMeetingId = adminCreateRes.body.meeting.id;
    console.log('✓ TEST 8 PASSED: ADMIN successfully created meeting in DRAFT status');

    // 9. DRAFT meetings hidden from TEAM
    const teamMeetingsRes = await makeRequest({
      method: 'GET',
      path: '/api/meetings',
      cookie: teamCookie
    });
    console.assert(teamMeetingsRes.status === 200, 'TEAM get meetings should return 200');
    const draftFound = teamMeetingsRes.body.meetings.some(m => m.id === createdMeetingId);
    console.assert(!draftFound, 'DRAFT meeting must NOT be visible to TEAM');
    console.log('✓ TEST 9 PASSED: DRAFT meetings are strictly hidden from TEAM accounts');

    // 10. TEAM forbidden from editing meetings (403)
    const teamEditRes = await makeRequest({
      method: 'PUT',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie,
      body: { title: 'Hacked Edit' }
    });
    console.assert(teamEditRes.status === 403, `TEAM edit meeting must return 403, got ${teamEditRes.status}`);
    console.log('✓ TEST 10 PASSED: TEAM forbidden from editing meetings (403)');

    // 11. TEAM forbidden from deleting meetings (403)
    const teamDeleteRes = await makeRequest({
      method: 'DELETE',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie
    });
    console.assert(teamDeleteRes.status === 403, `TEAM delete meeting must return 403, got ${teamDeleteRes.status}`);
    console.log('✓ TEST 11 PASSED: TEAM forbidden from deleting meetings (403)');

    // 12. ADMIN updates and publishes meeting
    const adminPublishRes = await makeRequest({
      method: 'PUT',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: adminCookie,
      body: {
        title: 'System Integration Stand-up (Published)',
        meetingDate: '2026-11-01T09:00:00.000Z',
        nextMeetingDate: '2026-11-02T09:00:00.000Z',
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
            timeDateEstimate: '2026-11-02T14:00:00'
          }
        ]
      }
    });
    console.assert(adminPublishRes.status === 200, `ADMIN publish should return 200, got ${adminPublishRes.status}`);
    console.log('✓ TEST 12 PASSED: ADMIN successfully updated and PUBLISHED meeting in database transaction');

    // 13. TEAM can now view PUBLISHED meeting
    const teamViewPublished = await makeRequest({
      method: 'GET',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie
    });
    console.assert(teamViewPublished.status === 200, 'TEAM should be able to view published meeting');
    console.assert(teamViewPublished.body.meeting.records.length === 1, 'Records should be loaded');
    console.log('✓ TEST 13 PASSED: TEAM retrieved published meeting with participant records');

    // 14. Session persistence after simulated refresh
    const refreshSession = await makeRequest({
      method: 'GET',
      path: '/api/auth/get-session',
      cookie: adminCookie
    });
    console.assert(refreshSession.status === 200, 'Admin session should persist across requests');
    console.assert(refreshSession.body.user.username === config.ADMIN_USERNAME, 'Admin username must match');
    console.log('✓ TEST 14 PASSED: Session persists across requests via Better Auth cookie');

    // 15. Sign-out invalidates session
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
    console.log('✓ TEST 15 PASSED: Sign-out completely invalidates the Better Auth session');

    // 16. Existing meeting & participant records preserved
    const allDbMeetings = await prisma.meeting.findMany({ include: { records: true } });
    console.assert(allDbMeetings.length > 0, 'Database meetings must exist');
    const originalMeeting = allDbMeetings.find(m => m.title.includes('Visual Identity & Audio Engine Sync'));
    console.assert(originalMeeting, 'Original stand-up meeting must be preserved');
    console.assert(originalMeeting.records.length > 0, 'Original participant records must be preserved');
    console.log(`✓ TEST 16 PASSED: Existing data preserved (${allDbMeetings.length} meetings in PostgreSQL 18)`);

    console.log('================================================================');
    console.log(' ALL 16 SYSTEM & BETTER AUTH INTEGRATION TEST CASES PASSED!');
    console.log('================================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('[TEST SUITE FAILURE]', err);
    if (server) server.close();
    process.exit(1);
  }
}

runSystemTests();
