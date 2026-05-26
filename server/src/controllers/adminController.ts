import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import Panel from '../models/Panel';
import Event, { EventType } from '../models/Event';
import bcrypt from 'bcryptjs';

/** Returns the participatingBatches of the current active GF event, or [] if none. */
async function getParticipatingBatches(): Promise<string[]> {
    const now = new Date();
    const event = await Event.findOne({
        type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
        isActive: true,
        startDate: { $lte: now },
        $or: [
            { extensionDate: { $exists: true, $ne: null, $gte: now } },
            { extensionDate: { $exists: false }, endDate: { $gte: now } },
            { extensionDate: null, endDate: { $gte: now } }
        ]
    }).lean();
    return event?.participatingBatches ?? [];
}

function batchParticipates(rollNumber: string | undefined, targetBatch: string | undefined, batches: string[]): boolean {
    if (!batches.length) return false;
    if (targetBatch && batches.includes(String(targetBatch))) return true;
    if (rollNumber) {
        const prefixes = batches.map(b => b.slice(-2));
        return prefixes.some(p => rollNumber.startsWith(p));
    }
    return false;
}

export const getStats = async (req: Request, res: Response) => {
    try {
        const totalStudents = await User.countDocuments({ role: UserRole.STUDENT });
        const totalFaculty = await User.countDocuments({ role: UserRole.FACULTY });
        const totalGroups = await Group.countDocuments({ isArchived: { $ne: true } });
        const totalProjects = await Project.countDocuments({ isArchived: { $ne: true } });
        
        // 1. Number of ungrouped students
        const groupedStudentIds = await Group.distinct('members', { isArchived: { $ne: true } });
        const ungroupedStudents = await User.countDocuments({ 
            role: UserRole.STUDENT, 
            _id: { $nin: groupedStudentIds } 
        });

        // 2. Number of unactivated/activated STUDENT accounts only
        const unactivatedAccounts = await User.countDocuments({ role: UserRole.STUDENT, isVerified: false });
        const activatedAccounts = await User.countDocuments({ role: UserRole.STUDENT, isVerified: true });

        // Group status breakdown
        const [forming, proposalPending, approved] = await Promise.all([
            Group.countDocuments({ status: 'Forming', isArchived: { $ne: true } }),
            Group.countDocuments({ status: 'ProposalPending', isArchived: { $ne: true } }),
            Group.countDocuments({ status: 'Approved', isArchived: { $ne: true } }),
        ]);

        res.json({
            students: totalStudents,
            faculty: totalFaculty,
            groups: totalGroups,
            projects: totalProjects,
            ungroupedStudents,
            unactivatedAccounts,
            activatedAccounts,
            groupsByStatus: {
                Forming: forming,
                ProposalPending: proposalPending,
                Approved: approved,
            },
            // legacy shape preserved
            breakdown: { forming, approved }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const { name, email, role, rollNumber, branch, semester, department, expertise } = req.body;
        if (!name || !email || !role) {
            return res.status(400).json({ message: 'name, email, and role are required.' });
        }
        if (!['Student', 'Faculty'].includes(role)) {
            return res.status(400).json({ message: 'role must be Student or Faculty.' });
        }
        if (role === 'Student' && !rollNumber) {
            return res.status(400).json({ message: 'rollNumber is required for students.' });
        }

        const existing = await User.findOne({ $or: [{ email }, ...(rollNumber ? [{ rollNumber }] : [])] });
        if (existing) {
            return res.status(400).json({ message: 'A user with that email or roll number already exists.' });
        }

        const defaultPassword = await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10);

        // For students: check if a GF event is active and their batch is participating
        let isParticipating = role === 'Faculty'; // faculty always participate
        if (role === 'Student') {
            const activeBatches = await getParticipatingBatches();
            isParticipating = batchParticipates(rollNumber, undefined, activeBatches);
        }

        const newUser = new User({
            name,
            email,
            password: defaultPassword,
            role,
            rollNumber:  role === 'Student' ? rollNumber : undefined,
            branch:      role === 'Student' ? (branch || 'CSE') : undefined,
            semester:    role === 'Student' ? (Number(semester) || undefined) : undefined,
            department:  role === 'Faculty' ? (department || 'CSE') : undefined,
            expertise:   role === 'Faculty' ? expertise : undefined,
            isVerified:  role === 'Faculty',   // faculty active immediately
            isParticipating,
            mustChangePassword: true,
        });

        await newUser.save();

        const userObj = newUser.toObject() as any;
        delete userObj.password;
        res.status(201).json({ message: 'Account created successfully', user: userObj });
    } catch (error: any) {
        const reason = error.code === 11000 ? 'Duplicate email or roll number.' : (error.message || 'Server error');
        res.status(500).json({ message: reason });
    }
};

const groupBatchYear = (g: any): string | null => {
    if (g.targetBatch) return String(g.targetBatch);
    const firstRoll = g.members?.[0]?.rollNumber;
    if (firstRoll && /^\d{2}/.test(firstRoll)) return '20' + firstRoll.substring(0, 2);
    return null;
};

export const getArchive = async (req: Request, res: Response) => {
    try {
        const { year } = req.query as { year?: string };

        const allYearsMode = !year || year === 'All';
        const yearStr = allYearsMode ? null : String(year);

        // Archived groups with members populated (needed for participants + batch derivation)
        const groupQuery: any = { isArchived: true };
        if (yearStr) groupQuery.$or = [
            { targetBatch: yearStr },
            { targetBatch: { $in: [null, undefined, ''] } } // fall back to roll-derived match below
        ];
        const rawGroups = await Group.find(groupQuery)
            .populate('members', 'name email rollNumber branch department')
            .lean();

        // Filter to only groups whose derived batch matches (handles targetBatch-missing case)
        const groups = yearStr
            ? rawGroups.filter(g => groupBatchYear(g) === yearStr)
            : rawGroups;

        const groupIds = groups.map(g => g._id);

        // Archived projects: those linked to matched groups, plus snapshot-imported
        // projects that have no live group reference (denormalized via archivedBatch /
        // archivedMembers / archivedGroupName). Year filter applies to both sources.
        const linkedProjects = await Project.find({ isArchived: true, group: { $in: groupIds } })
            .populate('group', 'name targetBatch members')
            .lean();

        const orphanQuery: any = { isArchived: true, $or: [{ group: null }, { group: { $exists: false } }] };
        if (yearStr) orphanQuery.archivedBatch = yearStr;
        const orphanProjects = await Project.find(orphanQuery).lean();

        const projects = [...linkedProjects, ...orphanProjects];

        // Participants flattened, each carrying a link to their group + project + evaluations
        const projectByGroupId = new Map(linkedProjects.map(p => [String((p.group as any)?._id || p.group), p]));
        const participants: any[] = [];
        for (const g of groups) {
            const p = projectByGroupId.get(String(g._id));
            for (const m of (g.members || []) as any[]) {
                participants.push({
                    _id:        m._id,
                    name:       m.name,
                    email:      m.email,
                    rollNumber: m.rollNumber,
                    branch:     m.branch || m.department,
                    groupName:  g.name,
                    batchYear:  groupBatchYear(g),
                    projectTitle: p?.title,
                    archivedMentorName: p?.archivedMentorName,
                    midTermEvaluation:     p?.midTermEvaluation || null,
                    endTermEvaluation:     p?.endTermEvaluation || null,
                    finalReportEvaluation: p?.finalReportEvaluation || null
                });
            }
        }

        // Orphan (imported) projects contribute their archivedMembers as participants
        for (const p of orphanProjects as any[]) {
            for (const m of (p.archivedMembers || [])) {
                participants.push({
                    _id:        `${p._id}-${m.rollNumber || m.email || m.name}`,
                    name:       m.name,
                    email:      m.email,
                    rollNumber: m.rollNumber,
                    branch:     m.branch,
                    groupName:  p.archivedGroupName,
                    batchYear:  p.archivedBatch,
                    projectTitle: p.title,
                    archivedMentorName: p.archivedMentorName,
                    midTermEvaluation:     p.midTermEvaluation || null,
                    endTermEvaluation:     p.endTermEvaluation || null,
                    finalReportEvaluation: p.finalReportEvaluation || null
                });
            }
        }

        // Archived panels for the year
        const panelQuery: any = { isArchived: true };
        if (yearStr) panelQuery.batchYear = Number(yearStr);
        const panels = await Panel.find(panelQuery).populate('faculty', 'name email department').lean();

        // List of distinct archived years for the filter dropdown
        const allArchivedGroups = await Group.find({ isArchived: true })
            .populate('members', 'rollNumber')
            .select('targetBatch members')
            .lean();
        const yearSet = new Set<string>();
        for (const g of allArchivedGroups) {
            const y = groupBatchYear(g);
            if (y) yearSet.add(y);
        }
        const panelYears = await Panel.distinct('batchYear', { isArchived: true });
        panelYears.forEach((y: any) => yearSet.add(String(y)));
        const orphanYears = await Project.distinct('archivedBatch', {
            isArchived: true,
            $or: [{ group: null }, { group: { $exists: false } }]
        });
        orphanYears.forEach((y: any) => { if (y) yearSet.add(String(y)); });
        const availableYears = Array.from(yearSet).sort();

        res.json({
            year: yearStr,
            availableYears,
            groups,
            projects,
            participants,
            panels
        });
    } catch (error: any) {
        console.error('getArchive error:', error);
        res.status(500).json({ message: 'Server error fetching archive', error: error.message });
    }
};

/**
 * Semester Rollover — wipes all uploaded files from disk and clears file URL
 * fields in the database. All textual data (evaluations, grades, groups,
 * projects, students, faculty) is preserved intact for the archive.
 *
 * Requires body: { confirm: "ROLLOVER" }
 */
export const semesterRollover = async (req: Request, res: Response) => {
    try {
        if (req.body.confirm !== 'ROLLOVER') {
            return res.status(400).json({ message: 'Send { confirm: "ROLLOVER" } to proceed.' });
        }

        const uploadDir = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.join(__dirname, '../../uploads');

        // 1. Wipe every file from every upload bucket
        let filesDeleted = 0;
        const buckets = ['submissions', 'proposals', 'updates', 'avatars', 'imports', 'misc'];
        for (const bucket of buckets) {
            const bucketPath = path.join(uploadDir, bucket);
            if (!fs.existsSync(bucketPath)) continue;
            for (const file of fs.readdirSync(bucketPath)) {
                try {
                    fs.unlinkSync(path.join(bucketPath, file));
                    filesDeleted++;
                } catch (e) {
                    console.error(`[Rollover] Could not delete ${file}:`, e);
                }
            }
        }

        // 2. Clear all file URL fields from the database
        await User.updateMany({}, { $unset: { photoUrl: '' } });
        await Project.updateMany({}, {
            $set: {
                attachments: [],
                'submissions.midTermReport': null,
                'submissions.midTermPPT': null,
                'submissions.midTermPlagiarism': null,
                'submissions.endTermReport': null,
                'submissions.endTermPPT': null,
                'submissions.endTermPlagiarism': null,
            }
        });
        // Clear file attachments from all project updates
        await Project.updateMany(
            { 'updates.0': { $exists: true } },
            { $set: { 'updates.$[].attachments': [] } }
        );

        console.log(`[Rollover] Complete — ${filesDeleted} files deleted from disk.`);
        res.json({
            message: 'Semester rollover complete. All uploaded files have been wiped. All textual data and evaluations are preserved.',
            filesDeleted,
        });
    } catch (error) {
        console.error('[Rollover] Error:', error);
        res.status(500).json({ message: 'Server error during rollover' });
    }
};

export const createAdmin = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAdmin = new User({
            name,
            email,
            password: hashedPassword,
            role: UserRole.ADMIN,
            isVerified: true, // Admins auto-verified
        });

        await newAdmin.save();

        const adminObj = newAdmin.toObject() as any;
        delete adminObj.password;

        res.status(201).json({ message: 'Admin account created successfully', admin: adminObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

