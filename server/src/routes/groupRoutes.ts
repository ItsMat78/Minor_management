import express from 'express';
import { createGroup, getMyGroup, leaveGroup, getMyMentees, getAllGroups, updateGroup } from '../controllers/groupController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// All group routes require authentication
router.use(auth);

router.post('/', createGroup);
router.put('/:id', updateGroup);
router.get('/my', getMyGroup);
router.get('/mentees', getMyMentees);

router.get('/', getAllGroups);
router.post('/leave', leaveGroup);

export default router;
