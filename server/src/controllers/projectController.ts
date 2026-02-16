import { Request, Response } from 'express';
import Project from '../models/Project';
import Group from '../models/Group';
import User, { UserRole } from '../models/User';

// ... (imports)

export const createProject = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { title, description, tags, facultyId, attachments, status = 'Pending' } = req.body;

        // Check if user is in a group
        const group = await Group.findOne({ members: userId });
        if (!group) return res.status(400).json({ message: 'You must be in a group to propose a project' });

        // Check if group already has a project pending or approved
        // Allow multiple drafts, but only one Pending/Approved
        if (status !== 'Draft') {
            const existingProject = await Project.findOne({
                group: group._id,
                status: { $in: ['Pending', 'Approved'] }
            });
            if (existingProject) return res.status(400).json({ message: 'Group already has a pending or approved project' });
        }

        // Validate faculty if provided
        let faculty = null;
        if (facultyId) {
            faculty = await User.findById(facultyId);
            if (!faculty || faculty.role !== UserRole.FACULTY) {
                return res.status(400).json({ message: 'Invalid faculty selected' });
            }
        } else if (status === 'Pending') {
            // Submitted but no faculty selected? Maybe allowed if Admin assigns? 
            // For now, let's allow it but warn or require it for approval?
            // The frontend "Decide Later" sets facultyId to ""
        }

        const newProject = new Project({
            title,
            description,
            tags,
            faculty: facultyId || null,
            group: group._id,
            attachments,
            status: status
        });

        await newProject.save();

        // Update group status if submitting
        if (status === 'Pending') {
            group.status = 'ProposalPending';
            group.project = newProject._id;
            await group.save();
        }

        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getFacultyProjects = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const projects = await Project.find({ faculty: userId })
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber' }
            })
            .sort({ hasNewUpdate: -1, createdAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateProjectStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, feedback } = req.body; // Approved, Rejected

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Verify faculty (security check)
        const userId = (req as any).user.id;
        if (project.faculty?.toString() !== userId && (req as any).user.role !== 'Admin') {
            return res.status(403).json({ message: 'Not authorized to update this project' });
        }

        project.status = status;
        if (feedback) project.feedback = feedback;
        await project.save();

        // Update Group status
        const group = await Group.findById(project.group);
        if (group) {
            if (status === 'Approved') {
                group.status = 'Approved';
            } else if (status === 'Rejected') {
                group.status = 'Forming'; // Reset to Forming? Or allow re-proposal?
                // If rejected, maybe back to 'Forming' or keep 'ProposalPending' but allow new?
                // Let's set to 'Forming' so they can try again or edit.
            }
            await group.save();
        }

        res.json(project);
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

export const addUpdate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, content, links } = req.body;
        const userId = (req as any).user.id;
        const files = (req as any).files;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Verify user is member of the project's group
        const group = await Group.findById(project.group);
        if (!group || !group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to update this project' });
        }

        let fileUrls: string[] = [];
        if (files && files.length > 0) {
            fileUrls = files.map((f: any) => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`);
        }

        let linkUrls: string[] = [];
        if (links) {
            if (Array.isArray(links)) linkUrls = links;
            else if (typeof links === 'string') {
                // If it's a comma separated string, split it.
                // FormData usually sends arrays as duplicate keys or just strings.
                // Our frontend sends comma separated string for now.
                linkUrls = links.split(',').map((l: string) => l.trim()).filter(Boolean);
            }
        }

        project.updates.push({
            title,
            content,
            date: new Date(),
            attachments: fileUrls,
            links: linkUrls
        });
        project.hasNewUpdate = true; // Flag for faculty
        await project.save();

        res.json(project);
    } catch (error) {
        console.error("Add update error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const markUpdatesRead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Verify faculty
        if (project.faculty?.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        project.hasNewUpdate = false;
        await project.save();

        res.json({ message: 'Updates marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
