/**
 * Integration tests for /api/panels routes.
 * Panels are admin-managed; faculty can read their own evaluation assignments.
 */
import request from 'supertest';
import app from '../../app';
import Panel from '../../models/Panel';
import { createTestUser, generateToken } from '../helpers/factories';
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

// ── Access control ────────────────────────────────────────────────────────────

describe('Panel route access control', () => {
    it('GET /api/panels returns 401 for unauthenticated requests', async () => {
        const res = await request(app).get('/api/panels');
        expect(res.status).toBe(401);
    });

    it('POST /api/panels returns 403 for Faculty (admin-only endpoint)', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY });
        const res = await request(app)
            .post('/api/panels')
            .set('x-auth-token', generateToken(faculty))
            .send({ faculty: [], batchYear: 2023 });
        expect(res.status).toBe(403);
    });

    it('POST /api/panels returns 403 for Student', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .post('/api/panels')
            .set('x-auth-token', generateToken(student))
            .send({ faculty: [], batchYear: 2023 });
        expect(res.status).toBe(403);
    });

    it('GET /api/panels/my-panels returns 403 for Student', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/panels/my-panels')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });
});

// ── POST /api/panels ──────────────────────────────────────────────────────────

describe('POST /api/panels', () => {
    it('returns 400 when required fields are missing', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/panels')
            .set('x-auth-token', generateToken(admin))
            .send({ batchYear: 2023 }); // missing faculty
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/missing required/i);
    });

    it('creates a panel with faculty and batchYear', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const faculty1 = await createTestUser({ role: UserRole.FACULTY, email: 'f1@t.ac.in' });
        const faculty2 = await createTestUser({ role: UserRole.FACULTY, email: 'f2@t.ac.in' });

        const res = await request(app)
            .post('/api/panels')
            .set('x-auth-token', generateToken(admin))
            .send({
                faculty: [faculty1._id.toString(), faculty2._id.toString()],
                batchYear: 2023,
                room: 'Lab A',
            });
        expect(res.status).toBe(201);
        expect(res.body.batchYear).toBe(2023);
        expect(res.body.room).toBe('Lab A');
        expect(res.body.faculty).toHaveLength(2);
    });

    it('creates a panel without a room (optional field)', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'f3@t.ac.in' });

        const res = await request(app)
            .post('/api/panels')
            .set('x-auth-token', generateToken(admin))
            .send({ faculty: [faculty._id.toString()], batchYear: 2024 });
        expect(res.status).toBe(201);
        expect(res.body.room).toBeUndefined();
    });
});

// ── GET /api/panels ───────────────────────────────────────────────────────────

describe('GET /api/panels', () => {
    it('returns an array of panels for admin', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'f4@t.ac.in' });

        // Create one panel
        await Panel.create({ faculty: [faculty._id], batchYear: 2023 });

        const res = await request(app)
            .get('/api/panels')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('filters panels by batchYear query param', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'f5@t.ac.in' });

        await Panel.create({ faculty: [faculty._id], batchYear: 2022 });
        await Panel.create({ faculty: [faculty._id], batchYear: 2023 });

        const res = await request(app)
            .get('/api/panels?batchYear=2022')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        const years = res.body.map((p: any) => p.batchYear);
        expect(years.every((y: number) => y === 2022)).toBe(true);
    });
});

// ── PUT /api/panels/:id ───────────────────────────────────────────────────────

describe('PUT /api/panels/:id', () => {
    it('updates panel faculty and room', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const f1 = await createTestUser({ role: UserRole.FACULTY, email: 'f6@t.ac.in' });
        const f2 = await createTestUser({ role: UserRole.FACULTY, email: 'f7@t.ac.in' });

        const panel = await Panel.create({ faculty: [f1._id], batchYear: 2023 });

        const res = await request(app)
            .put(`/api/panels/${panel._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ faculty: [f1._id.toString(), f2._id.toString()], batchYear: 2023, room: 'Lab B' });
        expect(res.status).toBe(200);
        expect(res.body.room).toBe('Lab B');
        expect(res.body.faculty).toHaveLength(2);
    });

    it('returns 404 for a non-existent panel id', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const fakeId = '000000000000000000000000';
        const res = await request(app)
            .put(`/api/panels/${fakeId}`)
            .set('x-auth-token', generateToken(admin))
            .send({ faculty: [], batchYear: 2023 });
        expect(res.status).toBe(404);
    });
});

// ── DELETE /api/panels/:id ────────────────────────────────────────────────────

describe('DELETE /api/panels/:id', () => {
    it('deletes an existing panel', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'f8@t.ac.in' });
        const panel = await Panel.create({ faculty: [faculty._id], batchYear: 2023 });

        const res = await request(app)
            .delete(`/api/panels/${panel._id}`)
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(await Panel.findById(panel._id)).toBeNull();
    });

    it('returns 403 for non-admin', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'f9@t.ac.in' });
        const panel = await Panel.create({ faculty: [faculty._id], batchYear: 2023 });

        const res = await request(app)
            .delete(`/api/panels/${panel._id}`)
            .set('x-auth-token', generateToken(faculty));
        expect(res.status).toBe(403);
    });
});

// ── GET /api/panels/my-panels ─────────────────────────────────────────────────

describe('GET /api/panels/my-panels', () => {
    it('returns 200 for a faculty member', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'f10@t.ac.in' });
        const res = await request(app)
            .get('/api/panels/my-panels')
            .set('x-auth-token', generateToken(faculty));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 200 for an admin', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .get('/api/panels/my-panels')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
    });
});
