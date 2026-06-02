import express from 'express';
import { createGroup, getMyGroup, leaveGroup, getMyMentees, getAllGroups, updateGroup, getNextGroupNumber, acceptInvite, rejectInvite, getMyPendingInvites, cancelInvite, inviteMembers } from '../controllers/groupController';
import { auth } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';

const router = express.Router();

const adminAuth = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === UserRole.ADMIN) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

// All group routes require authentication
router.use(auth);

router.post('/', createGroup);
router.put('/:id', updateGroup);
router.get('/my', getMyGroup);
router.get('/my/invites', getMyPendingInvites);
router.get('/mentees', getMyMentees);
router.get('/', adminAuth, getAllGroups);
router.get('/next-number', getNextGroupNumber);
router.post('/leave', leaveGroup);
router.post('/:id/accept', acceptInvite);
router.post('/:id/reject', rejectInvite);
router.post('/:id/invite', inviteMembers);
router.post('/:id/cancel-invite', cancelInvite);

export default router;
