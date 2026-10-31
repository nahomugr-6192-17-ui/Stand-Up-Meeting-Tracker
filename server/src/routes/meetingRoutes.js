import express from 'express';
import meetingController from '../controllers/meetingController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All meeting routes require authenticated session
router.use(requireAuth);

// Team and Admin can retrieve meetings (filtered by role in controller)
router.get('/', meetingController.getMeetings);
router.get('/:id', meetingController.getMeetingById);

// Admin-only management endpoints
router.post('/', requireAdmin, meetingController.createMeeting);
router.put('/:id', requireAdmin, meetingController.updateMeeting);
router.delete('/:id', requireAdmin, meetingController.deleteMeeting);

export default router;
