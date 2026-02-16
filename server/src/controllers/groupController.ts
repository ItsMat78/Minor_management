import { Request, Response } from 'express';
import Group from '../models/Group';
import User from '../models/User';

// Create a group
export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { name, members } = req.body; // Expecting array of member IDs

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

        const newGroup = new Group({
            name: name || `Group-${Date.now()}`,
            members: groupMembers,
            status: 'Forming',
            inviteCode: Math.random().toString(36).substring(7).toUpperCase()
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
            .populate('project');

        if (!group) return res.status(404).json({ message: 'No group found' });

        res.json(group);
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
        // Find groups where the project has the faculty assigned
        // This is a bit complex because faculty is on Project, not Group directly in current schema?
        // Let's check Project schema. Project has 'group' and 'faculty'.
        // So we find Projects where faculty = userId, then populate the group.

        // Wait, the user asked for "My Mentees" showing all groups.
        // Assuming "Mentees" means groups whose project is supervised by this faculty.

        const Project = require('../models/Project').default;

        const projects = await Project.find({ faculty: userId })
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber branch' }
            });

        const groups = projects.map((p: any) => ({
            ...p.group.toObject(),
            project: {
                title: p.title,
                status: p.status,
                _id: p._id,
                hasNewUpdate: p.hasNewUpdate,
                updates: p.updates // Optional: include updates content if needed immediately
            }
        }));

        res.json(groups);
    } catch (error) {
        console.error("Error fetching mentees:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};
