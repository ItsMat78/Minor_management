/**
 * What a row in the audit trail says about the action behind it.
 *
 * The trail used to answer "who opened what page". These cover the part that makes it answer
 * "who did what": a semantic action label per route, and a redacted copy of what was sent.
 * Redaction and key-sanitising are the load-bearing bits — one leaked password, or one key
 * Mongo reshapes on write, and the feature is worse than not having it.
 */
import request from 'supertest';
import app from '../../app';
import AuditLog from '../../models/AuditLog';
import { hashRecord } from '../../utils/audit';
import { getAuditLog } from '../../controllers/adminController';
import { createTestUser, generateToken } from '../helpers/factories';
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

/**
 * The middleware appends from res.on('finish') without blocking the response, so the row lands
 * shortly after supertest resolves. Poll rather than sleep a fixed amount.
 */
const waitForAudit = async (filter: any): Promise<any> => {
    for (let i = 0; i < 100; i++) {
        const row = await AuditLog.findOne(filter).sort({ seq: -1 }).lean();
        if (row) return row;
        await new Promise(r => setTimeout(r, 20));
    }
    throw new Error(`no audit row matched ${JSON.stringify(filter)}`);
};

describe('audit trail — action labels', () => {
    it('names the route rather than logging a raw method and path', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT900' });

        await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send({ name: 'Renamed Student' });

        const row = await waitForAudit({ path: '/api/users/me' });
        // Distinct from 'user.update': that one is an admin editing somebody else, and the two
        // must not read the same in a list.
        expect(row.action).toBe('user.profile.selfUpdate');
    });

    it('labels an admin editing another user as user.update, with the target named', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: 'admin-audit@t.ac.in' });
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT901', name: 'Target Student' });

        await request(app)
            .put(`/api/users/${student._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ name: 'Edited By Admin' });

        const row = await waitForAudit({ path: `/api/users/${student._id}` });
        expect(row.action).toBe('user.update');
        // The id is what identifies the target; the name is resolved after the handler has run,
        // so on a rename it is the new name. What the name *was* is in the recorded body.
        expect(row.target).toMatchObject({ type: 'user', id: String(student._id) });
        expect(row.actor).toMatchObject({ name: admin.name, role: UserRole.ADMIN });
        expect(row.meta.request.body).toEqual({ name: 'Edited By Admin' });
    });
});

describe('audit trail — what was sent', () => {
    it('records the values submitted, so a row shows the decision and not just the route', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT902' });

        await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send({ name: 'Renamed Student', branch: 'CSE' });

        const row = await waitForAudit({ path: '/api/users/me' });
        expect(row.meta.request.body).toEqual({ name: 'Renamed Student', branch: 'CSE' });
    });

    it('never stores a password, whichever route carried it', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT903' });

        await request(app)
            .post('/api/auth/change-password')
            .set('x-auth-token', generateToken(student))
            .send({ currentPassword: 'hunter2', newPassword: 'correct-horse' });

        const row = await waitForAudit({ path: '/api/auth/change-password' });
        expect(row.action).toBe('auth.changePassword');
        expect(row.meta.request.body).toEqual({ currentPassword: '[redacted]', newPassword: '[redacted]' });
        expect(JSON.stringify(row)).not.toContain('hunter2');
        expect(JSON.stringify(row)).not.toContain('correct-horse');
    });

    it('names the account a failed login was attempted against, without the password', async () => {
        await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT904', email: 'victim@t.ac.in' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'victim@t.ac.in', password: 'not-the-password' });
        expect(res.status).toBeGreaterThanOrEqual(400);

        const row = await waitForAudit({ path: '/api/auth/login' });
        // A failed login has no signed-in user by definition — the token is only issued on
        // success. The recorded email is what turns that anonymous row into something to act on.
        expect(row.actor).toBeNull();
        expect(row.action).toBe('auth.login');
        expect(row.meta.request.body).toEqual({ email: 'victim@t.ac.in', password: '[redacted]' });
    });

    it('records an upload by filename, never its contents', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT905' });

        await request(app)
            .post('/api/users/profile-photo')
            .set('x-auth-token', generateToken(student))
            .attach('photo', Buffer.from('fake-jpeg-bytes'), { filename: 'holiday-snap.jpg', contentType: 'image/jpeg' });

        const row = await waitForAudit({ path: '/api/users/profile-photo' });
        expect(row.action).toBe('user.photo.set');
        expect(row.meta.request.files).toEqual([
            expect.objectContaining({ field: 'photo', name: 'holiday-snap.jpg' }),
        ]);
        expect(JSON.stringify(row)).not.toContain('fake-jpeg-bytes');
    });

    it('drops keys Mongo would reject instead of writing something it will reshape', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT906' });

        await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send({ name: 'Keeps Me', 'dotted.key': 'dropped', $set: 'dropped' });

        const row = await waitForAudit({ path: '/api/users/me' });
        expect(row.meta.request.body).toEqual({ name: 'Keeps Me' });
    });

    it('truncates a long value instead of dropping the field', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT907' });

        await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send({ name: 'x'.repeat(50_000), branch: 'CSE' });

        const row = await waitForAudit({ path: '/api/users/me' });
        // Free text (feedback, descriptions) is the point of recording bodies at all — keeping
        // the opening of a long one beats recording that a field was merely present.
        expect(row.meta.request.body.name).toMatch(/^x{300}…\(\+49700 chars\)$/);
        expect(row.meta.request.body.branch).toBe('CSE');
    });

    it('falls back to naming the fields when a body is too wide to store', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT912' });
        const wide: Record<string, string> = {};
        for (let i = 0; i < 200; i++) wide[`field${i}`] = 'v'.repeat(100);

        await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send(wide);

        const row = await waitForAudit({ path: '/api/users/me' });
        expect(row.meta.request.body.tooLarge).toBe(true);
        expect(row.meta.request.body.fields).toHaveLength(40);
        expect(row.meta.request.body.fields[0]).toBe('field0');
    });

    it('records nothing extra for a page view', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT908' });

        await request(app).get('/api/users/faculty').set('x-auth-token', generateToken(student));

        const row = await waitForAudit({ path: '/api/users/faculty' });
        expect(row.action).toBe('faculty.list');
        expect(row.meta).toBeUndefined();
    });

    it('leaves the hash chain reproducible with a body attached', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT909' });

        await request(app)
            .put('/api/users/me')
            .set('x-auth-token', generateToken(student))
            .send({ name: 'Chain Check', semester: 4, tags: ['a', 'b'] });

        const row = await waitForAudit({ path: '/api/users/me' });
        // Recomputed from what Mongo handed back: if storing meta reshaped anything, the hash
        // would no longer match and the verifier would read it as tampering.
        expect(hashRecord(row.prevHash, row)).toBe(row.hash);
    });
});

describe('audit trail — separating actions from page views', () => {
    const runQuery = async (query: any): Promise<any> => {
        let out: any;
        const res: any = { json: (x: any) => { out = x; }, status: () => res };
        await getAuditLog({ query } as any, res);
        return out;
    };

    it('kind=writes hides the reads that would otherwise bury them', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT910' });
        const token = generateToken(student);

        await request(app).get('/api/users/faculty').set('x-auth-token', token);
        await request(app).put('/api/users/me').set('x-auth-token', token).send({ name: 'A Write' });
        await waitForAudit({ path: '/api/users/me' });

        const writes = await runQuery({ kind: 'writes' });
        expect(writes.items.length).toBeGreaterThan(0);
        expect(writes.items.every((i: any) => i.method !== 'GET')).toBe(true);

        const reads = await runQuery({ kind: 'reads' });
        expect(reads.items.length).toBeGreaterThan(0);
        expect(reads.items.every((i: any) => i.method === 'GET')).toBe(true);

        // Unfiltered still returns both — the filter is a view, not a retention policy.
        const all = await runQuery({});
        expect(all.total).toBe(writes.total + reads.total);
    });

    it('an explicit method filter still wins over kind', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT911' });
        await request(app).get('/api/users/faculty').set('x-auth-token', generateToken(student));
        await waitForAudit({ path: '/api/users/faculty' });

        const out = await runQuery({ kind: 'writes', method: 'GET' });
        expect(out.items.length).toBeGreaterThan(0);
        expect(out.items.every((i: any) => i.method === 'GET')).toBe(true);
    });
});
