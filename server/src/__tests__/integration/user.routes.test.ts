/**
 * Integration tests for /api/users routes.
 * Covers faculty listing, student listing, admin user management, and the
 * unauthenticated ping endpoint.
 */
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import { createTestUser, generateToken, createTestGroup } from '../helpers/factories';
import { UserRole } from '../../models/User';

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
