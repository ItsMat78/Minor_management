import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Group from '../models/Group';
import User from '../models/User';
import Project from '../models/Project';
import { sendGroupCreationEmail, sendGroupInviteEmail, sendGroupInviteResponseEmail } from '../utils/emailService';


export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { name, members, targetBatch } = req.body; // Expecting array of member IDs

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
        if (members && Array.isArray(members) && members.length > 0) {
            if (members.length + 1 > 3) {
                return res.status(400).json({ message: 'Group cannot exceed 3 members' });
            }

            for (const memberId of members) {
                if (memberId === userId) continue;

                const member = await User.findById(memberId);
                if (!member) return res.status(404).json({ message: `User ${memberId} not found` });
                if (member.role !== 'Student') return res.status(400).json({ message: `User ${member.name} is not a student` });

                const memberGroup = await Group.findOne({
                    $or: [{ members: memberId }, { pendingMembers: memberId }],
                    isArchived: { $ne: true }
                });
                if (memberGroup) return res.status(400).json({ message: `User ${member.name} is already in a group or has a pending invite` });

                pendingMembers.push(memberId);
            }
        }

        let assignedName = name;
        if (!assignedName) {
            // Determine the batch year for the new group
            let batchYear = targetBatch;
            if (!batchYear && user.rollNumber) {
                batchYear = '20' + user.rollNumber.substring(0, 2);
            }

            // Find all groups to determine the next available number for this batch
            const allGroups = await Group.find().populate('members', 'rollNumber');
            const usedNumbers = new Set<number>();

            allGroups.forEach(g => {
                let gb = g.targetBatch;
                if (!gb && g.members && g.members.length > 0 && (g.members[0] as any).rollNumber) {
                    gb = '20' + (g.members[0] as any).rollNumber.substring(0, 2);
                }
                if (gb === batchYear && g.name) {
                    // Try to extract a leading number from the name if possible, or parse it directly
                    const num = parseInt(g.name, 10);
                    if (!isNaN(num)) usedNumbers.add(num);
                }
            });

            let nextNum = 1;
            while (usedNumbers.has(nextNum)) {
                nextNum++;
            }
            assignedName = nextNum.toString();
        }

        const newGroup = new Group({
            name: assignedName,
            members: [userId], // Creator auto-accepts
            pendingMembers,
            createdBy: userId,
            status: 'Forming',
            inviteCode: Math.random().toString(36).substring(7).toUpperCase(),
            targetBatch
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
        const group = await Group.findOne({ members: userId })
            .sort({ isArchived: 1, createdAt: -1 })
            .populate('members', 'name email role branch rollNumber')
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
            .populate('members', 'name email rollNumber branch')
            .populate('pendingMembers', 'name email rollNumber branch')
            .populate('createdBy', 'name email rollNumber');
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

        // Remove user from group
        group.members = group.members.filter(m => m.toString() !== userId);

        // If group becomes empty, dissolve it
        if (group.members.length === 0) {
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
        const projects = await Project.find({ faculty: userId, status: 'Approved' })
            .populate('faculty', 'name department email photoUrl')
            .populate('updates.createdBy', 'name role')
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber branch' }
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
            .populate('members', 'name email rollNumber branch')
            .populate('pendingMembers', 'name email rollNumber branch')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email department photoUrl' },
                select: 'title description status tags semester attachments feedback hasNewUpdate updates faculty midTermEvaluation endTermEvaluation finalReportEvaluation studentFeedback'
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

        const allGroups = await Group.find().populate('members', 'rollNumber');
        const usedNumbers = new Set<number>();

        allGroups.forEach(g => {
            let gb = g.targetBatch;
            if (!gb && g.members && g.members.length > 0 && (g.members[0] as any).rollNumber) {
                gb = '20' + (g.members[0] as any).rollNumber.substring(0, 2);
            }
            if (gb === batch && g.name) {
                const num = parseInt(g.name, 10);
                if (!isNaN(num)) usedNumbers.add(num);
            }
        });

        let nextNum = 1;
        while (usedNumbers.has(nextNum)) {
            nextNum++;
        }
        res.json({ nextNumber: nextNum });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
