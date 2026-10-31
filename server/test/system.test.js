const http = require('http');
const db = require('../src/services/db');
const { app } = require('../src/index');

let server;
let port;
let teamCookie = '';
let adminCookie = '';
let createdMeetingId = '';

function makeRequest({ method, path, headers = {}, body = null, cookie = '' }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      'Content-Type': 'application/json',
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

async function runTests() {
  console.log('--- STARTING MUQECHA STUDIOS FULL SYSTEM VERIFICATION ---');

  // Seed DB
  await db.seedDefaultUsers();

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
    console.log('✓ Health check passed');

    // 2. Reject unauthenticated access to meetings
    const unauthMeetings = await makeRequest({ method: 'GET', path: '/api/meetings' });
    console.assert(unauthMeetings.status === 401, 'Unauthenticated request should return 401');
    console.log('✓ Unauthenticated access correctly blocked (401)');

    // 3. Test Invalid Login
    const invalidLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'Muqecha Admin', password: 'wrongpassword' }
    });
    console.assert(invalidLogin.status === 401, 'Invalid password should return 401');
    console.log('✓ Invalid password correctly rejected (401)');

    // 4. Test Team Login
    const teamLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'Muqecha Team', password: 'wegachbeteseb007#' }
    });
    console.assert(teamLogin.status === 200, 'Team login should return 200');
    console.assert(teamLogin.body.user.role === 'TEAM', 'Role must be TEAM');
    const setCookieTeam = teamLogin.headers['set-cookie'];
    console.assert(setCookieTeam && setCookieTeam.length > 0, 'Should set session cookie');
    teamCookie = setCookieTeam[0].split(';')[0];
    console.log('✓ Team login successful (Role: TEAM, Session Cookie issued)');

    // 5. Test Admin Login
    const adminLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'Muqecha Admin', password: 'wegachadmin007#' }
    });
    console.assert(adminLogin.status === 200, 'Admin login should return 200');
    console.assert(adminLogin.body.user.role === 'ADMIN', 'Role must be ADMIN');
    const setCookieAdmin = adminLogin.headers['set-cookie'];
    adminCookie = setCookieAdmin[0].split(';')[0];
    console.log('✓ Admin login successful (Role: ADMIN, Session Cookie issued)');

    // 6. Test Team /auth/me
    const teamMe = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      cookie: teamCookie
    });
    console.assert(teamMe.status === 200, 'GET /auth/me should succeed');
    console.assert(teamMe.body.user.username === 'Muqecha Team', 'Username should match');
    console.log('✓ /auth/me correctly identifies authenticated session');

    // 7. Team attempts to CREATE meeting -> Must be blocked with 403 Forbidden
    const forbiddenCreate = await makeRequest({
      method: 'POST',
      path: '/api/meetings',
      cookie: teamCookie,
      body: {
        title: 'Hacked Standup',
        meetingDate: new Date().toISOString(),
        initialRowCount: 2
      }
    });
    console.assert(forbiddenCreate.status === 403, 'Team user must receive 403 when creating meeting');
    console.log('✓ RBAC Security: Team user strictly forbidden from creating meetings (403)');

    // 8. Admin creates a new meeting
    const createRes = await makeRequest({
      method: 'POST',
      path: '/api/meetings',
      cookie: adminCookie,
      body: {
        title: 'Sprint 24 Stand-up Sync',
        meetingDate: '2026-11-05T09:00:00.000Z',
        initialRowCount: 2
      }
    });
    console.assert(createRes.status === 201, 'Admin meeting creation should return 201');
    createdMeetingId = createRes.body.meeting.id;
    console.assert(createRes.body.meeting.status === 'DRAFT', 'New meeting must initially be DRAFT');
    console.assert(createRes.body.meeting.records.length === 2, 'Initial participant rows count must match');
    console.log('✓ Admin created meeting successfully in DRAFT status with 2 participant slots');

    // 9. Verify Team user DOES NOT see DRAFT meeting
    const teamMeetingsList = await makeRequest({
      method: 'GET',
      path: '/api/meetings',
      cookie: teamCookie
    });
    const foundDraft = teamMeetingsList.body.meetings.find((m) => m.id === createdMeetingId);
    console.assert(!foundDraft, 'Draft meeting must NEVER be visible to Team users');
    console.log('✓ Security: DRAFT meetings are completely hidden from Team users');

    // 10. Admin updates and PUBLISHES meeting
    const updateRes = await makeRequest({
      method: 'PUT',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: adminCookie,
      body: {
        title: 'Sprint 24 Stand-up Sync',
        meetingDate: '2026-11-05T09:00:00.000Z',
        nextMeetingDate: '2026-11-06T09:00:00.000Z',
        records: [
          {
            name: 'Abebe Bikila',
            workSinceLastStandup: 'Completed audio sync pipeline',
            workRating: 9,
            nextStandupWork: 'Implement waveform visualizer',
            description: 'Refactored WebAudio context processing node',
            acceptanceCriteria: 'Zero dropouts at 48kHz sample rate',
            questionsFromMembers: 'None',
            taskAssignment: 'AUDIO-102',
            timeDateEstimate: '2026-11-06T15:00:00'
          },
          {
            name: 'Sara Worku',
            workSinceLastStandup: 'Drafted brand color scheme and CSS tokens',
            workRating: 8,
            nextStandupWork: 'Finalize navigation responsiveness',
            description: 'Verified exact viewport horizontal center for logo mark',
            acceptanceCriteria: 'Pixel-perfect across all mobile viewports',
            questionsFromMembers: 'Reviewed typography scale',
            taskAssignment: 'UI-405',
            timeDateEstimate: '2026-11-06T12:00:00'
          }
        ],
        status: 'PUBLISHED'
      }
    });
    console.assert(updateRes.status === 200, 'Update should return 200');
    console.assert(updateRes.body.meeting.status === 'PUBLISHED', 'Status should be PUBLISHED');
    console.assert(updateRes.body.meeting.records.length === 2, 'Records count must be 2');
    console.log('✓ Admin successfully saved and published meeting in database transaction');

    // 11. Team user now CAN view published meeting and records
    const teamGetPublished = await makeRequest({
      method: 'GET',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie
    });
    console.assert(teamGetPublished.status === 200, 'Team user must be able to view published meeting');
    console.assert(teamGetPublished.body.meeting.records.length === 2, 'Records must be populated');
    console.assert(teamGetPublished.body.meeting.records[0].name === 'Abebe Bikila', 'Record name matches');
    console.log('✓ Team user retrieved published meeting and all participant records');

    // 12. Team user CANNOT modify published meeting
    const teamTamper = await makeRequest({
      method: 'PUT',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie,
      body: { title: 'Tampered Title' }
    });
    console.assert(teamTamper.status === 403, 'Team user must be forbidden from editing meeting');
    console.log('✓ RBAC: Team user strictly forbidden from modifying meetings (403)');

    // 13. Team user CANNOT delete meeting
    const teamDelete = await makeRequest({
      method: 'DELETE',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: teamCookie
    });
    console.assert(teamDelete.status === 403, 'Team user must be forbidden from deleting meeting');
    console.log('✓ RBAC: Team user strictly forbidden from deleting meetings (403)');

    // 14. Admin deletes meeting
    const adminDelete = await makeRequest({
      method: 'DELETE',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: adminCookie
    });
    console.assert(adminDelete.status === 200, 'Admin delete should return 200');
    console.log('✓ Admin successfully deleted meeting');

    // 15. Verify meeting is gone
    const verifyGone = await makeRequest({
      method: 'GET',
      path: `/api/meetings/${createdMeetingId}`,
      cookie: adminCookie
    });
    console.assert(verifyGone.status === 404, 'Deleted meeting must return 404');
    console.log('✓ Deleted meeting confirmed gone (404)');

    // 16. Logout
    const logoutRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/logout',
      cookie: adminCookie
    });
    console.assert(logoutRes.status === 200, 'Logout should succeed');
    console.log('✓ Logout endpoint clears session successfully');

    console.log('--- ALL FULL SYSTEM INTEGRATION TESTS PASSED (16/16) ---');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('[TEST ERROR OCCURRED]', err);
    if (server) server.close();
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[TEST SUITE FAILED]', err);
  process.exit(1);
});
