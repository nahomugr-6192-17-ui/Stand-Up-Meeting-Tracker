import { prisma, getDb } from './prismaDb.js';

export const dbService = {
  getRawDb: getDb,
  prisma,

  // Meetings
  meetings: {
    findMany: async ({ role }) => {
      const where = role === 'ADMIN' ? {} : { status: 'PUBLISHED' };
      return prisma.meeting.findMany({
        where,
        orderBy: [
          { meetingDate: 'desc' },
          { createdAt: 'desc' }
        ]
      });
    },

    findById: async (id, { role }) => {
      const where = role === 'ADMIN' ? { id } : { id, status: 'PUBLISHED' };
      return prisma.meeting.findFirst({
        where,
        include: {
          records: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    },

    create: async ({ title, meetingDate, initialRowCount = 0, status = 'DRAFT' }) => {
      const recordsData = [];
      for (let i = 0; i < initialRowCount; i++) {
        recordsData.push({
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

      return prisma.meeting.create({
        data: {
          title,
          meetingDate: new Date(meetingDate),
          status,
          records: {
            create: recordsData
          }
        },
        include: {
          records: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    },

    saveMeetingWithRecords: async (id, { title, meetingDate, nextMeetingDate, records, status = 'PUBLISHED' }) => {
      return prisma.$transaction(async (tx) => {
        // Delete previous records for clean update
        await tx.meetingRecord.deleteMany({
          where: { meetingId: id }
        });

        const recordsToCreate = (records || []).map((r, i) => ({
          id: r.id && !r.id.startsWith('temp_') ? r.id : undefined,
          name: r.name || '',
          workSinceLastStandup: r.workSinceLastStandup || '',
          workRating: parseInt(r.workRating, 10) || 5,
          nextStandupWork: r.nextStandupWork || '',
          description: r.description || '',
          acceptanceCriteria: r.acceptanceCriteria || '',
          questionsFromMembers: r.questionsFromMembers || '',
          taskAssignment: r.taskAssignment || '',
          timeDateEstimate: r.timeDateEstimate || null,
          sortOrder: i
        }));

        return tx.meeting.update({
          where: { id },
          data: {
            title,
            meetingDate: new Date(meetingDate),
            nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : null,
            status,
            records: {
              create: recordsToCreate
            }
          },
          include: {
            records: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        });
      });
    },

    delete: async (id) => {
      await prisma.meeting.delete({
        where: { id }
      });
      return true;
    }
  }
};

export default dbService;
