import { Request, Response } from 'express';
import Project from '../models/Project';
import Group from '../models/Group';
import User, { UserRole } from '../models/User';

export const createProject = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { title, description, tags, facultyId, attachments } = req.body;

        // Check if user is in a group
        const group = await Group.findOne({ members: userId });
        if (!group) return res.status(400).json({ message: 'You must be in a group to propose a project' });

        // Check if group already has a project pending or approved
        const existingProject = await Project.findOne({ group: group._id, status: { $in: ['Pending', 'Approved'] } });
        if (existingProject) return res.status(400).json({ message: 'Group already has a pending or approved project' });

        // Validate faculty
        const faculty = await User.findById(facultyId);
        if (!faculty || faculty.role !== UserRole.FACULTY) {
            return res.status(400).json({ message: 'Invalid faculty selected' });
        }

        const newProject = new Project({
            title,
            description,
            tags,
            faculty: facultyId,
            group: group._id,
            attachments,
            status: 'Pending'
        });

        await newProject.save();

        // Update group status
        group.status = 'ProposalPending';
        group.project = newProject._id;
        await group.save();

        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getProjects = async (req: Request, res: Response) => {
    try {
        const projects = await Project.find().populate('group').populate('faculty', 'name');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
