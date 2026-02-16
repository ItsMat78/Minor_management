import express from 'express';
import { createGroup, getMyGroup, leaveGroup, getMyMentees } from '../controllers/groupController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// All group routes require authentication
router.use(auth);

router.post('/', createGroup);
router.get('/my', getMyGroup);
router.get('/mentees', getMyMentees);

router.post('/leave', leaveGroup);

export default router;
