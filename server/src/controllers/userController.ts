import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import * as XLSX from 'xlsx';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { publicUrlFor } from '../middleware/uploadMiddleware';
import Event, { EventType } from '../models/Event';

/** Returns the participatingBatches of the current active GF event, or [] if none. */
async function getActiveParticipatingBatches(): Promise<string[]> {
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

function studentBatchParticipates(rollNumber: string | undefined, batches: string[]): boolean {
    if (!batches.length || !rollNumber) return false;
    const prefixes = batches.map(b => b.slice(-2));
    return prefixes.some(p => rollNumber.startsWith(p));
}

export const getFaculty = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const currentUser = await User.findById(userId);
        
        // Determine batch year from requester
        const batchYearPrefix = currentUser?.rollNumber ? currentUser.rollNumber.substring(0, 2) : null;
        const batchYear = batchYearPrefix ? parseInt('20' + batchYearPrefix) : null;

        const facultyList = await User.find({ role: UserRole.FACULTY })
            .select('name email department expertise currentStudents currentGroups maxStudents maxGroups batchConfigs isVerified photoUrl')
            .lean();

        // Dynamically calculate counts for EACH faculty for THIS specific batch
        const populatedFaculty = await Promise.all(facultyList.map(async (faculty: any) => {
            // Fetch all approved projects for this faculty
            const approvedProjects = await Project.find({
                faculty: faculty._id,
                status: 'Approved'
            }).populate({
                path: 'group',
                populate: { path: 'members', select: 'rollNumber' }
            });

            let currentGroups = 0;
            let currentStudents = 0;

            approvedProjects.forEach((p: any) => {
                if (p.group && p.group.members && p.group.members.length > 0) {
                    const firstMember: any = p.group.members[0];
                    // If requester is student and we have a batch to match
                    if (batchYearPrefix && firstMember.rollNumber && firstMember.rollNumber.startsWith(batchYearPrefix)) {
                        currentGroups++;
                        currentStudents += p.group.members.length;
                    } else if (!batchYearPrefix) {
                        // Fallback if no batch prefix (e.g. admin or weird roll)
                        currentGroups++;
                        currentStudents += p.group.members.length;
                    }
                }
            });

            // Adjust limits based on batch config
            let maxStudents = faculty.maxStudents || 21;
            let maxGroups = faculty.maxGroups || 7;

            if (batchYear) {
                const config = (faculty.batchConfigs || []).find((c: any) => c.batchYear === batchYear);
                if (config) {
                    maxStudents = config.maxStudents;
                    maxGroups = config.maxGroups;
                }
            }

            return {
                ...faculty,
                currentStudents,
                currentGroups,
                maxStudents,
                maxGroups
            };
        }));

        res.json(populatedFaculty);
    } catch (error) {
        console.error("getFaculty error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getAllStudents = async (req: Request, res: Response) => {
    try {

        // Get current user to check role and semester
        const currentUserId = (req as any).user.id;
        const currentUser = await User.findById(currentUserId);

        let query: any = { role: UserRole.STUDENT };

        // 1. Filter by Cohort (Batch Year)
        if (currentUser && currentUser.role === UserRole.STUDENT) {
            // Determine the current user's effective cohort (year)
            const userCohort = currentUser.targetBatch || (currentUser.rollNumber ? `20${currentUser.rollNumber.substring(0, 2)}` : null);
            
            if (userCohort) {
                const suffix = userCohort.slice(-2); // e.g., "2024" -> "24"
                
                query.$or = [
                    { 
                        // Students whose original cohort matches, but ONLY if they haven't been moved elsewhere
                        rollNumber: { $regex: `^${suffix}` },
                        $or: [
                            { targetBatch: null },
                            { targetBatch: { $exists: false } },
                            { targetBatch: userCohort } // Included for safety if set to same year
                        ]
                    },
                    {
                        // Students from ANY other batch who were specifically moved to this cohort
                        targetBatch: userCohort
                    }
                ];
            } else if (currentUser.semester) {
                // Fallback to semester if roll number is missing (should not happen for students)
                query.semester = currentUser.semester;
            }
        }

        // 2. Filter by Branch / Batch / Verification / search / participation
        const { branch, status: filterStatus, participationStatus, page: pageParam, limit: limitParam, search, batch, verification } = req.query;
        if (branch && branch !== 'all' && branch !== 'All') {
            query.branch = branch;
        }
        if (batch && batch !== 'All') {
            const batchSuffix = (batch as string).slice(-2);
            const batchClause = {
                $or: [
                    { rollNumber: { $regex: `^${batchSuffix}` }, targetBatch: { $in: [null, undefined, batch] } },
                    { targetBatch: batch }
                ]
            };
            query.$and = [...(query.$and || []), batchClause];
        }
        if (verification === 'Verified') query.isVerified = true;
        if (verification === 'Unverified') query.isVerified = false;
        
        if (participationStatus === 'participating') {
            query.isParticipating = true;
        } else if (participationStatus === 'non-participating') {
            query.isParticipating = false;
        }
        if (search && typeof search === 'string' && search.trim()) {
            const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(safe, 'i');
            query.$and = [...(query.$and || []), { $or: [{ name: rx }, { email: rx }, { rollNumber: rx }] }];
        }

        // Pagination (admin only — students always get their full cohort)
        const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.FACULTY;
        const page = isAdmin && pageParam ? Math.max(1, parseInt(pageParam as string)) : 0;
        const limit = isAdmin && limitParam ? Math.max(1, Math.min(200, parseInt(limitParam as string))) : 0;
        const usePagination = page > 0 && limit > 0;

        // Fetch students
        let studentQuery = User.find(query)
            .select('name email rollNumber branch semester targetBatch isVerified isParticipating _id')
            .sort({ rollNumber: 1 });
        if (usePagination) studentQuery = studentQuery.skip((page - 1) * limit).limit(limit);
        const students = await studentQuery;

        // Total count for pagination header
        const total = usePagination ? await User.countDocuments(query) : students.length;

        // Find which students are in groups
        const groups = await Group.find({}, 'members');
        const groupedStudentIds = new Set();
        groups.forEach(g => {
            if (g.members) {
                g.members.forEach(m => groupedStudentIds.add(m.toString()));
            }
        });

        let studentsWithStatus = students.map(s => ({
            ...s.toObject(),
            isGrouped: groupedStudentIds.has(s._id.toString())
        }));

        // 3. Filter by Status (Grouped / Available)
        if (filterStatus === 'grouped') {
            studentsWithStatus = studentsWithStatus.filter(s => s.isGrouped);
        } else if (filterStatus === 'available') {
            studentsWithStatus = studentsWithStatus.filter(s => !s.isGrouped);
        }

        if (usePagination) {
            res.json({ data: studentsWithStatus, total, page, pages: Math.ceil(total / limit) });
        } else {
            res.json(studentsWithStatus);
        }
    } catch (error) {
        console.error("Error in getAllStudents:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json(user);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const exportFaculty = async (req: Request, res: Response) => {
    try {
        const faculty = await User.find({ role: UserRole.FACULTY })
            .select('name email department expertise maxStudents maxGroups currentStudents currentGroups isVerified photoUrl')
            .lean();

        const data = faculty.map((f: any) => ({
            "Name": f.name,
            "Email": f.email,
            "Department": f.department || 'N/A',
            "Expertise": (f.expertise || []).join(', '),
            "Max Students": f.maxStudents || 21,
            "Max Groups": f.maxGroups || 7,
            "Activated": f.isVerified ? 'Yes' : 'No',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Faculty");
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="faculty_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        console.error("Error exporting faculty:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Remove from groups
        await Group.updateMany({ members: user._id }, { $pull: { members: user._id } });

        await User.findByIdAndDelete(id);
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const uploadProfilePhoto = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        const photoUrl = publicUrlFor(req, file);

        await User.findByIdAndUpdate(userId, { photoUrl });
        res.json({ photoUrl });
    } catch (error) {
        console.error("Error uploading profile photo:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const exportStudents = async (req: Request, res: Response) => {
    try {
        const { batch } = req.query;
        let query: any = { role: UserRole.STUDENT };

        if (batch && typeof batch === 'string' && batch !== 'All') {
            const batchSuffix = batch.slice(-2);
            // Include dropper students in BOTH their original year AND their target year
            // for the student directory export specifically.
            query.$or = [
                { rollNumber: { $regex: `^${batchSuffix}` } },
                { targetBatch: batch }
            ];
        }

        console.log('[exportStudents] batch param:', batch);
        console.log('[exportStudents] query:', JSON.stringify(query, null, 2));

        const students = await User.find(query)
            .select('name email rollNumber branch semester role isVerified targetBatch')
            .sort({ rollNumber: 1 });

        console.log('[exportStudents] found', students.length, 'students');

        if (students.length === 0) {
            return res.status(204).end();
        }

        // Get group status
        const groups = await Group.find({}, 'members name project');
        const studentGroupMap = new Map();

        groups.forEach(g => {
            g.members.forEach(m => {
                studentGroupMap.set(m.toString(), {
                    groupName: g.name,
                    status: g.status
                });
            });
        });

        const data = students.map(s => {
            const groupInfo = studentGroupMap.get(s._id.toString());
            return {
                "Roll Number": s.rollNumber || 'N/A',
                "Name": s.name,
                "Email": s.email,
                "Branch": s.branch || 'N/A',
                "Semester": s.semester || 'N/A',
                "Group Status": groupInfo ? 'In Group' : 'Unassigned',
                "Group Name": groupInfo ? groupInfo.groupName : '',
                "Project Status": groupInfo ? groupInfo.status : ''
            };
        });

        // Create Worksheet
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");

        // Generate Buffer
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        console.log('[exportStudents] buffer size (bytes):', buf.length, '| data rows:', data.length);

        // Set Headers
        res.setHeader('Content-Disposition', `attachment; filename="students_${batch || 'all'}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        res.send(buf);

    } catch (error) {
        console.error("Error exporting students:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const previewImport = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { importType } = req.body; // 'student' or 'faculty'
        if (importType !== 'student' && importType !== 'faculty') {
            return res.status(400).json({ message: 'Invalid import type' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Clean up file immediately after reading
        fs.unlinkSync(req.file.path);

        const existingUsers = await User.find({}).select('email rollNumber');
        const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
        const existingRolls = new Set(existingUsers.map(u => u.rollNumber?.toString().toLowerCase()).filter(Boolean));

        const validRows: any[] = [];
        const invalidRows: any[] = [];
        const newEmails = new Set();
        const newRolls = new Set();

        data.forEach((row: any, index: number) => {
            // Find key intuitively (case-insensitive)
            const getVal = (keyStr: string) => {
                const matchedKey = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === keyStr.toLowerCase().replace(/[^a-z0-9]/g, ''));
                return matchedKey ? row[matchedKey]?.toString().trim() : '';
            };

            const name = getVal('name') || getVal('fullname');
            const email = getVal('email') || getVal('emailid');
            const rollNumber = importType === 'student' ? (getVal('rollnumber') || getVal('rollno') || getVal('roll')) : undefined;
            const branch = getVal('branch') || getVal('department') || getVal('dept');
            const semester = getVal('semester') || getVal('sem') || '1';

            if (!name) {
                invalidRows.push({ rowNumber: index + 2, data: row, reason: 'Name is required' });
                return;
            }
            if (!email) {
                invalidRows.push({ rowNumber: index + 2, data: row, reason: 'Email is required' });
                return;
            }
            if (importType === 'student' && !rollNumber) {
                invalidRows.push({ rowNumber: index + 2, data: row, reason: 'Roll Number is required for students' });
                return;
            }

            const cleanEmail = email.toLowerCase();
            if (existingEmails.has(cleanEmail) || newEmails.has(cleanEmail)) {
                invalidRows.push({ rowNumber: index + 2, data: row, reason: 'Email already exists or duplicated in file' });
                return;
            }

            if (importType === 'student') {
                const cleanRoll = rollNumber.toLowerCase();
                if (existingRolls.has(cleanRoll) || newRolls.has(cleanRoll)) {
                    invalidRows.push({ rowNumber: index + 2, data: row, reason: 'Roll Number already exists or duplicated in file' });
                    return;
                }
                newRolls.add(cleanRoll);
            }

            newEmails.add(cleanEmail);

            validRows.push({
                name,
                email: cleanEmail,
                role: importType === 'student' ? 'Student' : 'Faculty',
                rollNumber,
                branch: branch || 'CSE',
                semester: importType === 'student' ? Number(semester) || 1 : undefined,
                department: importType === 'faculty' ? branch || 'Computer Science' : undefined,
                expertise: importType === 'faculty' ? getVal('expertise') || 'General' : undefined
            });
        });

        res.json({
            validRows,
            invalidRows,
            totalRows: data.length
        });
    } catch (error) {
        console.error("Error previewing import:", error);
        res.status(500).json({ message: 'Server error parsing file', error });
    }
};

export const commitImport = async (req: Request, res: Response) => {
    try {
        const { validRows } = req.body;
        if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
            return res.status(400).json({ message: 'No valid rows provided' });
        }

        const defaultPassword = await bcrypt.hash('changeme', 10);

        // Determine participating batches once for this import run
        const activeBatches = await getActiveParticipatingBatches();

        let created = 0;
        const errors: { email: string; name: string; reason: string }[] = [];

        for (const row of validRows) {
            try {
                // Students: mark participating if their roll number batch matches an active GF event
                const isParticipating = row.role === 'Faculty'
                    ? true
                    : studentBatchParticipates(row.rollNumber, activeBatches);

                await User.create({
                    ...row,
                    password: defaultPassword,
                    isParticipating,
                    isVerified: false,
                    mustChangePassword: true
                });
                created++;
            } catch (err: any) {
                const reason = err.code === 11000
                    ? 'Duplicate email or roll number'
                    : (err.message || 'Unknown error');
                errors.push({ email: row.email, name: row.name, reason });
            }
        }

        res.status(201).json({
            message: `Imported ${created} of ${validRows.length} users`,
            created,
            total: validRows.length,
            errors
        });
    } catch (error) {
        console.error("Error committing import:", error);
        res.status(500).json({ message: 'Server error importing data', error });
    }
};
