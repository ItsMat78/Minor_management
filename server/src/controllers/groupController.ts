import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Group from '../models/Group';
import User from '../models/User';
import Project from '../models/Project';
import Event, { EventType } from '../models/Event';
import { sendGroupCompleteEmail, sendGroupInviteEmail, sendGroupInviteResponseEmail, sendMentorChangeEmail, sendProposalSubmissionEmail } from '../utils/emailService';
import { publicUrlFor } from '../middleware/uploadMiddleware';
import { applyProjectStatus } from './projectController';
import { nextActiveGroupNumber } from '../utils/groupNumbering';
import { midTermEvaluationOpened, projectDetailsFrozen } from '../utils/evaluationLock';
import { supervisorCapacity } from '../utils/supervisorCapacity';

// Batch years that require single-branch groups for the given GF event. Prefers the explicit
// per-batch list; falls back to the legacy boolean (which meant "all participating batches").
const restrictedBatchesOf = (event: any): string[] => {
    if (!event) return [];
    if (Array.isArray(event.branchRestrictedBatches)) return event.branchRestrictedBatches.map(String);
    if (event.branchRestricted) return (event.participatingBatches ?? []).map(String);
    return [];
};

// The branch "clusters" configured for a given batch under this event: each cluster is a set of
// branches allowed to group together (e.g. [["CSE","DSAI"],["ECE"]]). Returns null when the batch
// has no explicit clustering, in which case the rule is pure single-branch.
const clustersForBatch = (event: any, batch?: string | null): string[][] | null => {
    if (!event || !batch) return null;
    const groups = event.branchRestrictionGroups;
    if (!Array.isArray(groups)) return null;
    const entry = groups.find((g: any) => String(g.batch) === String(batch));
    if (!entry || !Array.isArray(entry.clusters) || entry.clusters.length === 0) return null;
    const parsed = entry.clusters
        .map((c: any) => String(c).split(',').map(b => b.trim().toUpperCase()).filter(Boolean))
        .filter((c: string[]) => c.length > 0);
    return parsed.length > 0 ? parsed : null;
};

// Whether two branches may belong to the same group. Resilient to missing / inconsistently-cased
// data: returns true (allowed) unless BOTH branches are known and the clustering clearly forbids
// the mix — so a single missing/empty branch field can't lock a student out of grouping. With no
// clusters configured the rule is single-branch (only identical branches match); with clusters,
// two branches match iff they share a cluster.
const branchesCompatible = (a?: string | null, b?: string | null, clusters?: string[][] | null): boolean => {
    const na = (a ?? '').trim().toUpperCase();
    const nb = (b ?? '').trim().toUpperCase();
    if (!na || !nb) return true; // unknown on either side — can't prove a mismatch, so don't block
    if (na === nb) return true;  // same branch is always allowed
    if (!clusters || clusters.length === 0) return false; // single-branch
    return clusters.some(c => c.includes(na) && c.includes(nb));
};

// Human-readable description of the allowed grouping for an error message.
const restrictionDescription = (clusters?: string[][] | null): string =>
    clusters && clusters.length > 0
        ? `groups can only mix branches within: ${clusters.map(c => c.join('+')).join(', ')}`
        : 'groups must be single-branch';

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
            // Only enforce the branch rule if the creator's batch is one of the restricted batches.
            const restricted = restrictedBatchesOf(activeGF);
            const creatorBatch = batchOf(user);
            if (restricted.length > 0 && creatorBatch && restricted.includes(creatorBatch)) {
                const clusters = clustersForBatch(activeGF, creatorBatch);
                for (const memberId of pendingMembers) {
                    const member = await User.findById(memberId);
                    if (member && !branchesCompatible(member.branch, user.branch, clusters)) {
                        return res.status(400).json({
                            message: `This semester, batch ${creatorBatch} ${restrictionDescription(clusters)}. ${member.name} (${member.branch}) cannot join a ${user.branch} group.`
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

        // Invitees get an invite to approve. The creator gets no confirmation email — they just
        // clicked "create" and received the 201 response, so it would carry no new information.
        const [creatorUser, inviteUsers] = await Promise.all([
            User.findById(userId).select('name'),
            User.find({ _id: { $in: pendingMembers } }).select('email name')
        ]);
        for (const invitee of inviteUsers) {
            if (invitee.email) {
                sendGroupInviteEmail(invitee.email, creatorUser?.name || 'A classmate', newGroup.name || 'Unnamed Group', { batch: newGroup.targetBatch }).catch(err => console.error("Invite email failed:", err));
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
            .populate('updates.createdBy', 'name role photoUrl')
            .sort({ createdAt: -1 });

        // detailsLocked tells the dashboard and the proposal editor whether the group may still
        // change this project — it goes read-only once mid-semester evaluation opens, which the
        // update endpoint enforces server-side too.
        const midTermOpened = await midTermEvaluationOpened();
        const withLock = (p: any) => ({ ...p, detailsLocked: projectDetailsFrozen(p, midTermOpened) });

        const groupData: any = group.toObject();
        groupData.projects = allProjects.map(p => withLock(p.toObject()));
        if (groupData.project) groupData.project = withLock(groupData.project);

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
            if (groupBatch && restricted.includes(groupBatch)) {
                const clusters = clustersForBatch(activeGF, groupBatch);
                if (creator && accepter && !branchesCompatible(accepter.branch, creator.branch, clusters)) {
                    return res.status(400).json({
                        message: `This semester, batch ${groupBatch} ${restrictionDescription(clusters)}. You (${accepter.branch}) cannot join a ${creator.branch} group.`
                    });
                }
            }
        }

        group.pendingMembers = group.pendingMembers.filter(m => m.toString() !== userId) as any;
        group.members.push(userId as any);
        await group.save();

        // Only email when the LAST pending invite is accepted — one "group complete" message to
        // all members, instead of notifying every existing member on every acceptance. That old
        // per-accept blast cost O(size^2) sends per group and double-counted the creator (who is
        // already in group.members). Intermediate accepts are visible in-app on the dashboard.
        if (group.pendingMembers.length === 0) {
            const memberUsers = await User.find({ _id: { $in: group.members } }).select('email name');
            const emails = memberUsers.map(m => m.email).filter((e): e is string => !!e);
            const memberNames = memberUsers.map(m => m.name).filter((n): n is string => !!n);
            if (emails.length > 0) {
                sendGroupCompleteEmail(emails, group.name || 'Unnamed Group', { batch: group.targetBatch, memberNames }).catch(err => console.error('Group-complete email failed:', err));
            }
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
            sendGroupInviteResponseEmail([creatorUser.email], me?.name || 'A member', group.name || 'Unnamed Group', 'rejected', { batch: group.targetBatch }).catch(err => console.error('Reject email failed:', err));
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
        const clusters = branchLocked ? clustersForBatch(activeGF, groupBatch) : null;
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

            if (branchLocked && !branchesCompatible(member.branch, groupBranch, clusters)) {
                return res.status(400).json({
                    message: `This semester, batch ${groupBatch} ${restrictionDescription(clusters)}. ${member.name} (${member.branch}) cannot join a ${groupBranch} group.`
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
                sendGroupInviteEmail(invitee.email, inviter?.name || 'A classmate', group.name || 'Unnamed Group', { batch: group.targetBatch })
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

        // Block leaving once a proposal has been sent (Pending or Approved). Drafts are fine —
        // they aren't submitted, so a member may still leave while only drafts exist.
        const proposalLockMsg = 'Cannot leave the group while a project proposal is pending or accepted. Withdraw the proposal first.';
        if (group.status === 'ProposalPending' || group.status === 'Approved') {
            return res.status(403).json({ message: proposalLockMsg });
        }
        // Defensive check: also query the project directly in case group.status lags behind.
        const sentProposal = await Project.findOne({
            group: group._id,
            isArchived: { $ne: true },
            status: { $in: ['Pending', 'Approved'] }
        });
        if (sentProposal) {
            return res.status(403).json({ message: proposalLockMsg });
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
            .populate('updates.createdBy', 'name role photoUrl')
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
                populate: [
                    { path: 'faculty', select: 'name email department photoUrl' },
                    { path: 'updates.createdBy', select: 'name role photoUrl' }
                ],
                select: 'title description status isArchived tags semester attachments feedback hasNewUpdate updates faculty midTermEvaluation endTermEvaluation finalReportEvaluation studentFeedback studentEvaluations'
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

// ── Admin group-membership management (Group Directory) ─────────────────────
//
// Deliberately looser than the student-facing invite flow: an admin fixes rosters
// after the fact, so there is no Group-Formation window check, no proposal-status
// lock, and no invite round-trip — the student is added as an accepted member
// straight away. Only invariants that would corrupt data are enforced: the target
// must be an unarchived group, the user must be a student, nobody may sit in two
// active groups at once, and the 3-member cap from the Group model still holds.

const MAX_GROUP_SIZE = 3;

// Re-fetch with the same shape getAllGroups returns, so the directory can swap the
// row in place without a full refetch.
const populatedGroup = (id: any) =>
    Group.findById(id)
        .populate('members', 'name email rollNumber photoUrl branch')
        .populate('pendingMembers', 'name email rollNumber photoUrl branch')
        .populate({
            path: 'project',
            // updates.createdBy was selected but never populated, so the admin's copy of the
            // project timeline had a bare id where the author should be — every update showed
            // an empty "· " badge instead of who wrote it. Both admin group queries populate it.
            populate: [
                { path: 'faculty', select: 'name email department photoUrl' },
                { path: 'updates.createdBy', select: 'name role photoUrl' }
            ],
            select: 'title description status isArchived tags semester attachments feedback hasNewUpdate updates faculty midTermEvaluation endTermEvaluation finalReportEvaluation studentFeedback studentEvaluations'
        });

/**
 * Create a group directly, without the student flow.
 * POST /api/groups/admin  { members, targetBatch?, name? }
 *
 * Every group otherwise has to start with a student pressing "Create Group" inside an open
 * Group Formation window. That leaves the office with nowhere to go when a student is left over,
 * a formation went wrong, or the window has already closed — the only alternative was the
 * all-or-nothing Excel import.
 *
 * Like the roster endpoints below, this deliberately skips the Group Formation window, the invite
 * round-trip and the branch restriction: those are the rules an admin is stepping in to work
 * around. What it keeps are the invariants that would corrupt data if broken — students only,
 * one active group per student, and the three-member cap.
 *
 * No project is created here, and none is created for the group anywhere else on the admin's
 * behalf: the proposal is the students' to write and submit. The mentor lives on that proposal,
 * so the group has no supervisor until it arrives — adminSetGroupMentor can change it afterwards.
 */
export const adminCreateGroup = async (req: Request, res: Response) => {
    try {
        const { members, targetBatch, name } = req.body;

        if (!Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ message: 'Select at least one student.' });
        }
        const memberIds = [...new Set(members.map(String))];
        if (memberIds.length > MAX_GROUP_SIZE) {
            return res.status(400).json({
                message: `A group cannot exceed ${MAX_GROUP_SIZE} members. You selected ${memberIds.length}.`
            });
        }

        const users: any[] = [];
        for (const memberId of memberIds) {
            const user = await User.findById(memberId).select('name role rollNumber targetBatch branch');
            if (!user) return res.status(404).json({ message: `User ${memberId} not found` });
            if (user.role !== 'Student') {
                return res.status(400).json({ message: `${user.name} is not a student.` });
            }

            const otherGroup = await Group.findOne({
                $or: [{ members: memberId }, { pendingMembers: memberId }],
                isArchived: { $ne: true }
            }).select('name');
            if (otherGroup) {
                return res.status(400).json({
                    message: `${user.name} is already in group ${otherGroup.name || '(unnamed)'}. Remove them from it first.`
                });
            }

            users.push(user);
        }

        // The batch decides the group's number, so it has to be unambiguous. batchOf resolves a
        // dropper's targetBatch override ahead of their roll number, which is the whole reason a
        // mixed selection can look correct in the directory and still be wrong here.
        const batches = [...new Set(users.map(u => batchOf(u)).filter(Boolean))] as string[];
        const resolvedBatch = targetBatch ? String(targetBatch) : batches[0];

        if (!targetBatch && batches.length > 1) {
            return res.status(400).json({
                message: `Those students are in different batches (${batches.join(', ')}). Pick students from one batch, or set the batch explicitly.`
            });
        }
        if (!resolvedBatch) {
            return res.status(400).json({
                message: 'Could not work out which batch this group belongs to. Set the batch explicitly.'
            });
        }

        const assignedName = name ? String(name) : (await nextActiveGroupNumber(resolvedBatch)).toString();

        const newGroup = new Group({
            name: assignedName,
            members: memberIds,      // admin-added students are accepted outright
            pendingMembers: [],      // no invite round-trip
            // Points at a real member so the batch/branch context other reads derive from the
            // creator stays meaningful, and so the schema's member cap stays armed (it skips
            // groups with no createdBy, which is the bulk-import case, not this one).
            createdBy: memberIds[0],
            status: 'Forming',
            inviteCode: Math.random().toString(36).substring(7).toUpperCase(),
            targetBatch: resolvedBatch
        });

        await newGroup.save();

        res.status(201).json({
            message: `Group ${assignedName} created with ${memberIds.length} student(s).`,
            group: await populatedGroup(newGroup._id)
        });
    } catch (error: any) {
        console.error('Error creating group as admin:', error);
        res.status(500).json({ message: error?.message || 'Server error' });
    }
};

export const adminAddGroupMembers = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { members } = req.body;

        if (!Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ message: 'No students selected.' });
        }

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(403).json({ message: 'Archived groups are read-only.' });

        const existing = new Set(group.members.map(m => m.toString()));
        const toAdd = members.map(String).filter(m => !existing.has(m));
        if (toAdd.length === 0) {
            return res.status(400).json({ message: 'Those students are already in this group.' });
        }

        if (group.members.length + toAdd.length > MAX_GROUP_SIZE) {
            return res.status(400).json({
                message: `A group cannot exceed ${MAX_GROUP_SIZE} members. This group has ${group.members.length}.`
            });
        }

        for (const memberId of toAdd) {
            const user = await User.findById(memberId).select('name role');
            if (!user) return res.status(404).json({ message: `User ${memberId} not found` });
            if (user.role !== 'Student') {
                return res.status(400).json({ message: `${user.name} is not a student.` });
            }

            const otherGroup = await Group.findOne({
                _id: { $ne: group._id },
                $or: [{ members: memberId }, { pendingMembers: memberId }],
                isArchived: { $ne: true }
            }).select('name');
            if (otherGroup) {
                return res.status(400).json({
                    message: `${user.name} is already in group ${otherGroup.name || '(unnamed)'}. Remove them from it first.`
                });
            }
        }

        // An admin-added student is accepted outright, so drop any invite they were
        // still sitting on for this same group — otherwise they'd appear in both lists.
        group.members.push(...(toAdd as any));
        group.pendingMembers = group.pendingMembers.filter(p => !toAdd.includes(p.toString())) as any;
        await group.save();

        res.json({ message: `Added ${toAdd.length} student(s).`, group: await populatedGroup(group._id) });
    } catch (error: any) {
        console.error('Error adding group members:', error);
        res.status(500).json({ message: error?.message || 'Server error' });
    }
};

export const adminRemoveGroupMember = async (req: Request, res: Response) => {
    try {
        const { id, memberId } = req.params;

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(403).json({ message: 'Archived groups are read-only.' });

        const isMember = group.members.some(m => m.toString() === memberId);
        const isPending = group.pendingMembers.some(m => m.toString() === memberId);
        if (!isMember && !isPending) {
            return res.status(404).json({ message: 'That student is not in this group.' });
        }

        // Emptying a group would orphan its project. Deleting both is destructive and
        // not obviously what an admin removing one student intends, so make them use
        // the explicit dissolve path instead.
        if (isMember && group.members.length === 1) {
            return res.status(400).json({
                message: 'Cannot remove the last member — dissolve the group instead.'
            });
        }

        group.members = group.members.filter(m => m.toString() !== memberId) as any;
        group.pendingMembers = group.pendingMembers.filter(m => m.toString() !== memberId) as any;

        // createdBy points at a student who may no longer be in the group; re-point it at a
        // remaining member so the batch/branch context derived from it stays meaningful.
        if (group.createdBy && group.createdBy.toString() === memberId) {
            group.createdBy = group.members[0] as any;
        }

        await group.save();

        res.json({ message: 'Student removed from the group.', group: await populatedGroup(group._id) });
    } catch (error: any) {
        console.error('Error removing group member:', error);
        res.status(500).json({ message: error?.message || 'Server error' });
    }
};

/**
 * Set or reassign a group's faculty mentor from the Group Directory.
 * PUT /api/groups/:id/mentor  (multipart) { facultyId, title?, description?, tags?, status?, files[] }
 *
 * The mentor lives on the group's project, so a group that has never proposed anything has
 * nowhere to hold one. Rather than inventing a stub project to hang the mentor off, this files
 * the whole proposal the way a student would — title, description, tags, attachments, mentor —
 * so what the group ends up with is a real proposal somebody actually wrote, not a placeholder.
 * Those fields are required in that case and ignored once a project exists.
 *
 * `status` decides what filing it means: 'Pending' sends it to the named mentor's review queue
 * exactly like a student submission (the default), 'Approved' records the office's decision as
 * final. Both routes through applyProjectStatus so the group's own status can't drift from it.
 *
 * The incoming supervisor's semester-wide student cap is a hard limit either way: an assignment
 * that would push them past it is refused, and the response names the shortfall so the admin can
 * raise that supervisor's student limit (Faculty tab) or pick someone else.
 */
export const adminSetGroupMentor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { facultyId, title, description, tags, status } = req.body;
        if (!facultyId) return res.status(400).json({ message: 'Select a faculty mentor.' });

        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.isArchived) return res.status(403).json({ message: 'Archived groups are read-only.' });

        // The group's live project: its own pointer when that still resolves, else the one
        // active proposal/project it owns (the pointer can lag behind a rejection).
        let project = group.project
            ? await Project.findOne({ _id: group.project, isArchived: { $ne: true } })
            : null;
        if (!project) {
            project = await Project.findOne({
                group: group._id,
                isArchived: { $ne: true },
                status: { $in: ['Pending', 'Approved'] }
            }).sort({ createdAt: -1 });
        }

        const faculty = await User.findById(facultyId).select('name email role maxStudents');
        if (!faculty || faculty.role !== 'Faculty') {
            return res.status(400).json({ message: 'Invalid faculty selected.' });
        }

        // No project yet: the office is filing the group's proposal for them, so it needs the
        // same substance a student's would carry — the proposal form requires a title and a
        // description, and so does this. Tags and attachments may legitimately be empty.
        const filingProposal = !project;
        const filedStatus: 'Pending' | 'Approved' = status === 'Approved' ? 'Approved' : 'Pending';

        if (filingProposal) {
            if (!String(title || '').trim() || !String(description || '').trim()) {
                return res.status(400).json({
                    message: 'This group has no proposal yet. Give the project a title and a description to file one for them.',
                    needsProject: true
                });
            }
            if (status && !['Pending', 'Approved'].includes(status)) {
                return res.status(400).json({ message: "File the proposal as either 'Pending' or 'Approved'." });
            }
        } else if (project!.faculty && String(project!.faculty) === String(faculty._id)) {
            return res.status(400).json({ message: `${faculty.name} already mentors this group.` });
        }

        const load = await supervisorCapacity(faculty, group.members.length, project?._id);

        if (load.exceeded) {
            return res.status(400).json({
                message: `Mentee limit reached — ${faculty.name} already mentors ${load.currentStudents} of ${load.maxStudents} students this semester, and this group adds ${load.incoming} more. Raise their student limit in the Faculty tab (or pick another mentor) before reassigning this group.`,
                limitExceeded: true,
                limit: { facultyId: String(faculty._id), facultyName: faculty.name, ...load }
            });
        }

        // Read the outgoing mentor before the overwrite — they need telling too.
        const previousMentor = project?.faculty
            ? await User.findById(project.faculty).select('name email').lean() as any
            : null;

        const parsedTags = Array.isArray(tags)
            ? tags.map(String).map(t => t.trim()).filter(Boolean)
            : String(tags || '').split(',').map(t => t.trim()).filter(Boolean);

        if (filingProposal) {
            const files = (req as any).files || [];
            project = new Project({
                title: String(title).trim(),
                description: String(description).trim(),
                tags: parsedTags,
                attachments: files.map((f: any) => publicUrlFor(req, f)),
                group: group._id,
                faculty: faculty._id,
                status: filedStatus,
            });
            await project.save();

            // A group only earns its number when a proposal lands, so filing one on their behalf
            // has to do the same — otherwise a student-formed group stays unnumbered. Mirrors
            // createProject, and shares nextActiveGroupNumber so the two cannot drift.
            if (!group.name || isNaN(parseInt(group.name)) || group.name.startsWith('Group-')) {
                let batchYear = group.targetBatch;
                if (!batchYear && group.members.length > 0) {
                    const first = await User.findById(group.members[0]).select('rollNumber targetBatch').lean() as any;
                    if (first) batchYear = batchOf(first);
                }
                group.name = String(await nextActiveGroupNumber(batchYear));
                await group.save();
            }

            // The group's own status follows the project's, by the same mapping every other
            // status write uses.
            await applyProjectStatus(project, filedStatus);
        } else {
            project!.faculty = faculty._id as any;
            await project!.save();
        }

        // Everyone affected hears about it: the incoming mentor, the outgoing one, and the group.
        // Each gets the same facts framed for their side (see sendMentorChangeEmail).
        try {
            const memberUsers = await User.find({ _id: { $in: group.members } }).select('name email').lean();
            const memberNames = memberUsers.map((m: any) => m.name).filter(Boolean);
            const context = {
                projectTitle: project!.title,
                newMentorName: faculty.name,
                previousMentorName: previousMentor?.name,
                groupName: group.name,
                groupId: String(group._id),
                batch: group.targetBatch ? String(group.targetBatch) : undefined,
                memberNames,
            };
            const failed = (err: any) => console.error('Mentor change email failed:', err);
            const memberEmails = memberUsers.map((m: any) => m.email).filter((e: string) => !!e);

            // A proposal filed for review reaches its mentor as a proposal, not as a mentor
            // change — it is sitting in their queue waiting on a decision, and that is what the
            // submission email says. Any other case is a mentor change and reads as one.
            if (faculty.email) {
                if (filingProposal && filedStatus === 'Pending') {
                    sendProposalSubmissionEmail([faculty.email], project!.title, group.name || 'Unnamed Group', {
                        batch: group.targetBatch,
                        memberNames,
                        description: project!.description,
                        tags: parsedTags.length > 0 ? parsedTags : undefined
                    }).catch(failed);
                } else {
                    sendMentorChangeEmail([faculty.email], 'new-mentor', context).catch(failed);
                }
            }
            if (previousMentor?.email) {
                sendMentorChangeEmail([previousMentor.email], 'previous-mentor', context).catch(failed);
            }
            if (memberEmails.length > 0) {
                sendMentorChangeEmail(memberEmails, 'members', context).catch(failed);
            }
        } catch (emailErr) {
            // The reassignment already succeeded; a notification failure must not undo it.
            console.error('Failed to prepare mentor change emails', emailErr);
        }

        res.json({
            message: filingProposal
                ? (filedStatus === 'Approved'
                    ? `Proposal filed and approved with ${faculty.name} as mentor.`
                    : `Proposal filed and sent to ${faculty.name} for review.`)
                : `Mentor changed to ${faculty.name}.`,
            group: await populatedGroup(group._id)
        });
    } catch (error: any) {
        console.error('Error changing group mentor:', error);
        res.status(500).json({ message: error?.message || 'Server error' });
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
