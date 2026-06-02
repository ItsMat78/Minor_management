import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Group from '../models/Group';
import User from '../models/User';
import Project from '../models/Project';
import Event, { EventType } from '../models/Event';
import { sendGroupCreationEmail, sendGroupInviteEmail, sendGroupInviteResponseEmail } from '../utils/emailService';
import { nextActiveGroupNumber } from '../utils/groupNumbering';

// Batch years that require single-branch groups for the given GF event. Prefers the explicit
// per-batch list; falls back to the legacy boolean (which meant "all participating batches").
const restrictedBatchesOf = (event: any): string[] => {
    if (!event) return [];
    if (Array.isArray(event.branchRestrictedBatches)) return event.branchRestrictedBatches.map(String);
    if (event.branchRestricted) return (event.participatingBatches ?? []).map(String);
    return [];
};

// Branch comparison that's resilient to missing / inconsistently-cased data. Returns true
// (treat as same branch → allowed) unless BOTH branches are known and clearly differ. This
// prevents a single missing/empty branch field from locking a student out of grouping with
// everyone when branch restriction is on.
const sameBranch = (a?: string | null, b?: string | null): boolean => {
    const na = (a ?? '').trim().toUpperCase();
    const nb = (b ?? '').trim().toUpperCase();
    if (!na || !nb) return true; // unknown on either side — can't prove a mismatch, so don't block
    return na === nb;
};

// The batch year a student belongs to: their targetBatch override (droppers) if set,
// otherwise derived from the first two digits of their roll number.
const batchOf = (u: { targetBatch?: string | null; rollNumber?: string }): string | undefined => {
    if (u.targetBatch) return String(u.targetBatch);
    if (u.rollNumber) return '20' + u.rollNumber.substring(0, 2);
    return undefined;
};

// The Group Formation event that is active right now, or null.
const findActiveGFEvent = async () => {
    const now = new Date();
    return Event.findOne({
        type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
        isActive: true,
        startDate: { $lte: now },
        $or: [
            { extensionDate: { $exists: true, $ne: null, $gte: now } },
            { extensionDate: { $exists: false }, endDate: { $gte: now } },
            { extensionDate: null, endDate: { $gte: now } }
        ]
    });
};

export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { name, members } = req.body; // Expecting array of member IDs

        // Check if user is already in a group (accepted or pending)
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const existingGroup = await Group.findOne({
            $or: [{ members: userId }, { pendingMembers: userId }],
            isArchived: { $ne: true }
        });
        if (existingGroup) return res.status(400).json({ message: 'You are already in a group or have a pending invite' });

        // Validate other members — they go into pendingMembers and must accept
        const pendingMembers: string[] = [];
        let derivedTargetBatch: string | undefined = user.targetBatch;
        if (members && Array.isArray(members) && members.length > 0) {
            if (members.length + 1 > 3) {
                return res.status(400).json({ message: 'Group cannot exceed 3 members' });
            }

            for (const memberId of members) {
                if (memberId === userId) continue;

                const member = await User.findById(memberId);
                if (!member) return res.status(404).json({ message: `User ${memberId} not found` });
                if (member.role !== 'Student') return res.status(400).json({ message: `User ${member.name} is not a student` });

                if (member.targetBatch && !derivedTargetBatch) {
                    derivedTargetBatch = member.targetBatch;
                }

                const memberGroup = await Group.findOne({
                    $or: [{ members: memberId }, { pendingMembers: memberId }],
                    isArchived: { $ne: true }
                });
                if (memberGroup) return res.status(400).json({ message: `User ${member.name} is already in a group or has a pending invite` });

                pendingMembers.push(memberId);
            }
        }

        // Enforce branch restriction if the active GF event requires it
        if (pendingMembers.length > 0) {
            const now = new Date();
            const activeGF = await Event.findOne({
                type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
                isActive: true,
                startDate: { $lte: now },
                $or: [
                    { extensionDate: { $exists: true, $ne: null, $gte: now } },
                    { extensionDate: { $exists: false }, endDate: { $gte: now } },
                    { extensionDate: null, endDate: { $gte: now } }
                ]
            });
            // Only enforce single-branch if the creator's batch is one of the restricted batches.
            const restricted = restrictedBatchesOf(activeGF);
            const creatorBatch = batchOf(user);
            if (restricted.length > 0 && creatorBatch && restricted.includes(creatorBatch)) {
                for (const memberId of pendingMembers) {
                    const member = await User.findById(memberId);
                    if (member && !sameBranch(member.branch, user.branch)) {
                        return res.status(400).json({
                            message: `This semester, batch ${creatorBatch} groups must be single-branch. ${member.name} (${member.branch}) cannot join a ${user.branch} group.`
                        });
                    }
                }
            }
        }

        let assignedName = name;
        if (!assignedName) {
            // Determine the batch year for the new group
            let batchYear = derivedTargetBatch;
            if (!batchYear && user.rollNumber) {
                batchYear = '20' + user.rollNumber.substring(0, 2);
            }

            assignedName = (await nextActiveGroupNumber(batchYear)).toString();
        }

        const newGroup = new Group({
            name: assignedName,
            members: [userId], // Creator auto-accepts
            pendingMembers,
            createdBy: userId,
            status: 'Forming',
            inviteCode: Math.random().toString(36).substring(7).toUpperCase(),
            targetBatch: derivedTargetBatch
        });

        await newGroup.save();

        // Notify creator (confirmation) + invitees (request to approve)
        const [creatorUser, inviteUsers] = await Promise.all([
            User.findById(userId).select('email name'),
            User.find({ _id: { $in: pendingMembers } }).select('email name')
        ]);
        if (creatorUser?.email) {
            sendGroupCreationEmail([creatorUser.email], newGroup.name || 'Unnamed Group').catch(err => console.error("Creator email failed:", err));
        }
        for (const invitee of inviteUsers) {
            if (invitee.email) {
                sendGroupInviteEmail(invitee.email, creatorUser?.name || 'A classmate', newGroup.name || 'Unnamed Group').catch(err => console.error("Invite email failed:", err));
            }
        }

        res.status(201).json(newGroup);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getMyGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        // Only the student's *current* (non-archived) group. Past semesters' groups are
        // archived at rollover and surfaced separately via /projects/archived — returning
        // them here would hide the Student Directory and block forming a new group.
        const group = await Group.findOne({ members: userId, isArchived: { $ne: true } })
            .sort({ createdAt: -1 })
            .populate('members', 'name email role branch rollNumber photoUrl')
            .populate('pendingMembers', 'name email rollNumber photoUrl branch')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name department email photoUrl' }
            });

        if (!group) return res.status(404).json({ message: 'No group found' });

        // Fetch all projects for this group to support multiple proposals
        const allProjects = await Project.find({ group: group._id })
            .populate('faculty', 'name department email photoUrl')
            .populate('updates.createdBy', 'name role')
            .sort({ createdAt: -1 });

        const groupData = group.toObject();
        (groupData as any).projects = allProjects;

        res.json(groupData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getMyPendingInvites = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const invites = await Group.find({ pendingMembers: userId, isArchived: { $ne: true } })
            .populate('members', 'name email rollNumber photoUrl branch')
            .populate('pendingMembers', 'name email rollNumber photoUrl branch')
            .populate('createdBy', 'name email rollNumber photoUrl');
        res.json(invites);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const acceptInvite = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(400).json({ message: 'Group is archived' });
        if (!group.pendingMembers.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'No pending invite for this user' });
        }

        // Re-enforce the same-branch rule at accept time (it may have been enabled, or the
        // accepter's branch changed, after the invite was sent).
        const activeGF = await findActiveGFEvent();
        const restricted = restrictedBatchesOf(activeGF);
        if (restricted.length > 0) {
            const [accepter, creator] = await Promise.all([
                User.findById(userId).select('branch'),
                group.createdBy ? User.findById(group.createdBy).select('branch rollNumber targetBatch') : null
            ]);
            // The group's batch is its targetBatch override, else the creator's batch.
            const groupBatch = (group.targetBatch ? String(group.targetBatch) : undefined)
                || (creator ? batchOf(creator) : undefined);
            if (groupBatch && restricted.includes(groupBatch) && creator && accepter && !sameBranch(accepter.branch, creator.branch)) {
                return res.status(400).json({
                    message: `This semester, batch ${groupBatch} groups must be single-branch. You (${accepter.branch}) cannot join a ${creator.branch} group.`
                });
            }
        }

        group.pendingMembers = group.pendingMembers.filter(m => m.toString() !== userId) as any;
        group.members.push(userId as any);
        await group.save();

        // Email creator and existing members about the acceptance
        const [me, creatorUser, otherMembers] = await Promise.all([
            User.findById(userId).select('name'),
            group.createdBy ? User.findById(group.createdBy).select('email') : null,
            User.find({ _id: { $in: group.members.filter(m => m.toString() !== userId) } }).select('email')
        ]);
        const emails = [creatorUser?.email, ...otherMembers.map(m => m.email)].filter((e): e is string => !!e);
        if (emails.length > 0) {
            sendGroupInviteResponseEmail(emails, me?.name || 'A member', group.name || 'Unnamed Group', 'accepted').catch(err => console.error('Accept email failed:', err));
        }

        res.json({ message: 'Invite accepted', group });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const rejectInvite = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.pendingMembers.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'No pending invite for this user' });
        }

        group.pendingMembers = group.pendingMembers.filter(m => m.toString() !== userId) as any;

        // If rejection leaves the group empty or creator-only with no pending, keep it (creator can re-invite).
        // If all pending rejected and only creator remains, group is still valid as a solo group.
        await group.save();

        const [me, creatorUser] = await Promise.all([
            User.findById(userId).select('name'),
            group.createdBy ? User.findById(group.createdBy).select('email') : null
        ]);
        if (creatorUser?.email) {
            sendGroupInviteResponseEmail([creatorUser.email], me?.name || 'A member', group.name || 'Unnamed Group', 'rejected').catch(err => console.error('Reject email failed:', err));
        }

        res.json({ message: 'Invite rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Withdraw an outstanding invite. Any current group member may cancel a pending invite — e.g.
// when an invitee never responds and the group needs to clear it to submit a proposal.
export const cancelInvite = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;
        const { memberId } = req.body;
        if (!memberId) return res.status(400).json({ message: 'memberId is required' });

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(403).json({ message: 'Archived groups are read-only.' });

        if (!group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Only a group member can cancel an invite.' });
        }
        if (!group.pendingMembers.map(m => m.toString()).includes(memberId)) {
            return res.status(400).json({ message: 'That user does not have a pending invite for this group.' });
        }

        group.pendingMembers = group.pendingMembers.filter(m => m.toString() !== memberId) as any;
        await group.save();

        res.json({ message: 'Invite cancelled.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Invite additional members to an already-formed group. Allowed only while a Group Formation
// event is open AND the group has not sent a proposal (no Pending/Approved project). Once a
// proposal is sent it must be withdrawn or rejected before new members can be added.
export const inviteMembers = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;
        const { members } = req.body;

        if (!Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ message: 'No members to invite.' });
        }

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(403).json({ message: 'Archived groups are read-only.' });

        if (!group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Only a group member can invite others.' });
        }

        // Block once group formation has closed.
        const activeGF = await findActiveGFEvent();
        if (!activeGF) {
            return res.status(403).json({ message: 'Group formation is not currently open.' });
        }

        // Block if the group already has a sent proposal (Pending or Approved). Drafts are fine.
        const activeProposal = await Project.findOne({ group: group._id, status: { $in: ['Pending', 'Approved'] } });
        if (activeProposal) {
            return res.status(400).json({ message: 'Withdraw or get the current proposal rejected before adding members.' });
        }

        // Capacity: existing members + outstanding invites + new invites must not exceed 3.
        const current = group.members.length + group.pendingMembers.length;
        if (current + members.length > 3) {
            return res.status(400).json({ message: 'Group cannot exceed 3 members (including pending invites).' });
        }

        // Branch-restriction context for this group's batch.
        const creator = group.createdBy
            ? await User.findById(group.createdBy).select('branch rollNumber targetBatch')
            : null;
        const groupBatch = (group.targetBatch ? String(group.targetBatch) : undefined)
            || (creator ? batchOf(creator) : undefined);
        const branchLocked = !!groupBatch && restrictedBatchesOf(activeGF).includes(groupBatch);
        // The branch a locked group is fixed to: the creator's, else the first member's.
        let groupBranch: string | null | undefined = creator?.branch;
        if (branchLocked && !groupBranch && group.members.length > 0) {
            const firstMember = await User.findById(group.members[0]).select('branch');
            groupBranch = firstMember?.branch;
        }

        const toInvite: string[] = [];
        for (const memberId of members) {
            if (group.members.map(m => m.toString()).includes(memberId)
                || group.pendingMembers.map(m => m.toString()).includes(memberId)) {
                continue; // already a member / already invited — skip silently
            }
            const member = await User.findById(memberId);
            if (!member) return res.status(404).json({ message: `User ${memberId} not found` });
            if (member.role !== 'Student') return res.status(400).json({ message: `${member.name} is not a student` });

            const memberGroup = await Group.findOne({
                $or: [{ members: memberId }, { pendingMembers: memberId }],
                isArchived: { $ne: true }
            });
            if (memberGroup) return res.status(400).json({ message: `${member.name} is already in a group or has a pending invite` });

            if (branchLocked && !sameBranch(member.branch, groupBranch)) {
                return res.status(400).json({
                    message: `This semester, batch ${groupBatch} groups must be single-branch. ${member.name} (${member.branch}) cannot join a ${groupBranch} group.`
                });
            }

            toInvite.push(memberId);
        }

        if (toInvite.length === 0) {
            return res.status(400).json({ message: 'No new members to invite.' });
        }

        group.pendingMembers.push(...(toInvite as any));
        await group.save();

        const [inviter, inviteUsers] = await Promise.all([
            User.findById(userId).select('name'),
            User.find({ _id: { $in: toInvite } }).select('email name')
        ]);
        for (const invitee of inviteUsers) {
            if (invitee.email) {
                sendGroupInviteEmail(invitee.email, inviter?.name || 'A classmate', group.name || 'Unnamed Group')
                    .catch(err => console.error('Invite email failed:', err));
            }
        }

        const updated = await Group.findById(group._id)
            .populate('members', 'name email role branch rollNumber photoUrl')
            .populate('pendingMembers', 'name email rollNumber photoUrl branch');
        res.json({ message: 'Invitations sent.', group: updated });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const leaveGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { password } = req.body;

        if (!password) return res.status(400).json({ message: 'Password is required' });

        // Verify password
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

        const group = await Group.findOne({ members: userId, isArchived: { $ne: true } });
        if (!group) return res.status(404).json({ message: 'Not in an active group' });
        if (group.isArchived) return res.status(403).json({ message: 'Cannot leave an archived group.' });

        // Block leaving if the group's project has been approved
        if (group.status === 'Approved') {
            return res.status(403).json({ message: 'Cannot leave the group after a project proposal has been accepted.' });
        }
        // Defensive check: also query the project directly in case group.status lags
        const approvedProject = await Project.findOne({ group: group._id, status: 'Approved' });
        if (approvedProject) {
            return res.status(403).json({ message: 'Cannot leave the group after a project proposal has been accepted.' });
        }

        // Remove user from group
        group.members = group.members.filter(m => m.toString() !== userId);

        // If group becomes empty, dissolve it and delete associated projects
        if (group.members.length === 0) {
            await Project.deleteMany({ group: group._id });
            await Group.findByIdAndDelete(group._id);
            return res.json({ message: 'Left group. Group dissolved as it became empty.' });
        } else {
            // Assign new leader or handle logic? Currently no strict leader, any member is equal in schema
            await group.save();
            return res.json({ message: 'Successfully left the group.' });
        }

    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getMyMentees = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        // Find groups where the project has been APPROVED by this faculty
        const projects = await Project.find({ faculty: userId, status: 'Approved', isArchived: { $ne: true } })
            .populate('faculty', 'name department email photoUrl')
            .populate('updates.createdBy', 'name role')
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber photoUrl branch' }
            });

        const groups = projects.filter((p: any) => p.group).map((p: any) => ({
            ...p.group.toObject(),
            project: {
                title: p.title,
                description: p.description,
                status: p.status,
                _id: p._id,
                hasNewUpdate: p.hasNewUpdate,
                updates: p.updates,
                semester: p.semester,
                tags: p.tags,
                attachments: p.attachments,
                feedback: p.feedback,
                faculty: p.faculty,
                midTermEvaluation: p.midTermEvaluation,
                endTermEvaluation: p.endTermEvaluation,
                finalReportEvaluation: p.finalReportEvaluation,
                studentFeedback: p.studentFeedback,
                studentEvaluations: p.studentEvaluations,
                submissions: p.submissions
            }
        }));

        res.json(groups);
    } catch (error) {
        console.error("Error fetching mentees:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getAllGroups = async (req: Request, res: Response) => {
    try {
        const { page: pageParam, limit: limitParam, search, batch, status, faculty } = req.query;
        const page = pageParam ? Math.max(1, parseInt(pageParam as string)) : 0;
        const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam as string))) : 0;
        const usePagination = page > 0 && limit > 0;

        const filter: any = { isArchived: { $ne: true } };

        if (batch && batch !== 'All') {
            // match by targetBatch OR by any member's roll year prefix
            const batchSuffix = (batch as string).slice(-2);
            const membersInBatch = await User.find({ rollNumber: { $regex: `^${batchSuffix}` } }).select('_id').lean();
            filter.$or = [
                { targetBatch: batch },
                { members: { $in: membersInBatch.map(m => m._id) } }
            ];
        }
        if (status && status !== 'All') filter.status = status;

        if (search && typeof search === 'string' && search.trim()) {
            const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(safe, 'i');
            // Prefilter by member name/email/roll OR group name OR project title
            const userMatches = await User.find({ $or: [{ name: rx }, { email: rx }, { rollNumber: rx }] }).select('_id').lean();
            const projectMatches = await Project.find({ title: rx }).select('_id').lean();
            filter.$and = [
                ...(filter.$and || []),
                {
                    $or: [
                        { name: rx },
                        { members: { $in: userMatches.map(u => u._id) } },
                        { project: { $in: projectMatches.map(p => p._id) } }
                    ]
                }
            ];
        }

        let baseQuery = Group.find(filter)
            .populate('members', 'name email rollNumber photoUrl branch')
            .populate('pendingMembers', 'name email rollNumber photoUrl branch')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email department photoUrl' },
                select: 'title description status tags semester attachments feedback hasNewUpdate updates faculty midTermEvaluation endTermEvaluation finalReportEvaluation studentFeedback studentEvaluations'
            })
            .sort({ createdAt: -1 });

        // Faculty filter applied post-populate since project is a ref
        if (usePagination) {
            const total = await Group.countDocuments(filter);
            let groups = await baseQuery.skip((page - 1) * limit).limit(limit);
            if (faculty && faculty !== 'All') {
                groups = groups.filter((g: any) => g.project && String(g.project.faculty?._id || g.project.faculty) === faculty);
            }
            res.json({ data: groups, total, page, pages: Math.ceil(total / limit) });
        } else {
            let groups = await baseQuery;
            if (faculty && faculty !== 'All') {
                groups = groups.filter((g: any) => g.project && String(g.project.faculty?._id || g.project.faculty) === faculty);
            }
            res.json(groups);
        }
    } catch (error) {
        console.error("Error fetching all groups:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { targetBatch } = req.body;

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(403).json({ message: 'Archived groups are read-only and cannot be modified.' });

        await Group.findByIdAndUpdate(id, { targetBatch }, { new: true });

        res.json(group);
    } catch (error) {
        console.error("Error updating group:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};
export const getNextGroupNumber = async (req: Request, res: Response) => {
    try {
        const { batch } = req.query;
        if (!batch) return res.status(400).json({ message: 'Batch is required' });

        res.json({ nextNumber: await nextActiveGroupNumber(batch as string) });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
