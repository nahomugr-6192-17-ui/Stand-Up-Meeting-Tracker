const db = require('../services/db');

async function seedSampleMeeting() {
  const existing = await db.meetings.findMany({ role: 'ADMIN' });
  if (existing.length > 0) {
    return; // Already has meetings
  }

  console.log('[SEED] Seeding initial sample stand-up meeting...');

  const sampleMeeting = await db.meetings.create({
    title: 'Daily Stand-up — Visual Identity & Audio Engine Sync',
    meetingDate: '2026-10-31T09:00:00.000Z',
    initialRowCount: 0,
    status: 'PUBLISHED'
  });

  await db.meetings.saveMeetingWithRecords(sampleMeeting.id, {
    title: 'Daily Stand-up — Visual Identity & Audio Engine Sync',
    meetingDate: '2026-10-31T09:00:00.000Z',
    nextMeetingDate: '2026-11-02T09:00:00.000Z',
    status: 'PUBLISHED',
    records: [
      {
        name: 'Dawit Mengistu',
        workSinceLastStandup: 'Finished the sound design pipeline and 3D ambient reverb assets.',
        workRating: 9,
        nextStandupWork: 'Integrate dynamic audio stems with the timeline playback node.',
        description: 'Cleaned up memory leaks in the spatial audio buffer listener.',
        acceptanceCriteria: 'Zero latency degradation across 64 simultaneous audio voices.',
        questionsFromMembers: 'Need confirmation on default gain level for UI SFX.',
        taskAssignment: 'AUDIO-84',
        timeDateEstimate: '2026-11-02T14:00:00'
      },
      {
        name: 'Helen Tadesse',
        workSinceLastStandup: 'Finalized the Muqecha Studios design system tokens and sharp-edge aesthetic.',
        workRating: 10,
        nextStandupWork: 'Audit contrast ratios and mobile responsiveness on small tablet viewports.',
        description: 'Enforced zero border-radius and eliminated AI-style gradient fills for an architectural studio look.',
        acceptanceCriteria: 'All screens conform 100% to brand palette and viewport-centered logo standards.',
        questionsFromMembers: 'None. Review scheduled with lead developer.',
        taskAssignment: 'BRAND-102',
        timeDateEstimate: '2026-11-01T17:00:00'
      },
      {
        name: 'Yonas Kassa',
        workSinceLastStandup: 'Implemented secure session auth with RBAC and PostgreSQL persistence.',
        workRating: 9,
        nextStandupWork: 'Set up automated data backups and rate-limiting monitoring.',
        description: 'Built atomic multi-table transactions for saving meetings and participant records.',
        acceptanceCriteria: 'Database transactions roll back safely if validation fails.',
        questionsFromMembers: 'Will test under high concurrent load next Monday.',
        taskAssignment: 'SEC-310',
        timeDateEstimate: '2026-11-02T11:30:00'
      }
    ]
  });

  console.log('[SEED] Initial sample stand-up meeting published successfully!');
}

module.exports = seedSampleMeeting;

