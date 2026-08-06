import { Request, Response } from 'express';
import Project from '../models/Project';
import Group from '../models/Group';
import User, { UserRole } from '../models/User';
import mongoose from 'mongoose';
import { sendProposalStatusEmail, sendProposalSubmissionEmail, sendProjectUpdateEmail, sendProjectDetailsChangedEmail } from '../utils/emailService';
import { publicUrlFor, deleteFileByUrl } from '../middleware/uploadMiddleware';
import Panel from '../models/Panel';
import Event, { EventType } from '../models/Event';
import { nextActiveGroupNumber } from '../utils/groupNumbering';
import { midTermEvaluationOpened, projectDetailsFrozen, DETAILS_FROZEN_MESSAGE } from '../utils/evaluationLock';
import { supervisorCapacity, mentorFullMessage } from '../utils/supervisorCapacity';

// ... (imports)

export const createProject = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { title, description, tags, facultyId, attachments, status = 'Pending', semester } = req.body;

        // Check if user is in an active group. Must exclude archived groups: a student
        // who participated in a past session is still a member of that (now archived)
        // group, and matching it here would surface last session's proposal.
        const group = await Group.findOne({ members: userId, isArchived: { $ne: true } });
        if (!group) {
            return res.status(400).json({ message: 'You must be in a group to propose a project' });
        }
        if (group.pendingMembers && group.pendingMembers.length > 0) {
            return res.status(400).json({ message: 'All invited members must accept before submitting a proposal.' });
        }

        // Check if group already has an active project (Pending or Approved)
        // Allow multiple drafts, but only one Pending/Approved at a time
        if (status !== 'Draft') {
            const existingActive = await Project.findOne({
                group: group._id,
                isArchived: { $ne: true },
                status: { $in: ['Pending', 'Approved'] }
            });
            if (existingActive) {
                return res.status(400).json({ message: 'Your group already has an active proposal. Withdraw or wait for it to be rejected before sending another.' });
            }
        }

        // A submitted proposal must name a mentor. 'Decide Later' is valid only for a Draft — a
        // mentor-less Pending never reaches any faculty's review queue (that queue is keyed on
        // faculty), so it would sit in limbo, reviewable by no one and blocking a fresh proposal.
        if (status !== 'Draft' && !facultyId) {
            return res.status(400).json({ message: 'Select a faculty mentor before submitting. Save as a draft to decide later.' });
        }

        // Validate faculty if provided
        let faculty = null;
        if (facultyId) {
            faculty = await User.findById(facultyId);
            if (!faculty || faculty.role !== UserRole.FACULTY) {
                return res.status(400).json({ message: 'Invalid faculty selected' });
            }

            // Don't let a group submit to a mentor who has no room for them. Approval would be
            // refused by the same ceiling (see updateProjectStatus), but that refusal is shown to
            // the mentor and leaves the proposal sitting at Pending — the group would never learn
            // why. Checked only for a real submission: a Draft is private work in progress, and a
            // group deciding later shouldn't be stopped from saving it.
            if (status === 'Pending') {
                const load = await supervisorCapacity(faculty, group.members.length);
                if (load.exceeded) {
                    return res.status(400).json({
                        message: mentorFullMessage(faculty.name, load),
                        limitExceeded: true,
                        limit: { facultyId: String(faculty._id), facultyName: faculty.name, ...load }
                    });
                }
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

        // Auto decide group number upon project submission if it hasn't been assigned a numeric ID yet.
        // Uses the shared per-batch, active-only numbering so it can't drift from createGroup
        // (a plain max+1 over all groups would count archived past-session groups → wrong number).
        if (!group.name || isNaN(parseInt(group.name)) || group.name.startsWith('Group-')) {
            let batchYear = group.targetBatch;
            if (!batchYear && group.members.length > 0) {
                const firstMember = await User.findById(group.members[0]).select('rollNumber').lean() as any;
                if (firstMember?.rollNumber) batchYear = '20' + firstMember.rollNumber.substring(0, 2);
            }
            group.name = String(await nextActiveGroupNumber(batchYear));
        }

        // Update group status if submitting
        if (status === 'Pending') {
            group.status = 'ProposalPending';
            group.project = newProject._id;
            
            // Send email to faculty
            if (faculty) {
                const facUser = await User.findById(faculty).select('email');
                if (facUser && facUser.email) {
                    const memberUsers = await User.find({ _id: { $in: group.members } }).select('name');
                    const memberNames = memberUsers.map(m => m.name).filter((n): n is string => !!n);
                    sendProposalSubmissionEmail([facUser.email], title, group.name || 'Unnamed Group', {
                        batch: group.targetBatch,
                        memberNames,
                        description,
                        tags: Array.isArray(tags) ? tags : undefined
                    }).catch(err => console.error("Email failed:", err));
                }
            }
        }
        await group.save();

        res.status(201).json(newProject);
    } catch (error) {
        console.error('[createProject] Error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getFacultyProjects = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        // Exclude Draft: a draft is a group's unsent, private work-in-progress. It only carries a
        // faculty because the student picked a mentor on step 2 before saving — it was never
        // submitted for review, so it must not surface in the mentor's proposal queue.
        const projects = await Project.find({ faculty: userId, isArchived: { $ne: true }, status: { $ne: 'Draft' } })
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber branch photoUrl' }
            })
            .populate('updates.createdBy', 'name role photoUrl')
            .sort({ hasNewUpdate: -1, createdAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Admin view of every active (non-archived) proposal, with the faculty and the full
// member list populated so the admin can review and decide exactly like the faculty does.
export const getAdminProposals = async (req: Request, res: Response) => {
    try {
        if ((req as any).user.role !== UserRole.ADMIN) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // The sidebar badge only needs the count — skip the full populated payload for it.
        // Count only Pending: the badge signals proposals awaiting a decision. Drafts are unsent
        // and need no admin action, so counting them overstated the queue. (The full list below
        // still returns drafts for oversight.)
        if (req.query.countOnly) {
            const pending = await Project.countDocuments({
                isArchived: { $ne: true },
                status: 'Pending'
            });
            return res.json({ pending });
        }

        const projects = await Project.find({ isArchived: { $ne: true } })
            .populate('faculty', 'name email department photoUrl')
            .populate({
                path: 'group',
                populate: { path: 'members', select: 'name email rollNumber branch photoUrl' }
            })
            .sort({ createdAt: -1 });

        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateProjectStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, feedback } = req.body; // Approved, Rejected

        // This endpoint decides a submitted proposal — the only valid outcomes are Approved or
        // Rejected. Reject anything else so a stray/crafted payload can't push a project into an
        // arbitrary state.
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be Approved or Rejected' });
        }

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot update status of an archived project' });
        // A draft was never submitted, so there is nothing to approve or reject. This is the hard
        // guard behind the UI filters: even if a draft leaks into a review list, it can't be decided.
        if (project.status === 'Draft') {
            return res.status(400).json({ message: 'This proposal is still a draft and has not been submitted for review' });
        }

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
                    // A supervisor's capacity is a SEMESTER-WIDE total across every batch they
                    // mentor, so the load is counted over all their approved projects rather than
                    // only those belonging to this group's batch. This also means the check does
                    // not depend on parsing a batch year off a roll number — it previously skipped
                    // enforcement entirely for a member with a missing roll number.
                    // This is the authoritative check: the submit-time one in createProject only
                    // counts approved load, so several groups can queue past a mentor's remaining
                    // places and the overflow is caught here.
                    const load = await supervisorCapacity(facultyUser, projectGroup.members.length, project._id);

                    if (load.exceeded) {
                        return res.status(400).json({
                            message: `Supervisor limit reached: ${facultyUser.name} would be mentoring ${load.currentStudents + load.incoming} students this semester, over their limit of ${load.maxStudents}. Ask the admin to raise their student limit, or reject this proposal so the group can pick another mentor.`,
                            limitExceeded: true,
                            limit: { facultyId: String(facultyUser._id), facultyName: facultyUser.name, ...load }
                        });
                    }
                }
            }
        }

        await applyProjectStatus(project, status, feedback);

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

/**
 * Write a project's status and bring its group into line with it.
 *
 * Group.status and Project.status are separate fields that must agree, and getting them out of
 * step is how a group ends up stuck — showing "proposal pending" against a project nobody is
 * reviewing, or holding a pointer to a proposal that no longer exists. The faculty decision path
 * (updateProjectStatus, Approved/Rejected only), the admin override (adminSetProjectStatus, all
 * four) and the office filing a proposal for a group (adminSetGroupMentor) all route through here
 * so the mapping cannot drift between them.
 *
 *   Approved  → group Approved, pointed at this project, competing proposals destroyed
 *   Pending   → group ProposalPending, pointed at this project
 *   Rejected  → group Forming, pointer dropped if it named this project
 *   Draft     → group Forming, pointer dropped if it named this project
 *
 * Students are emailed for the two decisions they are waiting on. An admin walking a status
 * backwards is a correction, not a decision, so it sends nothing — the admin tells them.
 */
export const applyProjectStatus = async (
    project: any,
    status: 'Draft' | 'Pending' | 'Approved' | 'Rejected',
    feedback?: string
) => {
    project.status = status;
    if (feedback) project.feedback = feedback;
    await project.save();

    // Send email notification to students
    try {
        const groupForEmail = await Group.findById(project.group);
        if (groupForEmail && groupForEmail.members.length > 0) {
            const memberUsers = await User.find({ _id: { $in: groupForEmail.members } }).select('email');
            const emails = memberUsers.map(u => u.email).filter(e => e);
            if (emails.length > 0 && (status === 'Approved' || status === 'Rejected')) {
                const facultyDoc = project.faculty ? await User.findById(project.faculty).select('name') : null;
                sendProposalStatusEmail(emails, project.title, status as any, feedback, {
                    facultyName: facultyDoc?.name,
                    projectId: String(project._id)
                }).catch(err => console.error("Email failed:", err));
            }
        }
    } catch (emailErr) {
        console.error("Failed to prepare proposal status email", emailErr);
    }

    // Update Group status
    const group = await Group.findById(project.group);
    if (group) {
        if (status === 'Approved') {
            group.status = 'Approved';
            group.project = project._id; // Ensure group points to the approved project

            // Delete files for competing proposals before removing them
            const competing = await Project.find({
                group: project.group,
                _id: { $ne: project._id },
                status: { $in: ['Draft', 'Pending', 'Rejected'] }
            }).select('attachments');
            competing.forEach(p => (p.attachments || []).forEach(url => deleteFileByUrl(url)));

            // Permanently delete all other proposals for this group
            await Project.deleteMany(
                {
                    group: project.group,
                    _id: { $ne: project._id },
                    status: { $in: ['Draft', 'Pending', 'Rejected'] }
                }
            );

        } else if (status === 'Pending') {
            // Back under review: the group is waiting on a decision again, and the project they
            // are waiting on is this one.
            group.status = 'ProposalPending';
            group.project = project._id;
        } else {
            // Rejected or returned to Draft. Reset to Forming so the group can resubmit or edit.
            // Also drop the pointer to the dead proposal if the group still references it —
            // otherwise stale UI would treat it (and its old faculty) as the group's current project.
            group.status = 'Forming';
            if (group.project && group.project.toString() === project._id.toString()) {
                group.project = undefined;
            }
        }
        await group.save();
    }
};

/** Evaluation work that would be stranded by moving a project out of Approved. */
const gradedArtefacts = (project: any): string[] => {
    const graded: string[] = [];
    if (project.midTermEvaluation) graded.push('a mid-term evaluation');
    if (project.endTermEvaluation) graded.push('an end-term evaluation');
    if (project.finalReportEvaluation) graded.push('a final report evaluation');
    if (project.studentEvaluations?.length) graded.push(`${project.studentEvaluations.length} per-student evaluation(s)`);
    return graded;
};

/**
 * The admin walking a project's status anywhere, forwards or backwards.
 * PUT /api/projects/:id/admin-status  { status, feedback?, confirm? }
 *
 * updateProjectStatus deliberately accepts only Approved and Rejected — it decides a submitted
 * proposal, and anything else there would be a crafted payload. But an approval made in error, or
 * a group that has to go back and re-propose, had no way back short of editing the database. This
 * is that way back, and it is admin-only.
 *
 * Two things it does NOT soften:
 *  - Promoting to Approved still runs the authoritative capacity check, so the override cannot be
 *    used to overbook a supervisor.
 *  - Moving a graded project out of Approved needs `confirm: true`, because the evaluations do not
 *    come back with it.
 *
 * Note for callers: approval destroys the group's competing proposals (see applyProjectStatus).
 * Reverting an approval cannot restore them — they are gone. The client says so before sending.
 */
export const adminSetProjectStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, feedback, confirm } = req.body;

        if ((req as any).user.role !== UserRole.ADMIN) {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        if (!['Draft', 'Pending', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be Draft, Pending, Approved or Rejected' });
        }

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot update status of an archived project' });
        if (project.status === status) {
            return res.status(400).json({ message: `This project is already ${status}.` });
        }

        // Same authoritative ceiling the faculty approval path enforces — an admin override must
        // not become the way a supervisor ends up over their limit.
        if (status === 'Approved' && project.faculty) {
            const facultyUser = await User.findById(project.faculty);
            const projectGroup = await Group.findById(project.group).populate('members');

            if (facultyUser && projectGroup && projectGroup.members.length > 0) {
                const load = await supervisorCapacity(facultyUser, projectGroup.members.length, project._id);
                if (load.exceeded) {
                    return res.status(400).json({
                        message: `Supervisor limit reached: ${facultyUser.name} would be mentoring ${load.currentStudents + load.incoming} students this semester, over their limit of ${load.maxStudents}. Raise their student limit in the Faculty tab, or assign this group a different mentor.`,
                        limitExceeded: true,
                        limit: { facultyId: String(facultyUser._id), facultyName: facultyUser.name, ...load }
                    });
                }
            }
        }

        // Un-approving a graded project strands the marks: the panel's and the guide's work stays
        // on the document but the project leaves the approved set every evaluation view reads from.
        // Refuse until the admin says they know.
        if (project.status === 'Approved' && status !== 'Approved') {
            const graded = gradedArtefacts(project);
            if (graded.length > 0 && !confirm) {
                return res.status(409).json({
                    message: `This project already has ${graded.join(', ')}. Moving it out of Approved does not delete that work, but it will drop out of the evaluation and panel views that only read approved projects. Confirm to proceed.`,
                    requiresConfirmation: true,
                    graded
                });
            }
        }

        await applyProjectStatus(project, status, feedback);

        res.json(project);
    } catch (error) {
        console.error('Admin set project status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getProjects = async (req: Request, res: Response) => {
    try {
        const { id: userId, role } = (req as any).user;

        let query: any = { isArchived: { $ne: true } };

        if (role === UserRole.ADMIN) {
            // Admin sees all non-archived projects — support pagination
        } else if (role === UserRole.FACULTY) {
            query.faculty = userId;
        } else {
            // Student: only projects belonging to groups they're in
            const groups = await Group.find({ members: userId }).select('_id');
            const groupIds = groups.map(g => g._id);
            query.group = { $in: groupIds };
        }

        const { page: pageParam, limit: limitParam } = req.query;
        const page = pageParam ? Math.max(1, parseInt(pageParam as string)) : 0;
        const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam as string))) : 0;
        const usePagination = page > 0 && limit > 0 && role === UserRole.ADMIN;

        let projectQuery = Project.find(query)
            .populate('group', 'name members targetBatch')
            .populate('faculty', 'name email department photoUrl')
            .populate('updates.createdBy', 'name role photoUrl')
            .sort({ createdAt: -1 });

        if (usePagination) {
            const total = await Project.countDocuments(query);
            const projects = await projectQuery.skip((page - 1) * limit).limit(limit);
            res.json({ data: projects, total, page, pages: Math.ceil(total / limit) });
        } else {
            const projects = await projectQuery;
            res.json(projects);
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getArchivedProjects = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const me = await User.findById(userId).select('email').lean() as any;

        // Live archived groups (member _id is stable across roll/branch changes)
        const archivedGroups = await Group.find({ members: userId, isArchived: true })
            .populate({
                path: 'project',
                select: 'title description tags archivedMentorName status isArchived createdAt faculty midTermEvaluation endTermEvaluation finalReportEvaluation feedback',
                populate: { path: 'faculty', select: 'name' }
            })
            .sort({ updatedAt: -1 })
            .lean();

        // Snapshot-imported orphan projects: match by email (unchanged across branch transfers)
        const orphanProjects = me?.email ? await Project.find({
            isArchived: true,
            $or: [{ group: null }, { group: { $exists: false } }],
            'archivedMembers.email': me.email
        }).lean() : [];

        res.json({ groups: archivedGroups, orphanProjects });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Faculty view: archived projects they mentored. Matched by archivedMentorName (snapshot-safe).
export const getFacultyArchivedProjects = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const me = await User.findById(userId).select('name').lean() as any;
        if (!me) return res.status(404).json({ message: 'User not found' });

        const archivedProjects = await Project.find({
            isArchived: true,
            archivedMentorName: me.name
        })
            .populate({
                path: 'group',
                select: 'name targetBatch members isArchived',
                populate: { path: 'members', select: 'name email rollNumber branch photoUrl' }
            })
            .sort({ updatedAt: -1 })
            .lean();

        res.json(archivedProjects);
    } catch (error: any) {
        console.error('getFacultyArchivedProjects error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
        if (project.isArchived) return res.status(400).json({ message: 'Cannot add updates to an archived project' });

        // Verify user is member of the project's group OR is the assigned faculty
        const group = await Group.findById(project.group);
        const isMember = group && group.members.map(m => m.toString()).includes(userId);
        const isFaculty = project.faculty?.toString() === userId;

        if (!isMember && !isFaculty) {
            return res.status(403).json({ message: 'Not authorized to update this project' });
        }

        let fileUrls: string[] = [];
        if (files && files.length > 0) {
            fileUrls = files.map((f: any) => publicUrlFor(req, f));
        }

        let linkUrls: string[] = [];
        if (links) {
            if (Array.isArray(links)) linkUrls = links;
            else if (typeof links === 'string') {
                linkUrls = links.split(',').map((l: string) => l.trim()).filter(Boolean);
            }
        }

        project.updates.push({
            // Optional heading — the mentor's update form offers one; the student form doesn't.
            title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
            content,
            date: new Date(),
            attachments: fileUrls,
            links: linkUrls,
            createdBy: userId
        });
        if (isFaculty) {
            project.hasNewUpdate = false;
        } else {
            project.hasNewUpdate = true;
        }
        await project.save();

        // Notify the other side of the conversation, never the poster. A student's update goes to
        // the mentor alone; a mentor's update goes to the group. One post therefore produces one
        // email in one direction, which is what keeps this off the daily quota even for chatty
        // groups. In-app, the hasNewUpdate flag set above still drives the mentor's badge.
        try {
            const author = await User.findById(userId).select('name').lean() as any;
            const groupBatch = group?.targetBatch ? String(group.targetBatch) : undefined;
            const common = {
                groupName: group?.name,
                groupId: group ? String(group._id) : undefined,
                batch: groupBatch,
                updateTitle: typeof title === 'string' ? title.trim() || undefined : undefined,
                content,
                attachmentCount: fileUrls.length,
                linkCount: linkUrls.length,
            };

            if (isFaculty) {
                const memberUsers = await User.find({ _id: { $in: group?.members ?? [] } }).select('email').lean();
                const emails = memberUsers.map((m: any) => m.email).filter((e: string) => !!e);
                sendProjectUpdateEmail(emails, project.title, author?.name || 'Your mentor', 'members', common)
                    .catch(err => console.error('Update email failed:', err));
            } else if (project.faculty) {
                const mentor = await User.findById(project.faculty).select('email').lean() as any;
                if (mentor?.email) {
                    sendProjectUpdateEmail([mentor.email], project.title, author?.name || 'A group member', 'mentor', common)
                        .catch(err => console.error('Update email failed:', err));
                }
            }
        } catch (emailErr) {
            // A notification must never fail the post that triggered it.
            console.error('Failed to prepare project update email', emailErr);
        }

        // Populate the author before answering. `project` here is the document we just saved, so
        // updates[].createdBy is still a bare id — a caller that renders straight from this
        // response would show the update it just posted with no author until the next refetch.
        await project.populate('updates.createdBy', 'name role photoUrl');

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
        if (project.isArchived) return res.status(400).json({ message: 'Cannot edit an archived project' });

        // Verify membership
        const group = await Group.findById(project.group);
        if (!group || !group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to update this project' });
        }

        // Details are the group's to refine only until mid-semester evaluation opens — after that
        // the project is what it is for the rest of the semester. See utils/evaluationLock.
        if (projectDetailsFrozen(project, await midTermEvaluationOpened())) {
            return res.status(403).json({ message: DETAILS_FROZEN_MESSAGE, detailsLocked: true });
        }

        // Members may edit Draft/Pending/Rejected proposals, and also an Approved project to keep
        // its details current. An Approved edit stays Approved (no re-review) — see the status and
        // faculty guards below, which are what actually enforce that.
        if (!['Draft', 'Pending', 'Rejected', 'Approved'].includes(project.status)) {
            return res.status(400).json({ message: `Cannot edit project in ${project.status} status` });
        }
        const wasApproved = project.status === 'Approved';

        // Same submit-time capacity guard as createProject, applied to what this edit would leave
        // behind. Two ways in: promoting a Draft/Rejected proposal to Pending, and swapping the
        // mentor on one that is already Pending (allowed below, and previously unchecked). An
        // Approved project is exempt — its mentor is locked further down, so nothing can change.
        // Runs before the file handling so a refusal doesn't leave uploads half-processed.
        const nextFacultyId = (facultyId && !wasApproved) ? facultyId : project.faculty;
        const nextStatus = (!wasApproved && status) ? status : project.status;

        if (!wasApproved && nextStatus === 'Pending' && nextFacultyId) {
            const nextFaculty = await User.findById(nextFacultyId);
            if (!nextFaculty || nextFaculty.role !== UserRole.FACULTY) {
                return res.status(400).json({ message: 'Invalid faculty selected' });
            }

            const load = await supervisorCapacity(nextFaculty, group.members.length, project._id);
            if (load.exceeded) {
                return res.status(400).json({
                    message: mentorFullMessage(nextFaculty.name, load),
                    limitExceeded: true,
                    limit: { facultyId: String(nextFaculty._id), facultyName: nextFaculty.name, ...load }
                });
            }
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
            const newUrls = files.map((f: any) => publicUrlFor(req, f));
            fileUrls = [...fileUrls, ...newUrls];
        }

        // Update fields
        if (title) project.title = title;
        if (description) project.description = description;
        if (tags) {
            project.tags = Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim());
        }
        // Faculty is locked once approved — a group must not silently swap their approved mentor.
        if (facultyId && !wasApproved) project.faculty = facultyId;
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

        // An approved project stays approved through edits — skip every status transition so a
        // client-sent status (the editor posts 'Pending' by default) can't un-approve it.
        // Both promotions a group can make from the editor — Draft→Pending and (re)submitting a
        // Rejected proposal → Pending — are handled here in one place. (Previously a second block
        // duplicated this for the Rejected case, but the first block had already flipped the status
        // to Pending, so that block never ran and its feedback-clear was dead — a resubmitted
        // proposal kept the mentor's old rejection remarks.)
        if (!wasApproved && status && status !== project.status) {
            if (status === 'Pending') {
                // A submitted proposal must name a mentor. The faculty was assigned just above if
                // the editor sent one; 'Decide Later' stays a Draft-only choice.
                if (!project.faculty) {
                    return res.status(400).json({ message: 'Select a faculty mentor before submitting. Save as a draft to decide later.' });
                }
                // Only one active proposal at a time — block promoting to Pending while the group
                // already has another Pending/Approved project.
                const existingActive = await Project.findOne({
                    group: group._id,
                    _id: { $ne: project._id },
                    status: { $in: ['Pending', 'Approved'] }
                });
                if (existingActive) {
                    return res.status(400).json({ message: 'Your group already has an active proposal. Withdraw or wait for it to be rejected before sending another.' });
                }
                project.status = 'Pending';
                // Fresh submission for review — drop any prior rejection remarks so the mentor
                // doesn't see the note they left on the version they turned down.
                project.feedback = undefined;
                group.status = 'ProposalPending';
                group.project = project._id; // Ensure group points to the active proposal
                await group.save();
            } else if (status === 'Draft') {
                project.status = 'Draft';
            }
        }

        await project.save();
        res.json(project);
    } catch (error) {
        console.error("Update project error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

/**
 * A supervisor (or the admin) correcting the project's own details.
 * PUT /api/projects/:id/details  (multipart) { title?, description?, tags?, existingAttachments?, files[] }
 *
 * Deliberately separate from updateProject rather than a role branch inside it. That handler
 * carries the rest of the student flow — status promotion, mentor assignment, the capacity gate —
 * none of which applies here, and all of which would have to be defended against a faculty
 * caller. Here the writable set is the four fields below and nothing else, so the mentor cannot
 * reassign the project or move its status by any payload.
 *
 * Students keep using updateProject; this route gives them nothing they don't already have.
 */
export const updateProjectDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;
        const role = (req as any).user.role;
        const { title, description, tags } = req.body;
        const files = (req as any).files;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot edit an archived project' });

        // The assigned mentor or an admin. Any other faculty is a stranger to this project.
        const isAssignedMentor = !!project.faculty && project.faculty.toString() === userId;
        if (!isAssignedMentor && role !== UserRole.ADMIN) {
            return res.status(403).json({
                message: 'Only this project\'s mentor or the admin can edit its details.'
            });
        }

        // No projectDetailsFrozen check, deliberately. The mid-term freeze exists to stop the GROUP
        // moving the goalposts under a grader (see utils/evaluationLock.ts), and the message it
        // shows them — "Ask your mentor or the admin if something still needs to change" — is only
        // true if the mentor can still act. Removing the freeze here is what makes that promise good.

        const previousTitle = project.title;
        const changed: string[] = [];

        if (typeof title === 'string' && title.trim() && title.trim() !== project.title) {
            project.title = title.trim();
            changed.push('title');
        }
        if (typeof description === 'string' && description.trim() && description.trim() !== project.description) {
            project.description = description.trim();
            changed.push('description');
        }
        if (tags !== undefined) {
            const nextTags = (Array.isArray(tags) ? tags : String(tags).split(','))
                .map((t: string) => String(t).trim())
                .filter(Boolean);
            if (nextTags.join(',') !== (project.tags || []).join(',')) {
                project.tags = nextTags;
                changed.push('tags');
            }
        }

        // Attachments. `existingAttachments` is the list the editor kept — anything missing from it
        // was removed — and `files` are additions. Same wire shape the student editor uses, so the
        // client-side handling is identical on both sides.
        const current = project.attachments || [];
        if (req.body.existingAttachments !== undefined || (files && files.length > 0)) {
            let kept: string[] = current;
            if (req.body.existingAttachments !== undefined) {
                try {
                    const parsed = JSON.parse(req.body.existingAttachments);
                    if (Array.isArray(parsed)) {
                        // Only ever a subset of what is already there. Without this the field would
                        // let a caller write arbitrary strings into attachments, which are rendered
                        // as links and, for /uploads paths, resolved against the uploads directory.
                        kept = parsed.map(String).filter((url: string) => current.includes(url));
                    }
                } catch {
                    kept = current; // unparseable: change nothing rather than drop everything
                }
            }

            const added = (files || []).map((f: any) => publicUrlFor(req, f));
            const next = [...kept, ...added];

            if (next.join('|') !== current.join('|')) {
                // Unlike the student editor, drop removed files from disk rather than orphaning
                // them. Only files this project owned are eligible, and deleteFileByUrl no-ops on
                // anything outside the uploads directory.
                current
                    .filter(url => !next.includes(url))
                    .forEach(url => deleteFileByUrl(url));

                project.attachments = next;
                changed.push('attachments');
            }
        }

        if (changed.length === 0) {
            return res.status(400).json({ message: 'Nothing to change.' });
        }

        await project.save();

        // The group owns this text, so an edit from outside it must not be silent.
        try {
            const group = await Group.findById(project.group);
            const editor = await User.findById(userId).select('name role').lean() as any;
            if (group && group.members.length > 0) {
                const memberUsers = await User.find({ _id: { $in: group.members } }).select('email').lean();
                const emails = memberUsers.map((m: any) => m.email).filter((e: string) => !!e);
                if (emails.length > 0) {
                    sendProjectDetailsChangedEmail(emails, {
                        previousTitle,
                        newTitle: project.title,
                        editorName: editor?.name || 'Your mentor',
                        editorRole: editor?.role || 'Faculty',
                        changedFields: changed,
                    }).catch(err => console.error('Project details email failed:', err));
                }
            }
        } catch (emailErr) {
            // The edit already succeeded; a notification failure must not undo it.
            console.error('Failed to prepare project details email', emailErr);
        }

        res.json(project);
    } catch (error) {
        console.error('Update project details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot delete an archived project' });

        // Verify membership in the group that owns the project
        const group = await Group.findById(project.group);
        if (!group || !group.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to delete this project' });
        }

        if (project.status !== 'Pending' && project.status !== 'Draft') {
            return res.status(400).json({ message: 'Cannot delete a project that is not Pending or Draft' });
        }

        // Delete all attachment files from disk
        (project.attachments || []).forEach(url => deleteFileByUrl(url));

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
        // New payload: { type, remarks, students: [{ studentId, stars, attendance, guide, panel }] }
        const { type, remarks, students, midStudents } = req.body;
        const userId = (req as any).user.id;

        if (!['mid-term', 'end-term', 'final-report'].includes(type)) {
            return res.status(400).json({ message: 'Invalid evaluation type' });
        }

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        let isAuthorized = String(project.faculty) === userId || (req as any).user.role === 'Admin';
        if (!isAuthorized && project.faculty) {
            const panelDoc = await Panel.findOne({ faculty: { $all: [project.faculty, userId] } });
            if (panelDoc) isAuthorized = true;
        }
        if (!isAuthorized) return res.status(403).json({ message: 'Not authorized to evaluate this project' });

        // Save group-level metadata (remarks only, no group-level rubric scores)
        const evalMeta: any = { remarks, gradedBy: userId, date: new Date() };
        if (type === 'mid-term') project.midTermEvaluation = evalMeta;
        else if (type === 'end-term') project.endTermEvaluation = evalMeta;
        else if (type === 'final-report') project.finalReportEvaluation = evalMeta;

        project.markModified('midTermEvaluation');
        project.markModified('endTermEvaluation');
        project.markModified('finalReportEvaluation');

        // Helper: upsert one studentEvaluations entry
        const upsertStudentEval = (sv: any, evalType: string) => {
            const guideScores = sv.guide || {};
            const panel1Scores = sv.panel1 || sv.panel || {}; // panel = legacy fallback
            const panel2Scores = sv.panel2 || {};
            const guideTotal = Object.values(guideScores).reduce((s: number, v: any) => s + Number(v || 0), 0);
            const p1Total = Object.values(panel1Scores).reduce((s: number, v: any) => s + Number(v || 0), 0);
            const p2Total = Object.values(panel2Scores).reduce((s: number, v: any) => s + Number(v || 0), 0);
            // marks = guide + average of E1 and E2 (if E2 absent, just E1)
            const panelAvg = p2Total > 0 ? (p1Total + p2Total) / 2 : p1Total;
            const studentMarks = guideTotal + panelAvg;

            const existing = (project.studentEvaluations as any[]).find(
                (e: any) => String(e.student) === sv.studentId && e.evalType === evalType
            );
            if (existing) {
                existing.stars = sv.stars ?? existing.stars;
                existing.attendance = sv.attendance ?? existing.attendance;
                existing.guide = guideScores;
                existing.panel1 = panel1Scores;
                existing.panel2 = panel2Scores;
                existing.marks = studentMarks;
                existing.updatedAt = new Date();
            } else {
                (project.studentEvaluations as any[]).push({
                    student: new mongoose.Types.ObjectId(sv.studentId),
                    stars: sv.stars || 0,
                    attendance: sv.attendance || 'present',
                    evalType,
                    guide: guideScores,
                    panel1: panel1Scores,
                    panel2: panel2Scores,
                    marks: studentMarks,
                    updatedAt: new Date()
                });
            }
        };

        // Save per-student rubric scores into studentEvaluations
        if (Array.isArray(students) && students.length > 0) {
            if (!project.studentEvaluations) project.studentEvaluations = [];
            for (const sv of students) upsertStudentEval(sv, type);
            // For end-term, also overwrite mid-term entries if provided
            if (type === 'end-term' && Array.isArray(midStudents) && midStudents.length > 0) {
                for (const sv of midStudents) upsertStudentEval(sv, 'mid-term');
            }
            project.markModified('studentEvaluations');
        }

        const savedProject = await project.save();
        res.json(savedProject);
    } catch (error) {
        console.error("Evaluation error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const uploadSubmissions = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { evalType } = req.body;
        const userId = (req as any).user.id;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (project.isArchived) {
            return res.status(403).json({ message: 'Cannot submit to an archived project' });
        }

        // Authorization: Only group members can upload
        const group = await Group.findById(project.group);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        
        const isMember = group.members.some(member => String(member) === userId);
        if (!isMember && (req as any).user.role !== 'Admin') {
            return res.status(403).json({ message: 'Not authorized to submit for this project' });
        }

        // Gate uploads to the matching evaluation window (admins may submit anytime).
        // evalType ('mid_term_evaluation' | 'end_term_evaluation') maps directly to EventType.
        if ((req as any).user.role !== 'Admin') {
            if (evalType !== EventType.MID_TERM_EVALUATION && evalType !== EventType.END_TERM_EVALUATION) {
                return res.status(400).json({ message: 'Invalid evaluation type for submission' });
            }
            const now = new Date();
            const activeWindow = await Event.findOne({
                type: evalType,
                isActive: true,
                startDate: { $lte: now },
                $or: [
                    { extensionDate: { $exists: true, $ne: null, $gte: now } },
                    { extensionDate: { $exists: false }, endDate: { $gte: now } },
                    { extensionDate: null, endDate: { $gte: now } }
                ]
            });
            if (!activeWindow) {
                return res.status(403).json({ message: 'Submissions are closed — the evaluation window is not currently open.' });
            }
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        if (!project.submissions) {
            project.submissions = {};
        }

        const urlOf = (f: Express.Multer.File) => publicUrlFor(req, f);

        if (evalType === 'mid_term_evaluation') {
            if (files?.report) { deleteFileByUrl(project.submissions.midTermReport); project.submissions.midTermReport = urlOf(files.report[0]); }
            if (files?.ppt) { deleteFileByUrl(project.submissions.midTermPPT); project.submissions.midTermPPT = urlOf(files.ppt[0]); }
            if (files?.plagiarismReport) { deleteFileByUrl(project.submissions.midTermPlagiarism); project.submissions.midTermPlagiarism = urlOf(files.plagiarismReport[0]); }
        } else if (evalType === 'end_term_evaluation') {
            if (files?.report) { deleteFileByUrl(project.submissions.endTermReport); project.submissions.endTermReport = urlOf(files.report[0]); }
            if (files?.ppt) { deleteFileByUrl(project.submissions.endTermPPT); project.submissions.endTermPPT = urlOf(files.ppt[0]); }
            if (files?.plagiarismReport) { deleteFileByUrl(project.submissions.endTermPlagiarism); project.submissions.endTermPlagiarism = urlOf(files.plagiarismReport[0]); }
        } else {
            return res.status(400).json({ message: 'Invalid evaluation type for submission' });
        }

        project.markModified('submissions');
        await project.save();
        
        res.json({ message: 'Submissions uploaded successfully', project });
    } catch (error) {
        console.error("Submission upload error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

/**
 * SET per-student feedback from mentor.
 * PUT /api/projects/:id/student-feedback
 * Body: { studentId: string, comment: string }
 * Auth: assigned faculty or admin only
 */
export const setStudentFeedback = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { studentId, comment } = req.body;
        const userId = (req as any).user.id;

        if (!studentId || !comment) {
            return res.status(400).json({ message: 'studentId and comment are required' });
        }

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const isAuthorized = String(project.faculty) === userId || (req as any).user.role === 'Admin';
        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to leave feedback on this project' });
        }

        // Verify the student is actually in the project's group
        const group = await Group.findById(project.group);
        if (!group || !group.members.some(m => String(m) === studentId)) {
            return res.status(400).json({ message: 'Student is not a member of this project\'s group' });
        }

        if (!project.studentFeedback) project.studentFeedback = [];

        const existing = project.studentFeedback.find(f => String(f.student) === studentId);
        if (existing) {
            existing.comment = comment;
            existing.updatedAt = new Date();
        } else {
            project.studentFeedback.push({
                student: new mongoose.Types.ObjectId(studentId),
                comment,
                updatedAt: new Date()
            });
        }

        project.markModified('studentFeedback');
        await project.save();

        res.json({ message: 'Student feedback saved', studentFeedback: project.studentFeedback });
    } catch (error) {
        console.error('setStudentFeedback error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const saveStudentEvaluations = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { evaluations, evalType } = req.body; // evaluations: [{studentId, stars, attendance}]
        const userId = (req as any).user.id;

        if (!evaluations || !Array.isArray(evaluations)) {
            return res.status(400).json({ message: 'evaluations array required' });
        }

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        let isAuthorized = String(project.faculty) === userId || (req as any).user.role === 'Admin';
        if (!isAuthorized && project.faculty) {
            const panelDoc = await Panel.findOne({ faculty: { $all: [project.faculty, userId] } });
            if (panelDoc) isAuthorized = true;
        }
        if (!isAuthorized) return res.status(403).json({ message: 'Not authorized' });

        if (!project.studentEvaluations) project.studentEvaluations = [];

        for (const ev of evaluations) {
            const existing = project.studentEvaluations.find(
                (e: any) => String(e.student) === ev.studentId && e.evalType === evalType
            );
            if (existing) {
                existing.stars = ev.stars;
                existing.attendance = ev.attendance;
                existing.updatedAt = new Date();
            } else {
                project.studentEvaluations.push({
                    student: new mongoose.Types.ObjectId(ev.studentId),
                    stars: ev.stars,
                    attendance: ev.attendance,
                    evalType,
                    updatedAt: new Date()
                });
            }
        }

        project.markModified('studentEvaluations');
        await project.save();
        res.json({ message: 'Student evaluations saved', studentEvaluations: project.studentEvaluations });
    } catch (error) {
        console.error('saveStudentEvaluations error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const addFeedback = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { feedback } = req.body;
        const userId = (req as any).user.id;

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Authorization: Only assigned faculty
        let isAuthorized = String(project.faculty) === userId || (req as any).user.role === 'Admin';
        
        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to add feedback to this project' });
        }

        project.feedback = feedback;
        await project.save();

        res.json({ message: 'Feedback added successfully', project });
    } catch (error) {
        console.error("Feedback error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};
