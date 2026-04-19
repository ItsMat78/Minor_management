import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import Panel from '../models/Panel';

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
                    (email   ? byEmail.get(email.toLowerCase())    : undefined);
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

        const defaultPassword = await bcrypt.hash('changeme', 10);
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
                                isActive:   true
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
                        const existing = lookupQ.length ? await User.findOne({ $or: lookupQ }).lean() : null;

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
                            // New students are never droppers; they're simply enrolled into the selected batch
                            const studentBatch = expectedBatch ? String(expectedBatch) : (g.batchYear || undefined);
                            const newStudent = await User.create({
                                name:        s.name,
                                email:       s.email,
                                password:    defaultPassword,
                                role:        UserRole.STUDENT,
                                rollNumber:  s.roll,
                                branch:      s.branch || 'CSE',
                                semester:    g.semester || undefined,
                                targetBatch: studentBatch,
                                isVerified:  false,
                                isActive:    false
                            });
                            memberIds.push(newStudent._id as mongoose.Types.ObjectId);
                            created.students++;
                            created.studentList.push({ name: s.name, roll: s.roll, email: s.email, branch: s.branch || 'CSE', isDropper: false });
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
                const groupBatch = expectedBatch ? String(expectedBatch) : (g.batchYear || undefined);
                const groupDoc = await Group.create({
                    name:        g.groupNumber,
                    members:     availableIds,
                    status:      'Approved',
                    targetBatch: groupBatch
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
        const [users, groups, projects, panels] = await Promise.all([
            User.find({}).select('-password -otp -otpExpires').lean(),
            Group.find({}).lean(),
            Project.find({}).lean(),
            Panel.find({}).lean()
        ]);

        // Build email map for cross-ref
        const emailById = new Map(users.map(u => [String(u._id), u.email]));

        const snapshotUsers = users.map(u => ({
            email:       u.email,
            name:        u.name,
            role:        u.role,
            branch:      u.branch,
            rollNumber:  u.rollNumber,
            semester:    u.semester,
            targetBatch: u.targetBatch,
            department:  u.department,
            expertise:   u.expertise,
            maxStudents: u.maxStudents,
            maxGroups:   u.maxGroups,
            batchConfigs: u.batchConfigs,
            isActive:    u.isActive,
            isVerified:  u.isVerified
        }));

        const snapshotGroups = groups.map(g => {
            // Derive batchYear from members if targetBatch missing
            let batchYear = g.targetBatch || '';
            return {
                name:         g.name,
                targetBatch:  batchYear || undefined,
                status:       g.status,
                isArchived:   g.isArchived || false,
                memberEmails: g.members.map(m => emailById.get(String(m)) || String(m))
            };
        });

        // Map groupId → group name+batch for project cross-ref
        const groupById = new Map(groups.map(g => [String(g._id), g]));

        const snapshotProjects = projects.map(p => {
            const grp = groupById.get(String(p.group));
            return {
                title:              p.title,
                description:        p.description,
                tags:               p.tags,
                semester:           p.semester,
                status:             p.status,
                isArchived:         p.isArchived || false,
                archivedMentorName: p.archivedMentorName,
                facultyEmail:       p.faculty ? (emailById.get(String(p.faculty)) || null) : null,
                groupRef: grp ? {
                    name:  grp.name,
                    batch: grp.targetBatch || null
                } : null,
                feedback:               p.feedback,
                midTermEvaluation:      p.midTermEvaluation      || null,
                endTermEvaluation:      p.endTermEvaluation      || null,
                finalReportEvaluation:  p.finalReportEvaluation  || null
            };
        });

        const snapshotPanels = panels.map(p => ({
            batchYear:    p.batchYear,
            facultyEmails: p.faculty.map(f => emailById.get(String(f)) || String(f))
        }));

        const snapshot = {
            __version:     '1.0',
            __exportedAt:  new Date().toISOString(),
            __description: 'IIITNR Minor Management Portal - Database Snapshot',
            users:    snapshotUsers,
            groups:   snapshotGroups,
            projects: snapshotProjects,
            panels:   snapshotPanels
        };

        res.setHeader('Content-Disposition', `attachment; filename="snapshot_${new Date().toISOString().slice(0, 10)}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(snapshot);
    } catch (err) {
        console.error('exportSnapshot error:', err);
        res.status(500).json({ message: 'Error generating snapshot', error: err });
    }
};

// ─── Snapshot import preview ──────────────────────────────────────────────────

export const previewSnapshotImport = async (req: Request, res: Response) => {
    try {
        const snapshot = req.body;
        if (!snapshot?.users || !snapshot?.groups) {
            return res.status(400).json({ message: 'Invalid snapshot format. Expected { users, groups, projects, panels }.' });
        }

        const existingUsers = await User.find({}).select('email').lean();
        const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

        const existingGroups = await Group.find({}).select('name targetBatch').lean();
        // Group key: name + batch
        const existingGroupKeys = new Set(existingGroups.map(g => `${g.name}||${g.targetBatch || ''}`));

        const existingProjects = await Project.find({}).select('title').lean();
        const existingProjectTitles = new Set(existingProjects.map(p => p.title.toLowerCase()));

        const existingPanels = await Panel.find({}).select('batchYear').lean();
        const existingPanelBatches = new Set(existingPanels.map(p => p.batchYear));

        const userRows = (snapshot.users || []).map((u: any) => ({
            email:  u.email,
            name:   u.name,
            role:   u.role,
            status: existingEmails.has((u.email || '').toLowerCase()) ? 'skip' : 'create'
        }));

        const groupRows = (snapshot.groups || []).map((g: any) => ({
            name:        g.name,
            targetBatch: g.targetBatch,
            status:      existingGroupKeys.has(`${g.name}||${g.targetBatch || ''}`) ? 'skip' : 'create'
        }));

        const projectRows = (snapshot.projects || []).map((p: any) => ({
            title:  p.title,
            status: existingProjectTitles.has((p.title || '').toLowerCase()) ? 'skip' : 'create'
        }));

        const panelRows = (snapshot.panels || []).map((p: any) => ({
            batchYear: p.batchYear,
            status:    existingPanelBatches.has(p.batchYear) ? 'skip' : 'create'
        }));

        res.json({
            summary: {
                users:    { total: userRows.length,    create: userRows.filter((r: any) => r.status === 'create').length,    skip: userRows.filter((r: any) => r.status === 'skip').length },
                groups:   { total: groupRows.length,   create: groupRows.filter((r: any) => r.status === 'create').length,   skip: groupRows.filter((r: any) => r.status === 'skip').length },
                projects: { total: projectRows.length, create: projectRows.filter((r: any) => r.status === 'create').length, skip: projectRows.filter((r: any) => r.status === 'skip').length },
                panels:   { total: panelRows.length,   create: panelRows.filter((r: any) => r.status === 'create').length,   skip: panelRows.filter((r: any) => r.status === 'skip').length }
            },
            users:    userRows,
            groups:   groupRows,
            projects: projectRows,
            panels:   panelRows
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
        if (!snapshot?.users || !snapshot?.groups) {
            return res.status(400).json({ message: 'Invalid snapshot format.' });
        }

        const defaultPassword = await bcrypt.hash('changeme', 10);
        const result = { users: 0, groups: 0, projects: 0, panels: 0, skipped: 0 };
        const errors: { type: string; key: string; reason: string }[] = [];

        // ── 1. Users ─────────────────────────────────────────────────────────
        const emailToId = new Map<string, mongoose.Types.ObjectId>();

        const existingUsers = await User.find({}).select('_id email').lean();
        existingUsers.forEach(u => emailToId.set(u.email.toLowerCase(), u._id as mongoose.Types.ObjectId));

        for (const u of (snapshot.users || [])) {
            const key = (u.email || '').toLowerCase();
            if (!key) continue;

            if (emailToId.has(key)) { result.skipped++; continue; }

            try {
                const created = await User.create({
                    email:        u.email,
                    name:         u.name,
                    role:         u.role || UserRole.STUDENT,
                    branch:       u.branch,
                    rollNumber:   u.rollNumber,
                    semester:     u.semester,
                    targetBatch:  u.targetBatch,
                    department:   u.department,
                    expertise:    u.expertise,
                    maxStudents:  u.maxStudents,
                    maxGroups:    u.maxGroups,
                    batchConfigs: u.batchConfigs,
                    isActive:     u.isActive  ?? (u.role === UserRole.FACULTY),
                    isVerified:   u.isVerified ?? false,
                    password:     defaultPassword
                });
                emailToId.set(key, created._id as mongoose.Types.ObjectId);
                result.users++;
            } catch (err: any) {
                const reason = err.code === 11000 ? 'Duplicate email or roll number' : (err.message || 'Unknown error');
                errors.push({ type: 'user', key: u.email, reason });
            }
        }

        // ── 2. Groups ─────────────────────────────────────────────────────────
        const groupKeyToId = new Map<string, mongoose.Types.ObjectId>();

        const existingGroups = await Group.find({}).select('_id name targetBatch').lean();
        existingGroups.forEach(g => groupKeyToId.set(`${g.name}||${g.targetBatch || ''}`, g._id as mongoose.Types.ObjectId));

        for (const g of (snapshot.groups || [])) {
            const key = `${g.name}||${g.targetBatch || ''}`;
            if (groupKeyToId.has(key)) { result.skipped++; continue; }

            try {
                const memberIds = (g.memberEmails || [])
                    .map((e: string) => emailToId.get(e.toLowerCase()))
                    .filter(Boolean) as mongoose.Types.ObjectId[];

                const created = await Group.create({
                    name:        g.name,
                    targetBatch: g.targetBatch,
                    status:      g.status || 'Forming',
                    isArchived:  g.isArchived || false,
                    members:     memberIds
                });
                groupKeyToId.set(key, created._id as mongoose.Types.ObjectId);
                result.groups++;
            } catch (err: any) {
                errors.push({ type: 'group', key: `${g.name} (batch ${g.targetBatch || 'unknown'})`, reason: err.message || 'Unknown error' });
            }
        }

        // ── 3. Projects ───────────────────────────────────────────────────────
        const existingTitles = new Set(
            (await Project.find({}).select('title').lean()).map(p => p.title.toLowerCase())
        );

        for (const p of (snapshot.projects || [])) {
            if (existingTitles.has((p.title || '').toLowerCase())) { result.skipped++; continue; }

            try {
                const facultyId = p.facultyEmail ? emailToId.get(p.facultyEmail.toLowerCase()) : null;
                const groupKey  = p.groupRef ? `${p.groupRef.name}||${p.groupRef.batch || ''}` : '';
                const groupId   = groupKey ? groupKeyToId.get(groupKey) : null;

                if (!groupId) {
                    errors.push({ type: 'project', key: p.title, reason: `Group not found (ref: ${p.groupRef?.name}, batch: ${p.groupRef?.batch})` });
                    result.skipped++;
                    continue;
                }

                const projectDoc: any = {
                    title:                 p.title,
                    description:           p.description || '',
                    tags:                  p.tags        || [],
                    semester:              p.semester,
                    status:                p.status      || 'Approved',
                    isArchived:            p.isArchived  || false,
                    archivedMentorName:    p.archivedMentorName,
                    group:                 groupId,
                    feedback:              p.feedback,
                    midTermEvaluation:     p.midTermEvaluation     || undefined,
                    endTermEvaluation:     p.endTermEvaluation     || undefined,
                    finalReportEvaluation: p.finalReportEvaluation || undefined
                };
                if (facultyId) projectDoc.faculty = facultyId;

                const newProject = await Project.create(projectDoc);
                if (p.status === 'Approved' && !p.isArchived) {
                    await Group.findByIdAndUpdate(groupId, { project: (newProject as any)._id });
                }
                result.projects++;
            } catch (err: any) {
                errors.push({ type: 'project', key: p.title, reason: err.message || 'Unknown error' });
            }
        }

        // ── 4. Panels ─────────────────────────────────────────────────────────
        const existingPanelBatches = new Set(
            (await Panel.find({}).select('batchYear').lean()).map(p => p.batchYear)
        );

        for (const p of (snapshot.panels || [])) {
            if (existingPanelBatches.has(p.batchYear)) { result.skipped++; continue; }

            try {
                const facultyIds = (p.facultyEmails || [])
                    .map((e: string) => emailToId.get(e.toLowerCase()))
                    .filter(Boolean) as mongoose.Types.ObjectId[];

                if (facultyIds.length === 0) {
                    errors.push({ type: 'panel', key: `batch ${p.batchYear}`, reason: 'No matching faculty emails found' });
                    result.skipped++;
                    continue;
                }
                await Panel.create({ batchYear: p.batchYear, faculty: facultyIds });
                result.panels++;
            } catch (err: any) {
                errors.push({ type: 'panel', key: `batch ${p.batchYear}`, reason: err.message || 'Unknown error' });
            }
        }

        res.json({ message: 'Snapshot imported successfully', result, errors });
    } catch (err) {
        console.error('commitSnapshotImport error:', err);
        res.status(500).json({ message: 'Server error importing snapshot', error: err });
    }
};
