import { Request, Response } from 'express';
import Group from '../models/Group';
import User from '../models/User';
import Project from '../models/Project';

// Create a group
export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { name, members, targetBatch } = req.body; // Expecting array of member IDs

        // Check if user is already in a group
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const existingGroup = await Group.findOne({ members: userId });
        if (existingGroup) return res.status(400).json({ message: 'You are already in a group' });

        // Validate other members
        let groupMembers = [userId];
        if (members && Array.isArray(members) && members.length > 0) {
            // Check max size (creator + added members <= 3)
            if (members.length + 1 > 3) {
                return res.status(400).json({ message: 'Group cannot exceed 3 members' });
            }

            // Verify each member exists and is not in a group
            for (const memberId of members) {
                if (memberId === userId) continue; // Skip if self included

                const member = await User.findById(memberId);
                if (!member) return res.status(404).json({ message: `User ${memberId} not found` });
                if (member.role !== 'Student') return res.status(400).json({ message: `User ${member.name} is not a student` });

                const memberGroup = await Group.findOne({ members: memberId });
                if (memberGroup) return res.status(400).json({ message: `User ${member.name} is already in a group` });

                groupMembers.push(memberId);
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
            members: groupMembers,
            status: 'Forming',
            inviteCode: Math.random().toString(36).substring(7).toUpperCase(),
            targetBatch
        });

        await newGroup.save();

        // Update user status if needed (optional based on schema design)

        res.status(201).json(newGroup);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getMyGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const group = await Group.findOne({ members: userId })
            .populate('members', 'name email role branch rollNumber')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name department email' }
            });

        if (!group) return res.status(404).json({ message: 'No group found' });

        // Fetch all projects for this group to support multiple proposals
        const allProjects = await Project.find({ group: group._id })
            .populate('faculty', 'name department email')
            .sort({ createdAt: -1 });

        const groupData = group.toObject();
        (groupData as any).projects = allProjects;

        res.json(groupData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

import bcrypt from 'bcryptjs';

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

        const group = await Group.findOne({ members: userId });
        if (!group) return res.status(404).json({ message: 'Not in a group' });

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
            .populate('faculty', 'name department email')
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
                finalReportEvaluation: p.finalReportEvaluation
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
        const groups = await Group.find()
            .populate('members', 'name email rollNumber branch')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email department' },
                select: 'title description status tags semester attachments feedback hasNewUpdate updates faculty midTermEvaluation endTermEvaluation finalReportEvaluation'
            })
            .sort({ createdAt: -1 });

        console.log("getAllGroups fetched groups with targetBatch:", groups.filter(g => g.targetBatch).length);

        res.json(groups);
    } catch (error) {
        console.error("Error fetching all groups:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { targetBatch } = req.body;

        const group = await Group.findByIdAndUpdate(id, { targetBatch }, { new: true });
        if (!group) return res.status(404).json({ message: 'Group not found' });

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
