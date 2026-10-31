const db = require('../services/db');

const meetingController = {
  // GET /api/meetings
  getMeetings: async (req, res) => {
    try {
      const userRole = req.user.role;
      const meetings = await db.meetings.findMany({ role: userRole });
      return res.status(200).json({ meetings });
    } catch (err) {
      console.error('[GET MEETINGS ERROR]', err);
      return res.status(500).json({ error: 'Failed to retrieve meetings.' });
    }
  },

  // GET /api/meetings/:id
  getMeetingById: async (req, res) => {
    try {
      const { id } = req.params;
      const userRole = req.user.role;
      const meeting = await db.meetings.findById(id, { role: userRole });

      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found or you do not have permission to view it.' });
      }

      return res.status(200).json({ meeting });
    } catch (err) {
      console.error('[GET MEETING BY ID ERROR]', err);
      return res.status(500).json({ error: 'Failed to retrieve meeting details.' });
    }
  },

  // POST /api/meetings (Admin only)
  createMeeting: async (req, res) => {
    try {
      const { title, meetingDate, initialRowCount } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Meeting title is required.' });
      }

      if (!meetingDate) {
        return res.status(400).json({ error: 'Meeting date is required.' });
      }

      const rowCount = Math.max(0, parseInt(initialRowCount, 10) || 0);

      const meeting = await db.meetings.create({
        title: title.trim(),
        meetingDate,
        initialRowCount: rowCount,
        status: 'DRAFT'
      });

      return res.status(201).json({
        message: 'Meeting created successfully',
        meeting
      });
    } catch (err) {
      console.error('[CREATE MEETING ERROR]', err);
      return res.status(500).json({ error: 'Failed to create meeting.' });
    }
  },

  // PUT /api/meetings/:id (Admin only)
  updateMeeting: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, meetingDate, nextMeetingDate, records, status = 'PUBLISHED' } = req.body;

      const errors = {};

      if (!title || !title.trim()) {
        errors.title = 'Meeting title is required';
      }

      if (!meetingDate) {
        errors.meetingDate = 'Meeting date is required';
      }

      if (!nextMeetingDate) {
        errors.nextMeetingDate = 'Next meeting date is required';
      }

      // Validate participant records
      const recordErrors = [];
      if (!Array.isArray(records) || records.length === 0) {
        errors.records = 'At least one participant row is required';
      } else {
        records.forEach((rec, idx) => {
          const recErr = {};
          if (!rec.name || !rec.name.trim()) {
            recErr.name = 'Participant name is required';
          }
          const rating = parseInt(rec.workRating, 10);
          if (isNaN(rating) || rating < 1 || rating > 10) {
            recErr.workRating = 'Rating must be an integer between 1 and 10';
          }
          if (Object.keys(recErr).length > 0) {
            recordErrors.push({ index: idx, errors: recErr });
          }
        });
      }

      if (recordErrors.length > 0) {
        errors.recordDetails = recordErrors;
      }

      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          error: 'Validation failed. Please correct the highlighted fields.',
          validationErrors: errors
        });
      }

      // Check existence
      const existing = await db.meetings.findById(id, { role: 'ADMIN' });
      if (!existing) {
        return res.status(404).json({ error: 'Meeting not found.' });
      }

      const updated = await db.meetings.saveMeetingWithRecords(id, {
        title: title.trim(),
        meetingDate,
        nextMeetingDate,
        records,
        status: status || 'PUBLISHED'
      });

      return res.status(200).json({
        message: 'Meeting and participant records saved successfully',
        meeting: updated
      });
    } catch (err) {
      console.error('[UPDATE MEETING ERROR]', err);
      return res.status(500).json({ error: 'Failed to update meeting records.' });
    }
  },

  // DELETE /api/meetings/:id (Admin only)
  deleteMeeting: async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.meetings.findById(id, { role: 'ADMIN' });
      if (!existing) {
        return res.status(404).json({ error: 'Meeting not found.' });
      }

      await db.meetings.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Meeting and all associated records deleted successfully.'
      });
    } catch (err) {
      console.error('[DELETE MEETING ERROR]', err);
      return res.status(500).json({ error: 'Failed to delete meeting.' });
    }
  }
};

module.exports = meetingController;

