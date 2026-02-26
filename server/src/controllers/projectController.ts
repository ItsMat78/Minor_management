import { Request, Response } from 'express';
import Project from '../models/Project';
import Group from '../models/Group';
import User, { UserRole } from '../models/User';
import Panel from '../models/Panel';

// ... (imports)

export const createProject = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        console.log(`[createProject] User ${userId} submitting project`);
        const { title, description, tags, facultyId, attachments, status = 'Pending', semester } = req.body;
        console.log(`[createProject] Payload:`, { title, facultyId, status, semester });

        // Check if user is in a group
        const group = await Group.findOne({ members: userId });
        if (!group) {
            console.log(`[createProject] User ${userId} not in a group`);
            return res.status(400).json({ message: 'You must be in a group to propose a project' });
        }
        console.log(`[createProject] Group found: ${group._id}, status: ${group.status}`);

        // Check if group already has a project pending or approved
        // Allow multiple drafts, but only one Pending/Approved
        if (status !== 'Draft') {
            const existingApproved = await Project.findOne({
                group: group._id,
                status: 'Approved'
            });
            if (existingApproved) {
                console.log(`[createProject] Group already has an approved project: ${existingApproved._id}`);
                return res.status(400).json({ message: 'Group already has an approved project' });
            }
            // Allow multiple Pending projects
        }

        // Validate faculty if provided
        let faculty = null;
        if (facultyId) {
            faculty = await User.findById(facultyId);
            if (!faculty || faculty.role !== UserRole.FACULTY) {
                console.log(`[createProject] Invalid faculty: ${facultyId}`);
                return res.status(400).json({ message: 'Invalid faculty selected' });
            }
        }

        const newProject = new Project({
            title,
            description,
            tags,
            faculty: facultyId || null,
            group: group._id,
            attachments,
            status: status,
            semester
        });

        await newProject.save();
        console.log(`[createProject] Project saved: ${newProject._id}`);

        // Update group status if submitting
        if (status === 'Pending') {
            group.status = 'ProposalPending';
            group.project = newProject._id;
            await group.save();
        }

        res.status(201).json(newProject);
    } catch (error) {
        console.error('[createProject] Error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getFacultyProjects = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const projects = await Project.find({ faculty: userId })
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber branch' }
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

        if (status === 'Approved' && project.status !== 'Approved') {
            const facultyId = project.faculty;
            if (facultyId) {
                const facultyUser = await User.findById(facultyId);
                const projectGroup = await Group.findById(project.group).populate('members');

                if (facultyUser && projectGroup && projectGroup.members.length > 0) {
                    // Determine Batch Year from first member
                    const firstMember: any = projectGroup.members[0];
                    const batchYearPrefix = firstMember.rollNumber ? firstMember.rollNumber.substring(0, 2) : null;

                    if (batchYearPrefix) {
                        const batchYear = parseInt('20' + batchYearPrefix);

                        // Get Limits
                        let maxStudents = facultyUser.maxStudents || 21;
                        let maxGroups = facultyUser.maxGroups || 7;

                        const batchConfig = (facultyUser.batchConfigs || []).find((c: any) => c.batchYear === batchYear);
                        if (batchConfig) {
                            maxStudents = batchConfig.maxStudents;
                            maxGroups = batchConfig.maxGroups;
                        }

                        // Calculate Current Load for this Batch
                        // Fetch all approved projects for this faculty
                        const approvedProjects = await Project.find({
                            faculty: facultyId,
                            status: 'Approved',
                            _id: { $ne: project._id } // Exclude current one
                        }).populate({
                            path: 'group',
                            populate: { path: 'members' }
                        });

                        let currentGroupsCount = 0;
                        let currentStudentsCount = 0;

                        approvedProjects.forEach((p: any) => {
                            if (p.group && p.group.members && p.group.members.length > 0) {
                                const m: any = p.group.members[0];
                                if (m.rollNumber && m.rollNumber.startsWith(batchYearPrefix)) {
                                    currentGroupsCount++;
                                    currentStudentsCount += p.group.members.length;
                                }
                            }
                        });

                        // Check Limits
                        if (currentGroupsCount + 1 > maxGroups) {
                            return res.status(400).json({
                                message: `Faculty limit reached: Batch ${batchYear} allows max ${maxGroups} groups. Current: ${currentGroupsCount}.`
                            });
                        }

                        if (currentStudentsCount + projectGroup.members.length > maxStudents) {
                            return res.status(400).json({
                                message: `Faculty limit reached: Batch ${batchYear} allows max ${maxStudents} students. Current: ${currentStudentsCount}.`
                            });
                        }
                    }
                }
            }
        }

        project.status = status;
        if (feedback) project.feedback = feedback;
        await project.save();

        // Update Group status
        const group = await Group.findById(project.group);
        if (group) {
            if (status === 'Approved') {
                group.status = 'Approved';

                // Archive all other proposals for this group
                await Project.updateMany(
                    {
                        group: project.group,
                        _id: { $ne: project._id },
                        status: { $in: ['Pending', 'Draft', 'Rejected'] }
                    },
                    { status: 'Archived' }
                );

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

        // Verify user is member of the project's group OR is the assigned faculty
        const group = await Group.findById(project.group);
        const isMember = group && group.members.map(m => m.toString()).includes(userId);
        const isFaculty = project.faculty?.toString() === userId;

        if (!isMember && !isFaculty) {
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
        if (isFaculty) {
            project.hasNewUpdate = false;
        } else {
            project.hasNewUpdate = true;
        }
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

export const updateProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { title, description, tags, facultyId, status, links, semester } = req.body;
        const files = (req as any).files;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Verify membership
        const group = await Group.findById(project.group);
        if (!group || !group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to update this project' });
        }

        // Only allow edits if Draft, Pending, or Rejected
        if (!['Draft', 'Pending', 'Rejected'].includes(project.status)) {
            return res.status(400).json({ message: `Cannot edit project in ${project.status} status` });
        }

        // Process files
        let fileUrls: string[] = [];
        if (req.body.existingAttachments) {
            try {
                fileUrls = JSON.parse(req.body.existingAttachments);
                if (!Array.isArray(fileUrls)) fileUrls = project.attachments || [];
            } catch (e) {
                fileUrls = project.attachments || [];
            }
        } else {
            fileUrls = project.attachments || [];
        }

        if (files && files.length > 0) {
            const newUrls = files.map((f: any) => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`);
            fileUrls = [...fileUrls, ...newUrls];
        }

        // Update fields
        if (title) project.title = title;
        if (description) project.description = description;
        if (tags) {
            project.tags = Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim());
        }
        if (facultyId) project.faculty = facultyId;
        if (semester) project.semester = semester;

        // Handle links (from text input, comma separated)
        if (links) {
            const linkUrls = links.split(',').map((l: string) => l.trim()).filter(Boolean);
            // Merge with fileUrls or keep separate? Model says attachments is string[]. 
            // Let's assume attachments includes both files and links for now or just append links.
            // If the user replaces all links, we might need a way to clear them.
            // For simplify: Append links to fileUrls if that's how it's used, OR keeps links separate?
            // Project model has "attachments: string[]".
            fileUrls = [...fileUrls, ...linkUrls];
        } else if (links === '') {
            // If explicitly sent empty, maybe clear links? 
            // Current logic appends. Let's stick to appending or replacing?
            // Usually edit replaces strings.
        }

        project.attachments = fileUrls;

        // If status changes (e.g. back to Pending from Draft)
        if (status && status !== project.status) {
            if (status === 'Pending') {
                project.status = 'Pending';
                group.status = 'ProposalPending';
                await group.save();
            } else if (status === 'Draft') {
                project.status = 'Draft';
            }
        }

        // If it was Rejected, and now being updated, set to Pending?
        if (project.status === 'Rejected') {
            project.status = 'Pending';
            project.feedback = undefined; // Clear feedback
            group.status = 'ProposalPending';
            await group.save();
        }

        await project.save();
        res.json(project);
    } catch (error) {
        console.error("Update project error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Verify membership in the group that owns the project
        const group = await Group.findById(project.group);
        if (!group || !group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to delete this project' });
        }

        if (project.status !== 'Pending' && project.status !== 'Draft') {
            return res.status(400).json({ message: 'Cannot delete a project that is not Pending or Draft' });
        }

        await Project.findByIdAndDelete(id);

        if (group.project && group.project.toString() === id) {
            group.status = 'Forming';
            group.project = undefined;

            // Check if there are other pending projects to promote or just leave as forming?
            // For now, if active project is deleted, reset to forming.
            // But if we have multiple, maybe we should pick another one?
            // Let's just reset to Forming. The user can see other proposals in the list.
            const otherProject = await Project.findOne({ group: group._id, status: { $in: ['Pending', 'Draft'] } }).sort({ createdAt: -1 });
            if (otherProject) {
                group.project = otherProject._id;
                group.status = otherProject.status === 'Pending' ? 'ProposalPending' : 'Forming';
            }
        }
        await group.save();

        res.json({ message: 'Project proposal deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const submitEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { type, marks, remarks, guide, panel } = req.body;
        const userId = (req as any).user.id;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Authorization: Only assigned faculty or Admin
        let isAuthorized = String(project.faculty) === userId || (req as any).user.role === 'Admin';

        if (!isAuthorized && project.faculty) {
            const panel = await Panel.findOne({ faculty: { $all: [project.faculty, userId] } });
            if (panel) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to evaluate this project' });
        }

        const evaluationData: any = {
            marks,
            remarks,
            gradedBy: userId,
            date: new Date(),
            guide,
            panel
        };

        if (type === 'mid-term') {
            project.midTermEvaluation = evaluationData;
        } else if (type === 'end-term') {
            project.endTermEvaluation = evaluationData;
        } else if (type === 'final-report') {
            project.finalReportEvaluation = evaluationData;
        } else {
            return res.status(400).json({ message: 'Invalid evaluation type' });
        }

        // Mark as modified if necessary
        project.markModified('midTermEvaluation');
        project.markModified('endTermEvaluation');
        project.markModified('finalReportEvaluation');

        const savedProject = await project.save();
        res.json(savedProject);
    } catch (error) {
        console.error("Evaluation error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};
