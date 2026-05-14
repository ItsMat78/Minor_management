/**
 * Integration tests for /api/import routes.
 * Covers snapshot export/preview/commit, Excel preview (file upload), and Excel commit.
 * All routes require admin auth.
 */
import request from 'supertest';
import * as XLSX from 'xlsx';
import app from '../../app';
import Project from '../../models/Project';
import Group from '../../models/Group';
import User from '../../models/User';
import { createTestUser, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

// Build a minimal IIITNR-format Excel buffer for file-upload tests.
// Format: col A = group number, B = student name, C = roll, D = email,
//         E = project title, F = domain, G = faculty name.
function buildMinimalExcel(): Buffer {
    const data = [
        ['S.No', "Member's Name", 'Roll', 'Email', 'Title', 'Domain', 'Faculty'],
        ['1', '', '', '', 'Imported Project', 'IoT', 'Dr. Import Faculty'],
        ['', 'Import Student', '24BCS099', 'importstudent@iiitnr.edu.in', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Auth guards ───────────────────────────────────────────────────────────────

describe('Import route auth guards', () => {
    it('returns 401 with no token', async () => {
        const res = await request(app).get('/api/import/snapshot/export');
        expect(res.status).toBe(401);
    });

    it('returns 403 for a Student', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/import/snapshot/export')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });

    it('returns 403 for Faculty on excel/commit', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY });
        const res = await request(app)
            .post('/api/import/excel/commit')
            .set('x-auth-token', generateToken(faculty))
            .send({ groups: [] });
        expect(res.status).toBe(403);
    });
});

// ── GET /api/import/snapshot/export ──────────────────────────────────────────

describe('GET /api/import/snapshot/export', () => {
    it('returns an empty projects array when no archived projects exist', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .get('/api/import/snapshot/export')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.projects)).toBe(true);
        expect(res.body.projects).toHaveLength(0);
        expect(res.body.__version).toBeDefined();
        expect(res.body.__exportedAt).toBeDefined();
    });

    it('includes archived projects in the snapshot with correct fields', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Project.create({
            title: 'Old Archived Project',
            description: 'Past work',
            status: 'Approved',
            isArchived: true,
            archivedMentorName: 'Dr. Smith',
            archivedGroupName: 'Group 5',
            archivedBatch: '2022',
            archivedMembers: [
                { name: 'Alice', email: 'alice@iiitnr.edu.in', rollNumber: '22BCS001', branch: 'CSE' },
            ],
        });

        const res = await request(app)
            .get('/api/import/snapshot/export')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(res.body.projects).toHaveLength(1);
        const p = res.body.projects[0];
        expect(p.title).toBe('Old Archived Project');
        expect(p.archivedMentorName).toBe('Dr. Smith');
        expect(p.archivedGroupName).toBe('Group 5');
    });

    it('does not include non-archived projects in the snapshot', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Project.create({ title: 'Active Project', description: 'live', status: 'Approved', isArchived: false });

        const res = await request(app)
            .get('/api/import/snapshot/export')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(res.body.projects).toHaveLength(0);
    });
});

// ── POST /api/import/snapshot/preview ────────────────────────────────────────

describe('POST /api/import/snapshot/preview', () => {
    it('returns 400 if the body is missing a projects array', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/import/snapshot/preview')
            .set('x-auth-token', generateToken(admin))
            .send({ notProjects: [] });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid snapshot format/i);
    });

    it('returns a preview summary for a valid snapshot', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const snapshot = {
            __version: '3.1',
            projects: [
                {
                    title: 'Snap Project A',
                    description: 'desc',
                    status: 'Approved',
                    archivedMentorName: 'Dr. X',
                    archivedGroupName: 'G1',
                    archivedBatch: '2023',
                    archivedMembers: [
                        { name: 'Bob', email: 'bob@iiitnr.edu.in', rollNumber: '23BCS001', branch: 'CSE' },
                    ],
                },
            ],
        };

        const res = await request(app)
            .post('/api/import/snapshot/preview')
            .set('x-auth-token', generateToken(admin))
            .send(snapshot);
        expect(res.status).toBe(200);
        expect(res.body.summary.projects.total).toBe(1);
        expect(res.body.summary.projects.create).toBe(1);
        expect(res.body.summary.projects.skip).toBe(0);
        expect(res.body.projects[0].title).toBe('Snap Project A');
        expect(res.body.projects[0].status).toBe('create');
        expect(res.body.projects[0].memberCount).toBe(1);
    });

    it('marks projects as skip when they already exist in the DB', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Project.create({
            title: 'Existing Project',
            description: 'already there',
            status: 'Approved',
            isArchived: true,
        });

        const snapshot = {
            __version: '3.1',
            projects: [
                { title: 'Existing Project', description: 'desc', archivedMembers: [] },
                { title: 'Brand New Project', description: 'desc', archivedMembers: [] },
            ],
        };

        const res = await request(app)
            .post('/api/import/snapshot/preview')
            .set('x-auth-token', generateToken(admin))
            .send(snapshot);
        expect(res.status).toBe(200);
        expect(res.body.summary.projects.skip).toBe(1);
        expect(res.body.summary.projects.create).toBe(1);
        const statuses = res.body.projects.map((p: any) => p.status);
        expect(statuses).toContain('skip');
        expect(statuses).toContain('create');
    });
});

// ── POST /api/import/snapshot/commit ─────────────────────────────────────────

describe('POST /api/import/snapshot/commit', () => {
    it('returns 400 if the projects array is missing', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/import/snapshot/commit')
            .set('x-auth-token', generateToken(admin))
            .send({});
        expect(res.status).toBe(400);
    });

    it('creates archived projects from the snapshot and persists them in the DB', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const snapshot = {
            __version: '3.1',
            projects: [
                {
                    title: 'Committed Snapshot Project',
                    description: 'A project committed from a snapshot',
                    status: 'Approved',
                    isArchived: true,
                    archivedMentorName: 'Dr. Mentor',
                    archivedGroupName: 'Group 7',
                    archivedBatch: '2023',
                    archivedMembers: [
                        { name: 'Carol', email: 'carol@iiitnr.edu.in', rollNumber: '23BCS002', branch: 'CSE' },
                    ],
                },
            ],
        };

        const res = await request(app)
            .post('/api/import/snapshot/commit')
            .set('x-auth-token', generateToken(admin))
            .send(snapshot);
        expect(res.status).toBe(200);
        expect(res.body.result.projects).toBe(1);
        expect(res.body.errors).toHaveLength(0);

        const saved = await Project.findOne({ title: 'Committed Snapshot Project' });
        expect(saved).not.toBeNull();
        expect(saved?.isArchived).toBe(true);
        expect(saved?.archivedMentorName).toBe('Dr. Mentor');
        expect(saved?.archivedMembers).toHaveLength(1);
    });

    it('skips projects whose title already exists in the DB', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Project.create({
            title: 'Already In DB',
            description: 'existing',
            status: 'Approved',
            isArchived: true,
        });

        const snapshot = {
            __version: '3.1',
            projects: [{ title: 'Already In DB', description: 'desc', archivedMembers: [] }],
        };

        const res = await request(app)
            .post('/api/import/snapshot/commit')
            .set('x-auth-token', generateToken(admin))
            .send(snapshot);
        expect(res.status).toBe(200);
        expect(res.body.result.projects).toBe(0);
        expect(res.body.result.skipped).toBe(1);
    });

    it('imports multiple projects and handles partial duplicates correctly', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Project.create({ title: 'Duplicate Title', description: 'old', status: 'Approved', isArchived: true });

        const snapshot = {
            __version: '3.1',
            projects: [
                { title: 'Duplicate Title', description: 'same title', archivedMembers: [] },
                { title: 'Fresh New Title', description: 'new', archivedMembers: [] },
            ],
        };

        const res = await request(app)
            .post('/api/import/snapshot/commit')
            .set('x-auth-token', generateToken(admin))
            .send(snapshot);
        expect(res.status).toBe(200);
        expect(res.body.result.projects).toBe(1);
        expect(res.body.result.skipped).toBe(1);

        const fresh = await Project.findOne({ title: 'Fresh New Title' });
        expect(fresh).not.toBeNull();
        expect(fresh?.isArchived).toBe(true);
    });
});

// ── POST /api/import/excel/preview ────────────────────────────────────────────

describe('POST /api/import/excel/preview', () => {
    it('returns 400 when no file is provided', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/import/excel/preview')
            .set('x-auth-token', generateToken(admin))
            .field('semester', '4');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no file uploaded/i);
    });

    it('parses a valid IIITNR Excel file and returns a structured preview', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const excelBuf = buildMinimalExcel();

        const res = await request(app)
            .post('/api/import/excel/preview')
            .set('x-auth-token', generateToken(admin))
            .attach('file', excelBuf, {
                filename: 'test.xlsx',
                contentType:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            .field('semester', '4');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.groups)).toBe(true);
        expect(res.body.groups.length).toBeGreaterThanOrEqual(1);
        expect(res.body.summary.totalGroups).toBeGreaterThanOrEqual(1);
        expect(res.body.summary.totalStudents).toBeGreaterThanOrEqual(1);

        const group = res.body.groups[0];
        expect(group.projectTitle).toBe('Imported Project');
        expect(group.students[0].name).toBe('Import Student');
        expect(group.students[0].roll).toBe('24BCS099');
    });
});

// ── POST /api/import/excel/commit ─────────────────────────────────────────────

describe('POST /api/import/excel/commit', () => {
    it('returns 400 when the groups array is empty', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/import/excel/commit')
            .set('x-auth-token', generateToken(admin))
            .send({ groups: [], semester: 4 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no group data/i);
    });

    it('creates new students, faculty, groups, and projects in one commit', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });

        const commitBody = {
            semester: 4,
            groups: [
                {
                    groupNumber: '1',
                    projectTitle: 'Excel Import Project',
                    projectDomain: 'IoT',
                    batchYear: '2024',
                    semester: 4,
                    students: [
                        {
                            name: 'New Excel Student',
                            roll: '24BCS042',
                            email: 'excelstudent@iiitnr.edu.in',
                            branch: 'CSE',
                            status: 'new',
                            existingId: null,
                            inGroup: false,
                            isDropper: false,
                            missingEmail: false,
                        },
                    ],
                    faculty: {
                        name: 'Dr. Excel Faculty',
                        email: 'excelfaculty@iiitnr.edu.in',
                        status: 'new',
                        existingId: null,
                    },
                },
            ],
        };

        const res = await request(app)
            .post('/api/import/excel/commit')
            .set('x-auth-token', generateToken(admin))
            .send(commitBody);
        expect(res.status).toBe(200);
        expect(res.body.created.students).toBe(1);
        expect(res.body.created.faculty).toBe(1);
        expect(res.body.created.groups).toBe(1);
        expect(res.body.created.projects).toBe(1);

        // Verify DB state
        const student = await User.findOne({ rollNumber: '24BCS042' });
        expect(student).not.toBeNull();
        expect(student?.mustChangePassword).toBe(true);
        expect(student?.branch).toBe('CSE');

        const faculty = await User.findOne({ email: 'excelfaculty@iiitnr.edu.in' });
        expect(faculty).not.toBeNull();
        expect(faculty?.role).toBe('Faculty');

        const group = await Group.findOne({ name: '1' });
        expect(group).not.toBeNull();
        expect(group?.status).toBe('Approved');

        const project = await Project.findOne({ title: 'Excel Import Project' });
        expect(project).not.toBeNull();
        expect(project?.status).toBe('Approved');
    });

    it('reuses an existing student when existingId is provided', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const existing = await createTestUser({
            role: UserRole.STUDENT,
            email: 'existing@iiitnr.edu.in',
            name: 'Existing Student',
        });

        const commitBody = {
            semester: 4,
            groups: [
                {
                    groupNumber: '2',
                    projectTitle: 'Existing Student Project',
                    projectDomain: 'ML',
                    batchYear: '2024',
                    semester: 4,
                    students: [
                        {
                            name: existing.name,
                            roll: existing.rollNumber,
                            email: existing.email,
                            branch: 'CSE',
                            status: 'existing',
                            existingId: existing._id.toString(),
                            inGroup: false,
                            isDropper: false,
                            missingEmail: false,
                        },
                    ],
                    faculty: { name: '', email: '', status: 'none', existingId: null },
                },
            ],
        };

        const res = await request(app)
            .post('/api/import/excel/commit')
            .set('x-auth-token', generateToken(admin))
            .send(commitBody);
        expect(res.status).toBe(200);
        expect(res.body.created.students).toBe(0); // existing student — not created
        expect(res.body.created.groups).toBe(1);
        expect(res.body.created.projects).toBe(1);
    });

    it('records an error when a new student has no email and skips that student', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });

        const commitBody = {
            semester: 4,
            groups: [
                {
                    groupNumber: '3',
                    projectTitle: 'No Email Project',
                    projectDomain: 'General',
                    batchYear: '2024',
                    semester: 4,
                    students: [
                        {
                            name: 'No Email Student',
                            roll: '24BCS099',
                            email: '', // missing email — controller should record an error
                            branch: 'CSE',
                            status: 'new',
                            existingId: null,
                            inGroup: false,
                            isDropper: false,
                            missingEmail: true,
                        },
                    ],
                    faculty: { name: '', email: '', status: 'none', existingId: null },
                },
            ],
        };

        const res = await request(app)
            .post('/api/import/excel/commit')
            .set('x-auth-token', generateToken(admin))
            .send(commitBody);
        expect(res.status).toBe(200);
        expect(res.body.created.students).toBe(0);
        // Group is skipped because no valid members were created
        expect(res.body.errors.length).toBeGreaterThan(0);
    });
});
