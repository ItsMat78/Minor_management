import { Request, Response } from 'express';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import Event, { EventType } from '../models/Event';

// ─── Participation helpers ───────────────────────────────────────────────────

/**
 * Returns the active Group Formation event if one exists with a configured
 * participatingBatches list. Snapshot import no longer requires this — when
 * absent, everything imported is treated as archived (not part of the current
 * semester).
 */
async function getActiveGroupFormation(): Promise<{ participatingBatches: string[] } | null> {
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
    if (!event || !event.participatingBatches || event.participatingBatches.length === 0) return null;
    return { participatingBatches: event.participatingBatches };
}

function studentParticipates(targetBatch: string | undefined, rollNumber: string | undefined, batches: string[]): boolean {
    if (!batches || batches.length === 0) return false;
    if (targetBatch && batches.includes(String(targetBatch))) return true;
    if (rollNumber) {
        const prefixes = batches.map(b => b.slice(-2));
        return prefixes.some(p => rollNumber.startsWith(p));
    }
    return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Derive branch from 5th character (index 4) of roll number: '0'=CSE, '1'=ECE, '2'=DSAI */
const branchFromRoll = (roll: string): string => {
    if (!roll || roll.length < 5) return 'CSE';
    const digit = roll[4];
    if (digit === '1') return 'ECE';
    if (digit === '2') return 'DSAI';
    return 'CSE'; // '0' or unrecognised → CSE
};

const toFacultyEmail = (name: string) =>
    (name || 'unknown')
        .toLowerCase()
        .replace(/^(dr\.|prof\.|mr\.|ms\.)\s*/i, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.|\.$/, '') + '@iiitnr.edu.in';


// ─── Excel parser ─────────────────────────────────────────────────────────────

interface RawStudent { name: string; roll: string; branch: string; email: string }
interface ParsedGroup {
    groupNumber: string;
    projectTitle: string;
    projectDomain: string;
    facultyName: string;
    batchYear: string;        // derived from first student's roll
    students: RawStudent[];
}

function parseIIITNRExcel(filePath: string): ParsedGroup[] {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const ref = sheet['!ref'];
    if (!ref) return [];
    const range = XLSX.utils.decode_range(ref);

    const groups: ParsedGroup[] = [];
    let current: ParsedGroup | null = null;

    for (let R = 0; R <= range.e.r; R++) {
        const cell = (c: number) => {
            const addr = XLSX.utils.encode_cell({ r: R, c });
            return sheet[addr] ? String(sheet[addr].v).trim() : '';
        };

        const colA = cell(0);
        const colB = cell(1);
        const colC = cell(2);
        const colD = cell(3);
        const colE = cell(4);
        const colF = cell(5);
        const colG = cell(6);

        // Skip header rows
        if (/s\.?\s*no|group\s*no|sno/i.test(colA) || /members?\s*name|name/i.test(colB)) continue;

        // Detect group header: col A has a numeric group ID (not 'F', not blank)
        const isGroupRow = colA !== '' && /^\d+$/.test(colA.replace(/\s/g, ''));
        if (isGroupRow) {
            current = {
                groupNumber: colA,
                projectTitle: colE || '',
                projectDomain: colF || '',
                facultyName: colG || '',
                batchYear: '',
                students: []
            };
            groups.push(current);
        }

        // Detect student row: col B has a non-empty name
        if (colB && !/members?\s*name|^name$/i.test(colB)) {
            if (!current) {
                // Student appears before any group header — attach to a catch-all group
                current = { groupNumber: 'UNK', projectTitle: '', projectDomain: '', facultyName: '', batchYear: '', students: [] };
                groups.push(current);
            }
            // colD is treated as email when it contains '@'; otherwise left empty
            const emailVal = colD.includes('@') ? colD.toLowerCase() : '';
            current.students.push({ name: colB, roll: colC, branch: branchFromRoll(colC), email: emailVal });

            // Derive batchYear from first roll number we see
            if (!current.batchYear && colC && /^\d{2}/.test(colC)) {
                current.batchYear = '20' + colC.substring(0, 2);
            }
        }
    }

    return groups.filter(g => g.students.length > 0);
}

// ─── Excel import preview ─────────────────────────────────────────────────────

/** Derive expected batch year from semester number and current date.
 *  Odd semesters run Jul–Dec, even semesters run Jan–Jun.
 *  e.g. Sem 4 in Apr 2026 → 2026 - 4/2 = 2024 */
function expectedBatchFromSemester(semester: number): number | undefined {
    if (!semester || semester < 1) return undefined;
    const year = new Date().getFullYear();
    return semester % 2 === 0
        ? year - semester / 2
        : year - Math.floor((semester - 1) / 2);
}

export const previewExcelImport = async (req: Request, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const semester = parseInt(req.body.semester) || 0;
        const expectedBatch = expectedBatchFromSemester(semester);
        const expectedPrefix = expectedBatch ? String(expectedBatch).slice(-2) : null;

        const rawGroups = parseIIITNRExcel(req.file.path);
        fs.unlinkSync(req.file.path);

        if (rawGroups.length === 0) {
            return res.status(400).json({ message: 'No group data found in the file. Check the Excel format.' });
        }

        // Load existing users for dedup checks
        const allUsers = await User.find({}).select('_id email rollNumber name role').lean();
        const byEmail = new Map(allUsers.map(u => [u.email.toLowerCase(), u]));
        const byRoll  = new Map(allUsers.filter(u => u.rollNumber).map(u => [u.rollNumber!.toLowerCase(), u]));

        // Students already in non-archived groups
        const activeGroups = await Group.find({ isArchived: { $ne: true } }).select('members').lean();
        const groupedStudentIds = new Set(activeGroups.flatMap(g => g.members.map(m => m.toString())));

        const previewGroups = rawGroups.map(g => {
            const students = g.students.map(s => {
                // Email must come from the Excel file; we do not derive it from roll
                const email = s.email || '';
                const existing =
                    (s.roll  ? byRoll.get(s.roll.toLowerCase())   : undefined) ||
                    (email   ? byEmail.get(email.toLowerCase())    : undefined) ||
                    (!s.roll && !email ? allUsers.find(u => u.role === 'Student' && norm(u.name) === norm(s.name)) : undefined);
                // isDropper is informational: roll prefix doesn't match the selected semester's expected batch.
                // For existing students this is a real dropper scenario; for new students it's a batch-override note.
                // Either way the commit will assign them to the expected batch.
                const isDropper = !!(expectedPrefix && s.roll && !s.roll.startsWith(expectedPrefix));
                return {
                    name:       s.name,
                    roll:       s.roll,
                    branch:     s.branch,
                    email,
                    status:     existing ? 'existing' : 'new',
                    existingId: existing ? String(existing._id) : null,
                    inGroup:    existing ? groupedStudentIds.has(String(existing._id)) : false,
                    isDropper,
                    missingEmail: !existing && !email   // new student with no email = unresolvable
                };
            });

            const facultyEmail = g.facultyName ? toFacultyEmail(g.facultyName) : '';
            const existingFaculty =
                (facultyEmail ? byEmail.get(facultyEmail.toLowerCase()) : undefined) ||
                allUsers.find(u => u.role === 'Faculty' && norm(u.name) === norm(g.facultyName));

            return {
                groupNumber:   g.groupNumber,
                projectTitle:  g.projectTitle  || `Group ${g.groupNumber} Project`,
                projectDomain: g.projectDomain || 'General',
                batchYear:     expectedBatch ? String(expectedBatch) : g.batchYear,
                semester,
                students,
                faculty: {
                    name:       g.facultyName,
                    email:      facultyEmail,
                    status:     existingFaculty ? 'existing' : (g.facultyName ? 'new' : 'none'),
                    existingId: existingFaculty ? String(existingFaculty._id) : null
                }
            };
        });

        const allStudents = previewGroups.flatMap(g => g.students);
        res.json({
            groups: previewGroups,
            expectedBatch,
            summary: {
                totalGroups:            previewGroups.length,
                totalStudents:          allStudents.length,
                newStudents:            allStudents.filter(s => s.status === 'new').length,
                existingStudents:       allStudents.filter(s => s.status === 'existing').length,
                studentsAlreadyGrouped: allStudents.filter(s => s.inGroup).length,
                droppers:               allStudents.filter(s => s.isDropper).length,
                missingEmails:          allStudents.filter(s => s.missingEmail).length,
                newFaculty:             previewGroups.filter(g => g.faculty.status === 'new').length,
                existingFaculty:        previewGroups.filter(g => g.faculty.status === 'existing').length
            }
        });
    } catch (err) {
        console.error('previewExcelImport error:', err);
        res.status(500).json({ message: 'Error parsing Excel file', error: err });
    }
};

// ─── Excel import commit ──────────────────────────────────────────────────────

export const commitExcelImport = async (req: Request, res: Response) => {
    try {
        const { groups, semester } = req.body as { groups: any[]; semester?: number };
        if (!groups?.length) return res.status(400).json({ message: 'No group data provided' });

        const expectedBatch = expectedBatchFromSemester(semester || 0);
        const expectedPrefix = expectedBatch ? String(expectedBatch).slice(-2) : null;

        const activeGF = await getActiveGroupFormation();
        const participatingBatches = activeGF?.participatingBatches || [];

        const defaultPassword = await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10);
        const created = {
            students: 0, faculty: 0, groups: 0, projects: 0, skipped: 0,
            studentList: [] as { name: string; roll: string; email: string; branch: string; isDropper: boolean }[],
            facultyList: [] as { name: string; email: string }[],
            groupList:   [] as { groupNumber: string; projectTitle: string; memberCount: number }[],
        };
        const errors: { groupNumber: string; student?: string; reason: string }[] = [];

        for (const g of groups) {
            try {
                // 1. Resolve / create faculty
                let facultyDoc: any = null;
                if (g.faculty?.name && g.faculty.status !== 'none') {
                    if (g.faculty.existingId) {
                        facultyDoc = await User.findById(g.faculty.existingId).lean();
                    } else {
                        facultyDoc =
                            await User.findOne({ email: g.faculty.email }).lean() ||
                            await User.findOne({ role: 'Faculty', name: new RegExp(`^${g.faculty.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();

                        if (!facultyDoc) {
                            facultyDoc = await User.create({
                                name:       g.faculty.name,
                                email:      g.faculty.email,
                                password:   defaultPassword,
                                role:       UserRole.FACULTY,
                                department: 'CSE',
                                isVerified: true,
                                isParticipating: true
                            });
                            created.faculty++;
                            created.facultyList.push({ name: g.faculty.name, email: g.faculty.email });
                        }
                    }
                }

                // 2. Resolve / create students
                const memberIds: mongoose.Types.ObjectId[] = [];
                for (const s of g.students) {
                    if (!s.name) continue;

                    if (s.existingId) {
                        memberIds.push(new mongoose.Types.ObjectId(s.existingId));
                        continue;
                    }

                    try {
                        const lookupQ: any[] = [];
                        if (s.roll)  lookupQ.push({ rollNumber: s.roll });
                        if (s.email) lookupQ.push({ email: s.email });
                        let existing = lookupQ.length ? await User.findOne({ $or: lookupQ }).lean() : null;
                        if (!existing && !s.roll && !s.email && s.name) {
                            existing = await User.findOne({ role: UserRole.STUDENT, name: new RegExp(`^${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
                        }

                        if (existing) {
                            memberIds.push(existing._id as mongoose.Types.ObjectId);
                        } else {
                            if (!s.roll) {
                                errors.push({ groupNumber: g.groupNumber, student: s.name, reason: 'No roll number — cannot create student account' });
                                continue;
                            }
                            if (!s.email) {
                                errors.push({ groupNumber: g.groupNumber, student: s.name, reason: 'No email in Excel — cannot create student account (add an email column or import students first)' });
                                continue;
                            }
                            // Only set targetBatch when the student's roll-derived batch
                            // differs from the expected batch (i.e. actual dropper).
                            const rollBatch = s.roll && /^\d{2}/.test(s.roll) ? '20' + s.roll.substring(0, 2) : null;
                            const studentBatch = expectedBatch ? String(expectedBatch) : (g.batchYear || undefined);
                            const isActualDropper = !!(studentBatch && rollBatch && rollBatch !== studentBatch);
                            const newStudent = await User.create({
                                name:        s.name,
                                email:       s.email,
                                password:    defaultPassword,
                                role:        UserRole.STUDENT,
                                rollNumber:  s.roll,
                                branch:      s.branch || 'CSE',
                                semester:    g.semester || undefined,
                                targetBatch: isActualDropper ? studentBatch : undefined,
                                isVerified:  false,
                                mustChangePassword: true,
                                isParticipating: studentParticipates(studentBatch, s.roll, participatingBatches)
                            });
                            memberIds.push(newStudent._id as mongoose.Types.ObjectId);
                            created.students++;
                            created.studentList.push({ name: s.name, roll: s.roll, email: s.email, branch: s.branch || 'CSE', isDropper: isActualDropper });
                        }
                    } catch (sErr: any) {
                        const reason = sErr.code === 11000 ? 'Duplicate email or roll number' : (sErr.message || 'Unknown error');
                        errors.push({ groupNumber: g.groupNumber, student: s.name, reason });
                    }
                }

                if (memberIds.length === 0) { created.skipped++; continue; }

                // 3. Filter out members who are already in an active (non-archived) group
                const alreadyGrouped = await Group.find({
                    members:    { $in: memberIds },
                    isArchived: { $ne: true }
                }).select('members').lean();
                const alreadyGroupedIds = new Set(
                    alreadyGrouped.flatMap(ag => ag.members.map(m => m.toString()))
                );
                const availableIds = memberIds.filter(id => !alreadyGroupedIds.has(id.toString()));

                // Record skipped students
                for (const s of g.students) {
                    if (s.existingId && alreadyGroupedIds.has(s.existingId)) {
                        errors.push({ groupNumber: g.groupNumber, student: s.name, reason: 'Already in an active group — skipped' });
                    }
                }

                if (availableIds.length === 0) { created.skipped++; continue; }

                // 4. Create group with only the available members
                // Only set targetBatch on the group when it contains at least one
                // student whose roll-derived batch differs from the expected batch.
                // This prevents normal groups from being flagged as dropper.
                const groupBatch = expectedBatch ? String(expectedBatch) : (g.batchYear || undefined);
                const hasDropperMember = g.students.some((s: any) => {
                    if (!s.roll || !/^\d{2}/.test(s.roll)) return false;
                    const rollBatch = '20' + s.roll.substring(0, 2);
                    return groupBatch && rollBatch !== groupBatch;
                });
                const groupDoc = await Group.create({
                    name:        g.groupNumber,
                    members:     availableIds,
                    status:      'Approved',
                    targetBatch: hasDropperMember ? groupBatch : undefined
                });
                created.groups++;
                created.groupList.push({ groupNumber: g.groupNumber, projectTitle: g.projectTitle || `Group ${g.groupNumber} Project`, memberCount: availableIds.length });

                // 5. Create project — skip if group already has an approved project
                const existingProject = await Project.findOne({ group: groupDoc._id, status: 'Approved' });
                if (!existingProject) {
                    const newProject = await Project.create({
                        title:       g.projectTitle || `Group ${g.groupNumber} Project`,
                        description: g.projectDomain || 'Imported project',
                        tags:        g.projectDomain ? [g.projectDomain] : [],
                        faculty:     facultyDoc?._id || null,
                        group:       groupDoc._id,
                        semester:    g.semester || undefined,
                        status:      'Approved'
                    });
                    await Group.findByIdAndUpdate(groupDoc._id, { project: newProject._id });
                    created.projects++;
                }
            } catch (gErr: any) {
                errors.push({ groupNumber: g.groupNumber, reason: gErr.message || 'Unknown error' });
                created.skipped++;
            }
        }

        res.json({ message: 'Import complete', created, errors });
    } catch (err) {
        console.error('commitExcelImport error:', err);
        res.status(500).json({ message: 'Server error during import', error: err });
    }
};

// ─── Snapshot export ──────────────────────────────────────────────────────────

export const exportSnapshot = async (_req: Request, res: Response) => {
    try {
        // Snapshot = archived projects only, each self-contained with evaluations and
        // denormalized mentor/group/member info. Users, groups, and panels are NOT
        // included — snapshots are intended for long-term archival of past semesters.
        const projects = await Project.find({ isArchived: true })
            .populate('faculty', 'name')
            .populate({ path: 'group', populate: { path: 'members', select: 'name email rollNumber branch' } })
            .lean();

        const snapshotProjects = projects.map((p: any) => {
            const grp = p.group as any;
            const fallbackMembers = (grp?.members || []).map((m: any) => ({
                name: m.name,
                email: m.email,
                rollNumber: m.rollNumber,
                branch: m.branch
            }));
            return {
                title:                 p.title,
                description:           p.description,
                tags:                  p.tags,
                semester:              p.semester,
                status:                p.status,
                feedback:              p.feedback,
                archivedMentorName:    p.archivedMentorName || (p.faculty ? (p.faculty as any).name : undefined),
                archivedGroupName:     p.archivedGroupName || grp?.name,
                archivedBatch:         p.archivedBatch || grp?.targetBatch,
                archivedMembers:       (p.archivedMembers && p.archivedMembers.length) ? p.archivedMembers : fallbackMembers,
                // New per-student evaluation array (primary source of eval data)
                studentEvaluations:    p.studentEvaluations || [],
                // Legacy aggregate fields kept for backward compat
                midTermEvaluation:     p.midTermEvaluation     || null,
                endTermEvaluation:     p.endTermEvaluation     || null,
                finalReportEvaluation: p.finalReportEvaluation || null
            };
        });

        const snapshot = {
            __version:     '3.1',
            __exportedAt:  new Date().toISOString(),
            __description: 'IIITNR Minor Management Portal - Evaluations & Projects Archive Snapshot',
            projects: snapshotProjects
        };

        res.setHeader('Content-Disposition', `attachment; filename="projects_snapshot_${new Date().toISOString().slice(0, 10)}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(snapshot);
    } catch (err) {
        console.error('exportSnapshot error:', err);
        res.status(500).json({ message: 'Error generating snapshot', error: err });
    }
};

// ─── Snapshot normalizer (v1.x/v2.x → v3.0 shape) ────────────────────────────

/**
 * Older snapshots store users/groups/panels as separate arrays and projects only
 * hold a `groupRef` + `facultyEmail`. This helper denormalizes those into the
 * v3.0 projects-only shape so downstream code can treat every snapshot uniformly.
 * v3.0 snapshots pass through unchanged.
 */
function normalizeSnapshotProjects(snapshot: any): any[] {
    const rawProjects = Array.isArray(snapshot?.projects) ? snapshot.projects : [];
    if (!rawProjects.length) return [];

    const users: any[] = Array.isArray(snapshot.users) ? snapshot.users : [];
    const groups: any[] = Array.isArray(snapshot.groups) ? snapshot.groups : [];
    const userByEmail = new Map<string, any>();
    for (const u of users) userByEmail.set((u.email || '').toLowerCase(), u);

    // Derive each group's batch from its first member's roll prefix (v1.0 groups
    // carry no targetBatch). Build a name-indexed multi-map so we can disambiguate
    // when multiple groups share a name across different batches.
    const enrichGroup = (g: any) => {
        const emails: string[] = g.memberEmails || [];
        const members = emails.map(e => userByEmail.get((e || '').toLowerCase())).filter(Boolean);
        const firstRoll = members.find((u: any) => u?.rollNumber)?.rollNumber;
        const derivedBatch = g.targetBatch
            || (firstRoll && /^\d{2}/.test(firstRoll) ? '20' + firstRoll.substring(0, 2) : undefined);
        return { ...g, __members: members, __batch: derivedBatch };
    };
    const enrichedGroups = groups.map(enrichGroup);
    const groupsByName = new Map<string, any[]>();
    for (const g of enrichedGroups) {
        const arr = groupsByName.get(g.name) || [];
        arr.push(g);
        groupsByName.set(g.name, arr);
    }

    return rawProjects.map((p: any) => {
        // Already v3.0: has archivedMembers or lacks groupRef
        if (Array.isArray(p.archivedMembers) && p.archivedMembers.length > 0) return p;
        if (!p.groupRef && !p.facultyEmail) return p;

        const ref = p.groupRef || {};
        const mentorName = p.archivedMentorName
            || (p.facultyEmail && userByEmail.get(String(p.facultyEmail).toLowerCase())?.name)
            || undefined;

        // Resolve group: exact match on (name, batch) if batch provided, else the
        // unique group with that name, else first candidate.
        let grp: any = null;
        if (ref.name) {
            const candidates = groupsByName.get(ref.name) || [];
            if (ref.batch) {
                grp = candidates.find(c => String(c.__batch) === String(ref.batch)) || candidates[0];
            } else {
                grp = candidates.length === 1 ? candidates[0] : candidates[0];
            }
        }

        const archivedMembers = (grp?.__members || []).map((u: any) => ({
            name: u.name, email: u.email, rollNumber: u.rollNumber, branch: u.branch
        }));
        const batch = p.archivedBatch || ref.batch || grp?.__batch;

        return {
            ...p,
            archivedMentorName: mentorName,
            archivedGroupName:  p.archivedGroupName || ref.name,
            archivedBatch:      batch,
            archivedMembers
        };
    });
}

// ─── Snapshot import preview ──────────────────────────────────────────────────

export const previewSnapshotImport = async (req: Request, res: Response) => {
    try {
        const snapshot = req.body;
        if (!snapshot?.projects || !Array.isArray(snapshot.projects)) {
            return res.status(400).json({ message: 'Invalid snapshot format. Expected { projects: [...] }.' });
        }
        snapshot.projects = normalizeSnapshotProjects(snapshot);

        const existingProjects = await Project.find({}).select('title').lean();
        const existingTitles = new Set(existingProjects.map(p => p.title.toLowerCase()));

        const projectRows = snapshot.projects.map((p: any) => ({
            title:              p.title,
            archivedMentorName: p.archivedMentorName || null,
            archivedGroupName:  p.archivedGroupName || null,
            archivedBatch:      p.archivedBatch || null,
            memberCount:        (p.archivedMembers || []).length,
            studentEvalCount:   (p.studentEvaluations || []).length,
            hasMidTerm:         !!p.midTermEvaluation,
            hasEndTerm:         !!p.endTermEvaluation,
            hasFinal:           !!p.finalReportEvaluation,
            status:             existingTitles.has((p.title || '').toLowerCase()) ? 'skip' : 'create'
        }));

        res.json({
            version: snapshot.__version || 'unknown',
            summary: {
                projects: {
                    total:  projectRows.length,
                    create: projectRows.filter((r: any) => r.status === 'create').length,
                    skip:   projectRows.filter((r: any) => r.status === 'skip').length
                }
            },
            projects: projectRows
        });
    } catch (err) {
        console.error('previewSnapshotImport error:', err);
        res.status(500).json({ message: 'Error previewing snapshot', error: err });
    }
};

// ─── Snapshot import commit ───────────────────────────────────────────────────

export const commitSnapshotImport = async (req: Request, res: Response) => {
    try {
        const snapshot = req.body;
        if (!snapshot?.projects || !Array.isArray(snapshot.projects)) {
            return res.status(400).json({ message: 'Invalid snapshot format. Expected { projects: [...] }.' });
        }
        snapshot.projects = normalizeSnapshotProjects(snapshot);

        const result = { projects: 0, skipped: 0 };
        const errors: { type: string; key: string; reason: string }[] = [];

        const existingTitles = new Set(
            (await Project.find({}).select('title').lean()).map(p => p.title.toLowerCase())
        );

        for (const p of snapshot.projects) {
            if (existingTitles.has((p.title || '').toLowerCase())) { result.skipped++; continue; }

            try {
                const members = Array.isArray(p.archivedMembers)
                    ? p.archivedMembers
                        .filter((m: any) => m && m.name)
                        .map((m: any) => ({
                            name:       m.name,
                            email:      m.email,
                            rollNumber: m.rollNumber,
                            branch:     m.branch
                        }))
                    : [];

                await Project.create({
                    title:                 p.title,
                    description:           p.description || '',
                    tags:                  p.tags        || [],
                    semester:              p.semester,
                    status:                p.status      || 'Approved',
                    isArchived:            true,
                    archivedMentorName:    p.archivedMentorName,
                    archivedGroupName:     p.archivedGroupName,
                    archivedBatch:         p.archivedBatch,
                    archivedMembers:       members,
                    feedback:              p.feedback,
                    // Restore per-student evaluations (new system)
                    studentEvaluations:    Array.isArray(p.studentEvaluations) ? p.studentEvaluations : [],
                    // Legacy aggregate fields
                    midTermEvaluation:     p.midTermEvaluation     || undefined,
                    endTermEvaluation:     p.endTermEvaluation     || undefined,
                    finalReportEvaluation: p.finalReportEvaluation || undefined
                });
                existingTitles.add((p.title || '').toLowerCase());
                result.projects++;
            } catch (err: any) {
                errors.push({ type: 'project', key: p.title, reason: err.message || 'Unknown error' });
            }
        }

        res.json({ message: 'Snapshot imported successfully', result, errors });
    } catch (err) {
        console.error('commitSnapshotImport error:', err);
        res.status(500).json({ message: 'Server error importing snapshot', error: err });
    }
};
