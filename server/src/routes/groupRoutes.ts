import express from 'express';
import { createGroup, getMyGroup, leaveGroup, getMyMentees, getAllGroups, updateGroup, getNextGroupNumber, acceptInvite, rejectInvite, getMyPendingInvites, cancelInvite, inviteMembers, adminCreateGroup, adminAddGroupMembers, adminRemoveGroupMember, adminSetGroupMentor } from '../controllers/groupController';
import { auth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';
import { requirePermission } from '../utils/permissions';

const router = express.Router();

// All group routes require authentication
router.use(auth);

router.post('/', createGroup);
router.put('/:id', updateGroup);
router.get('/my', getMyGroup);
router.get('/my/invites', getMyPendingInvites);
router.get('/mentees', getMyMentees);
router.get('/', requirePermission('groups'), getAllGroups);
router.get('/next-number', getNextGroupNumber);
router.post('/leave', leaveGroup);
router.post('/:id/accept', acceptInvite);
router.post('/:id/reject', rejectInvite);
router.post('/:id/invite', inviteMembers);
router.post('/:id/cancel-invite', cancelInvite);

// Staff roster management from the Group Directory
router.post('/admin', requirePermission('groups'), adminCreateGroup);
router.post('/:id/members', requirePermission('groups'), adminAddGroupMembers);
router.delete('/:id/members/:memberId', requirePermission('groups'), adminRemoveGroupMember);
// Multipart: filing a proposal for a group that has none carries attachments, the same way the
// project routes take them. A plain JSON body still parses — multer leaves it alone.
router.put('/:id/mentor', requirePermission('groups'), upload.array('files', 5), adminSetGroupMentor);

export default router;
