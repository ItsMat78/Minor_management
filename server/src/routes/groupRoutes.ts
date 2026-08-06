import express from 'express';
import { createGroup, getMyGroup, leaveGroup, getMyMentees, getAllGroups, updateGroup, getNextGroupNumber, acceptInvite, rejectInvite, getMyPendingInvites, cancelInvite, inviteMembers, adminCreateGroup, adminAddGroupMembers, adminRemoveGroupMember, adminSetGroupMentor } from '../controllers/groupController';
import { auth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';
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

// Admin roster management from the Group Directory
router.post('/admin', adminAuth, adminCreateGroup);
router.post('/:id/members', adminAuth, adminAddGroupMembers);
router.delete('/:id/members/:memberId', adminAuth, adminRemoveGroupMember);
// Multipart: filing a proposal for a group that has none carries attachments, the same way the
// project routes take them. A plain JSON body still parses — multer leaves it alone.
router.put('/:id/mentor', adminAuth, upload.array('files', 5), adminSetGroupMentor);

export default router;
