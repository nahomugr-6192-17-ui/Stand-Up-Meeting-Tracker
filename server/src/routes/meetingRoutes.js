const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All meeting routes require authenticated session
router.use(requireAuth);

// Team and Admin can retrieve meetings (filtered by role in controller)
router.get('/', meetingController.getMeetings);
router.get('/:id', meetingController.getMeetingById);

// Admin-only management endpoints
router.post('/', requireAdmin, meetingController.createMeeting);
router.put('/:id', requireAdmin, meetingController.updateMeeting);
router.delete('/:id', requireAdmin, meetingController.deleteMeeting);

module.exports = router;

