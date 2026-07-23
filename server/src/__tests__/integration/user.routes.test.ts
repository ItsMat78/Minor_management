/**
 * Integration tests for /api/users routes.
 * Covers faculty listing, student listing, admin user management, and the
 * unauthenticated ping endpoint.
 */
import request from 'supertest';
import * as XLSX from 'xlsx';
import app from '../../app';
import User from '../../models/User';
import { createTestUser, generateToken, createTestGroup } from '../helpers/factories';
import { UserRole } from '../../models/User';

// Build an in-memory .xlsx buffer from an array-of-objects (header row inferred from keys).
function buildXlsx(rows: Record<string, any>[]): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

// ── GET /api/users/ping ───────────────────────────────────────────────────────

describe('GET /api/users/ping', () => {
    it('returns 200 without authentication', async () => {
        const res = await request(app).get('/api/users/ping');
        expect(res.status).toBe(200);
        expect(res.body.message).toBeDefined();
    });
});

// ── GET /api/users/faculty ────────────────────────────────────────────────────

describe('GET /api/users/faculty', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).get('/api/users/faculty');
        expect(res.status).toBe(401);
    });

    it('returns the faculty list for authenticated users', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT001' });
        await createTestUser({ role: UserRole.FACULTY, email: 'fac@t.ac.in', name: 'Test Faculty' });

        const res = await request(app)
            .get('/api/users/faculty')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // getFaculty selects specific fields — role is intentionally omitted from the projection
        // Verify at least one entry has the expected name
        const names = res.body.map((u: any) => u.name);
        expect(names).toContain('Test Faculty');
    });

    it('does not expose passwords in the faculty list', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT002' });
        await createTestUser({ role: UserRole.FACULTY, email: 'fac2@t.ac.in' });

        const res = await request(app)
            .get('/api/users/faculty')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        for (const f of res.body) {
            expect(f.password).toBeUndefined();
        }
    });
});

// ── GET /api/users/students ───────────────────────────────────────────────────

describe('GET /api/users/students', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).get('/api/users/students');
        expect(res.status).toBe(401);
    });

    it('returns students for an authenticated admin', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT010', email: 'st@t.ac.in' });

        const res = await request(app)
            .get('/api/users/students')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        // Admin gets paginated or array response
        const students = Array.isArray(res.body) ? res.body : res.body.data;
        expect(Array.isArray(students)).toBe(true);
    });

    it('scopes results to the same batch for a student caller', async () => {
        const caller = await createTestUser({
            role: UserRole.STUDENT,
            rollNumber: '23IT099',
            email: 'caller@t.ac.in',
        });
        await createTestUser({
            role: UserRole.STUDENT,
            rollNumber: '24IT001',
            email: 'other_batch@t.ac.in',
        });

        const res = await request(app)
            .get('/api/users/students')
            .set('x-auth-token', generateToken(caller));
        expect(res.status).toBe(200);
        const students = Array.isArray(res.body) ? res.body : res.body.data;
        // All returned students should be from the 2023 batch
        const rollNumbers: string[] = students.map((s: any) => s.rollNumber).filter(Boolean);
        const allFrom2023 = rollNumbers.every((r: string) => r.startsWith('23'));
        expect(allFrom2023).toBe(true);
    });

    it('still returns a student whose targetBatch was cleared to an empty string', async () => {
        // Regression: an admin edit that blanks the batch override stores '' rather than
        // unsetting it. '' is neither null nor a year, so a cohort query matching only
        // null/missing dropped the student from every directory — including their own.
        const caller = await createTestUser({
            role: UserRole.STUDENT,
            rollNumber: '231020202',
            email: 'blank_target@t.ac.in',
        });
        await User.updateOne({ _id: caller._id }, { $set: { targetBatch: '' } });

        const res = await request(app)
            .get('/api/users/students')
            .set('x-auth-token', generateToken(caller));

        expect(res.status).toBe(200);
        const students = Array.isArray(res.body) ? res.body : res.body.data;
        const ids = students.map((s: any) => String(s._id));
        expect(ids).toContain(String(caller._id));
    });
});

// ── PUT /api/users/:id (admin) ────────────────────────────────────────────────

describe('PUT /api/users/:id', () => {
    it('returns 401 without authentication', async () => {
        const target = await createTestUser({ email: 'target@t.ac.in' });
        const res = await request(app).put(`/api/users/${target._id}`).send({ name: 'New' });
        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const target = await createTestUser({ email: 'target2@t.ac.in' });

        const res = await request(app)
            .put(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(student))
            .send({ name: 'Hacked' });
        expect(res.status).toBe(403);
    });

    it('allows admin to update a user\'s name', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const target = await createTestUser({ email: 'update_me@t.ac.in', name: 'Old Name' });

        const res = await request(app)
            .put(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'New Name' });
        expect(res.status).toBe(200);

        const updated = await User.findById(target._id);
        expect(updated!.name).toBe('New Name');
    });

    it('re-derives a student\'s branch when their roll number changes', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const target = await createTestUser({ email: 'roll_change@t.ac.in', rollNumber: '231000012' });
        await User.findByIdAndUpdate(target._id, { branch: 'CSE' });

        // 5th digit 0 -> 1 means CSE -> ECE. The client still posts the stale branch.
        const res = await request(app)
            .put(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ rollNumber: '231010012', branch: 'CSE' });
        expect(res.status).toBe(200);

        const updated = await User.findById(target._id);
        expect(updated!.rollNumber).toBe('231010012');
        expect(updated!.branch).toBe('ECE');
    });

    it('unsets targetBatch rather than storing a blank when the override is cleared', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const target = await createTestUser({ email: 'clear_target@t.ac.in', rollNumber: '231020202' });
        await User.updateOne({ _id: target._id }, { $set: { targetBatch: '2022' } });

        const res = await request(app)
            .put(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ targetBatch: '' });

        expect(res.status).toBe(200);
        const saved = await User.findById(target._id).lean();
        expect(saved?.targetBatch).toBeUndefined();
    });

    it('rejects a roll number whose branch digit is unrecognised', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const target = await createTestUser({ email: 'bad_roll@t.ac.in', rollNumber: '231000012' });
        await User.findByIdAndUpdate(target._id, { branch: 'CSE' });

        const res = await request(app)
            .put(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ rollNumber: '231090012' });
        expect(res.status).toBe(400);

        const updated = await User.findById(target._id);
        expect(updated!.rollNumber).toBe('231000012');
        expect(updated!.branch).toBe('CSE');
    });

    it('leaves a hand-set branch alone when the roll number is unchanged', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const target = await createTestUser({ email: 'same_roll@t.ac.in', rollNumber: 'LEGACY' });
        await User.findByIdAndUpdate(target._id, { branch: 'DSAI' });

        const res = await request(app)
            .put(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'Renamed', rollNumber: 'LEGACY', branch: 'DSAI' });
        expect(res.status).toBe(200);

        const updated = await User.findById(target._id);
        expect(updated!.name).toBe('Renamed');
        expect(updated!.branch).toBe('DSAI');
    });
});

// ── PUT /api/users/me (self-service) ──────────────────────────────────────────

describe('PUT /api/users/me', () => {
    it('lets a faculty edit their own descriptive fields', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(faculty))
            .send({ name: 'Dr. Renamed', department: 'CSE', expertise: ['IoT'] });

        expect(res.status).toBe(200);
        const updated = await User.findById(faculty._id);
        expect(updated!.name).toBe('Dr. Renamed');
        expect(updated!.department).toBe('CSE');
        expect(updated!.expertise).toEqual(['IoT']);
    });

    // Mentored branches decide which students can pick a supervisor, so they are
    // admin-controlled — a faculty must not be able to widen their own reach.
    it('ignores a faculty attempt to change their own mentored branches', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(faculty._id, { branch: 'CSE' });

        const res = await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(faculty))
            .send({ name: 'Dr. Who', branch: 'CSE,DSAI,ECE' });

        expect(res.status).toBe(200);
        const updated = await User.findById(faculty._id);
        expect(updated!.name).toBe('Dr. Who');
        expect(updated!.branch).toBe('CSE');
    });

    it('still lets an admin set a faculty\'s branches', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const faculty = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/users/${faculty._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ branch: 'CSE,DSAI' });

        expect(res.status).toBe(200);
        expect((await User.findById(faculty._id))!.branch).toBe('CSE,DSAI');
    });

    it('ignores a student attempt to change their own branch', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23100001' });
        await User.findByIdAndUpdate(student._id, { branch: 'CSE' });

        const res = await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send({ branch: 'DSAI' });

        expect(res.status).toBe(200);
        expect((await User.findById(student._id))!.branch).toBe('CSE');
    });
});

// ── DELETE /api/users/:id (admin) ─────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
    it('returns 403 for a non-admin user', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const target = await createTestUser({ email: 'del_target@t.ac.in' });

        const res = await request(app)
            .delete(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });

    it('allows admin to delete a user', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const target = await createTestUser({ email: 'to_delete@t.ac.in' });

        const res = await request(app)
            .delete(`/api/users/${target._id}`)
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(await User.findById(target._id)).toBeNull();
    });

    it('cleans up the user\'s group membership on deletion', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const { group, members: [member] } = await createTestGroup(1);

        await request(app)
            .delete(`/api/users/${member._id}`)
            .set('x-auth-token', generateToken(admin));

        const updatedGroup = await (await import('../../models/Group')).default.findById(group._id);
        // Group is either dissolved or member was removed
        if (updatedGroup) {
            const memberIds = updatedGroup.members.map((m) => m.toString());
            expect(memberIds).not.toContain(member._id.toString());
        }
        // (group may be null if dissolved when member count hit 0 — both are valid)
    });
});

// ── POST /api/users/import-preview (faculty branch validation) ────────────────

describe('POST /api/users/import-preview — faculty branch', () => {
    it('rejects a faculty row with no branch', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const buf = buildXlsx([{ Name: 'Dr. NoBranch', Email: 'nobranch@t.ac.in', Department: 'Computer Science' }]);

        const res = await request(app)
            .post('/api/users/import-preview')
            .set('x-auth-token', generateToken(admin))
            .field('importType', 'faculty')
            .attach('file', buf, { filename: 'f.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        expect(res.status).toBe(200);
        expect(res.body.validRows).toHaveLength(0);
        expect(res.body.invalidRows).toHaveLength(1);
        expect(res.body.invalidRows[0].reason).toMatch(/branch is required/i);
    });

    it('rejects a faculty row whose branch is not CSE/DSAI/ECE', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const buf = buildXlsx([{ Name: 'Dr. Bad', Email: 'bad@t.ac.in', Branch: 'Mechanical' }]);

        const res = await request(app)
            .post('/api/users/import-preview')
            .set('x-auth-token', generateToken(admin))
            .field('importType', 'faculty')
            .attach('file', buf, { filename: 'f.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        expect(res.status).toBe(200);
        expect(res.body.validRows).toHaveLength(0);
        expect(res.body.invalidRows[0].reason).toMatch(/invalid branch/i);
    });

    it('accepts a faculty row with a valid comma-separated branch and normalizes it', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const buf = buildXlsx([{ Name: 'Dr. Multi', Email: 'multi@t.ac.in', Branch: ' cse , dsai ' }]);

        const res = await request(app)
            .post('/api/users/import-preview')
            .set('x-auth-token', generateToken(admin))
            .field('importType', 'faculty')
            .attach('file', buf, { filename: 'f.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        expect(res.status).toBe(200);
        expect(res.body.invalidRows).toHaveLength(0);
        expect(res.body.validRows).toHaveLength(1);
        expect(res.body.validRows[0].branch).toBe('CSE,DSAI');
    });
});

// ── GET /api/users/import-template ────────────────────────────────────────────

describe('GET /api/users/import-template', () => {
    it('returns an xlsx for the faculty template', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .get('/api/users/import-template?type=faculty')
            .set('x-auth-token', generateToken(admin));

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/spreadsheetml/);
        expect(res.headers['content-disposition']).toMatch(/faculty_import_template\.xlsx/);
    });

    it('is admin-only', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/users/import-template?type=faculty')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });
});
