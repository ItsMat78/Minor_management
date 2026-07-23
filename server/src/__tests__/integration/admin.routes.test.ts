/**
 * Integration tests for /api/admin routes.
 * All routes require Admin role — tests verify access control and core operations.
 */
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCompleteEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

// ── Access control (all admin routes return 403 for non-admins) ───────────────

describe('Admin route access control', () => {
    const nonAdminCases: [string, string, string][] = [
        ['GET',  '/api/admin/stats',       'returns 401 for unauthenticated requests'],
        ['GET',  '/api/admin/archive',     'returns 401 for unauthenticated requests'],
        ['POST', '/api/admin/create',      'returns 401 for unauthenticated requests'],
        ['POST', '/api/admin/create-user', 'returns 401 for unauthenticated requests'],
    ];

    it.each(nonAdminCases)('%s %s — %s', async (method, path) => {
        const res = await (request(app) as any)[method.toLowerCase()](path);
        expect(res.status).toBe(401);
    });

    it('returns 403 for a logged-in Student on GET /api/admin/stats', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/admin/stats')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });

    it('returns 403 for a logged-in Faculty on GET /api/admin/stats', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY });
        const res = await request(app)
            .get('/api/admin/stats')
            .set('x-auth-token', generateToken(faculty));
        expect(res.status).toBe(403);
    });
});

// ── GET /api/admin/stats ─────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
    it('returns stats object with expected keys', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .get('/api/admin/stats')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('students');
        expect(res.body).toHaveProperty('faculty');
        expect(res.body).toHaveProperty('groups');
        expect(res.body).toHaveProperty('projects');
        expect(res.body).toHaveProperty('groupsByStatus');
    });

    it('reflects newly created data accurately', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await createTestUser({ role: UserRole.STUDENT });
        await createTestUser({ role: UserRole.FACULTY });
        await createTestGroup(1);

        const res = await request(app)
            .get('/api/admin/stats')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        // At least one student, faculty, and group (may include admin itself)
        expect(res.body.students).toBeGreaterThanOrEqual(1);
        expect(res.body.faculty).toBeGreaterThanOrEqual(1);
        expect(res.body.groups).toBeGreaterThanOrEqual(1);
    });
});

// ── POST /api/admin/create-user ──────────────────────────────────────────────

describe('POST /api/admin/create-user', () => {
    it('creates a Student account with required fields', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'New Student', email: 'newstudent@iiitnr.ac.in', role: 'Student', rollNumber: '23IT099' });
        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe('newstudent@iiitnr.ac.in');
        expect(res.body.user.password).toBeUndefined();
        expect(res.body.user.mustChangePassword).toBe(true);
    });

    it('creates a Faculty account with required fields', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'New Faculty', email: 'newfac@iiitnr.ac.in', role: 'Faculty' });
        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('Faculty');
        expect(res.body.user.isVerified).toBe(true); // faculty auto-verified
    });

    it('returns 400 when name, email, or role is missing', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ email: 'incomplete@iiitnr.ac.in', role: 'Student' }); // name missing
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
    });

    it('returns 400 when Student is created without rollNumber', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'No Roll', email: 'noroll@iiitnr.ac.in', role: 'Student' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/rollNumber/i);
    });

    it('returns 400 when role is not Student or Faculty', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'Bad Role', email: 'badrole@iiitnr.ac.in', role: 'Superuser' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Student or Faculty/i);
    });

    it('rejects duplicate email', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await createTestUser({ email: 'dup@iiitnr.ac.in', role: UserRole.FACULTY });

        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'Dup', email: 'dup@iiitnr.ac.in', role: 'Faculty' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects duplicate rollNumber', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await createTestUser({ email: 'first@iiitnr.ac.in', rollNumber: '23IT001', role: UserRole.STUDENT });

        const res = await request(app)
            .post('/api/admin/create-user')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'Second', email: 'second@iiitnr.ac.in', role: 'Student', rollNumber: '23IT001' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already exists/i);
    });
});

// ── POST /api/admin/create (admin account) ───────────────────────────────────

describe('POST /api/admin/create', () => {
    it('creates a new Admin account', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .post('/api/admin/create')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'New Admin', email: 'newadmin@iiitnr.ac.in', password: 'Admin@Pass1' });
        expect(res.status).toBe(201);
        expect(res.body.admin.role).toBe('Admin');
        expect(res.body.admin.isVerified).toBe(true);
        expect(res.body.admin.password).toBeUndefined();
    });

    it('returns 400 on duplicate admin email', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: 'existing@iiitnr.ac.in' });
        const res = await request(app)
            .post('/api/admin/create')
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'Dup Admin', email: 'existing@iiitnr.ac.in', password: 'pass' });
        expect(res.status).toBe(400);
    });
});

// ── GET /api/admin/archive ───────────────────────────────────────────────────

describe('GET /api/admin/archive', () => {
    it('returns archive structure with expected keys', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .get('/api/admin/archive')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('groups');
        expect(res.body).toHaveProperty('projects');
        expect(res.body).toHaveProperty('participants');
        expect(res.body).toHaveProperty('panels');
        // Archive is keyed by academic session (refactored from batch-year).
        expect(res.body).toHaveProperty('availableSessions');
    });
});
