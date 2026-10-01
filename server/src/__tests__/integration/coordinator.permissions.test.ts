/**
 * Coordinator role: a separate account with a subset of admin powers. Checks the permission split
 * route by route, and that deactivated/expired coordinators are locked out (including tokens
 * issued before deactivation).
 */
import request from 'supertest';
import app from '../../app';
import User, { UserRole } from '../../models/User';
import { createTestUser, generateToken } from '../helpers/factories';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const asUser = (user: any) => {
    const token = generateToken(user);
    return {
        get: (url: string) => request(app).get(url).set('x-auth-token', token),
        post: (url: string, body: any = {}) => request(app).post(url).set('x-auth-token', token).send(body),
        put: (url: string, body: any = {}) => request(app).put(url).set('x-auth-token', token).send(body),
        delete: (url: string) => request(app).delete(url).set('x-auth-token', token),
    };
};

const makeCoordinator = (overrides: any = {}) =>
    createTestUser({ role: UserRole.COORDINATOR, name: 'Coord', ...overrides });

describe('Coordinator permissions', () => {
    it('can reach the semester-running endpoints', async () => {
        const c = asUser(await makeCoordinator());
        for (const url of ['/api/admin/stats', '/api/admin/archive', '/api/events', '/api/groups', '/api/panels',
            '/api/projects/admin/proposals', '/api/panels/admin-eval-panels', '/api/admin/default-faculty-limits']) {
            const res = await c.get(url);
            expect([url, res.status]).not.toEqual([url, 403]);
            expect(res.status).toBeLessThan(500);
        }
    });

    it('is refused on admin-only endpoints', async () => {
        const c = asUser(await makeCoordinator());
        const target = await createTestUser({ rollNumber: '23IT050' });
        const refused = await Promise.all([
            c.post('/api/admin/semester-rollover', { confirm: 'ROLLOVER', password: 'x' }),
            c.post('/api/admin/create', { name: 'x', email: 'x@t.ac.in', password: 'Password123!' }),
            c.post('/api/admin/create-user', {}),
            c.get('/api/admin/coordinators'),
            c.post('/api/admin/coordinators', {}),
            c.put('/api/admin/default-faculty-limits', { defaultMaxStudents: 1 }),
            c.get('/api/admin/audit'),
            c.get('/api/admin/audit/verify'),
            c.get('/api/import/snapshot/export'),
            c.post('/api/import/excel/commit', {}),
            c.put(`/api/users/${target._id}`, { name: 'Changed' }),
            c.delete(`/api/users/${target._id}`),
            c.post('/api/users/import-commit', {}),
            c.delete('/api/events/000000000000000000000000'),
        ]);
        refused.forEach(res => expect(res.status).toBe(403));
        expect((await User.findById(target._id))!.name).not.toBe('Changed');
    });

    it('cannot be used by faculty or students for staff endpoints', async () => {
        const f = asUser(await createTestUser({ role: UserRole.FACULTY }));
        const s = asUser(await createTestUser({ rollNumber: '23IT051' }));
        expect((await f.get('/api/admin/stats')).status).toBe(403);
        expect((await s.get('/api/groups')).status).toBe(403);
    });
});

describe('Coordinator account lifecycle', () => {
    it('admin creates, lists and deactivates a coordinator', async () => {
        const admin = asUser(await createTestUser({ role: UserRole.ADMIN }));
        const created = await admin.post('/api/admin/coordinators', { name: 'Dr. Coord', email: 'Coord.2026@T.ac.in', password: 'Password123!' });
        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ name: 'Dr. Coord', email: 'coord.2026@t.ac.in', isActive: true });

        const stored = await User.findById(created.body._id);
        expect(stored!.role).toBe(UserRole.COORDINATOR);
        expect(stored!.mustChangePassword).toBe(true);

        const list = await admin.get('/api/admin/coordinators');
        expect(list.body.map((c: any) => c.email)).toEqual(['coord.2026@t.ac.in']);

        const off = await admin.put(`/api/admin/coordinators/${created.body._id}`, { isDeactivated: true });
        expect(off.body.isActive).toBe(false);
    });

    it('rejects a coordinator account reusing an existing email', async () => {
        await createTestUser({ role: UserRole.FACULTY, email: 'prof@t.ac.in' });
        const admin = asUser(await createTestUser({ role: UserRole.ADMIN }));
        const res = await admin.post('/api/admin/coordinators', { name: 'Prof', email: 'prof@t.ac.in', password: 'Password123!' });
        expect(res.status).toBe(400);
    });

    it('locks out a deactivated coordinator, even with an earlier token', async () => {
        const coordinator = await makeCoordinator({ email: 'c@t.ac.in', password: 'Password123!' });
        const c = asUser(coordinator);
        expect((await c.get('/api/admin/stats')).status).toBe(200);

        await User.findByIdAndUpdate(coordinator._id, { isDeactivated: true });
        expect((await c.get('/api/admin/stats')).status).toBe(401);
        const login = await request(app).post('/api/auth/login').send({ email: 'c@t.ac.in', password: 'Password123!' });
        expect(login.status).toBe(403);
    });

    it('locks out a coordinator past validUntil', async () => {
        const coordinator = await makeCoordinator();
        await User.findByIdAndUpdate(coordinator._id, { validUntil: new Date(Date.now() - 1000) });
        expect((await asUser(coordinator).get('/api/admin/stats')).status).toBe(401);
    });
});
