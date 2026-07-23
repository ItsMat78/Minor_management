/**
 * Integration tests for /api/groups routes.
 * Tests group creation rules, invite accept/reject, and access control.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';
import { UserRole } from '../../models/User';

// All email functions must return a Promise so .catch() in controllers doesn't throw.
// Auto-mocking returns undefined which breaks controller code like sendGroupCreationEmail(...).catch(...)
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

describe('POST /api/groups', () => {
    it('returns 401 when called without authentication', async () => {
        const res = await request(app).post('/api/groups').send({});
        expect(res.status).toBe(401);
    });

    it('creates a solo group for a student with no invited members', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const token = generateToken(student);

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', token)
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.members).toHaveLength(1);
        expect(res.body.status).toBe('Forming');
    });

    it('prevents a student from creating a second group', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const token = generateToken(student);

        await request(app).post('/api/groups').set('x-auth-token', token).send({});
        const res = await request(app).post('/api/groups').set('x-auth-token', token).send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already in a group/i);
    });

    it('rejects creation when total members (creator + invitees) would exceed 3', async () => {
        const creator = await createTestUser({ email: 'creator@t.ac.in', role: UserRole.STUDENT });
        const m1 = await createTestUser({ email: 'm1@t.ac.in', role: UserRole.STUDENT });
        const m2 = await createTestUser({ email: 'm2@t.ac.in', role: UserRole.STUDENT });
        const m3 = await createTestUser({ email: 'm3@t.ac.in', role: UserRole.STUDENT });
        const token = generateToken(creator);

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', token)
            .send({ members: [m1._id.toString(), m2._id.toString(), m3._id.toString()] }); // 4 total

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/exceed 3/i);
    });

    it('places invited members in pendingMembers, not members', async () => {
        const creator = await createTestUser({ email: 'lead@t.ac.in', role: UserRole.STUDENT });
        const invitee = await createTestUser({ email: 'inv@t.ac.in', role: UserRole.STUDENT });
        const token = generateToken(creator);

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', token)
            .send({ members: [invitee._id.toString()] });

        expect(res.status).toBe(201);
        expect(res.body.members).toHaveLength(1); // only creator is accepted
        expect(res.body.pendingMembers).toHaveLength(1); // invitee is pending
    });

    it('prevents inviting a user who already has a pending invite elsewhere', async () => {
        const a = await createTestUser({ email: 'a@t.ac.in', role: UserRole.STUDENT });
        const b = await createTestUser({ email: 'b@t.ac.in', role: UserRole.STUDENT });
        const c = await createTestUser({ email: 'c@t.ac.in', role: UserRole.STUDENT });

        // a invites b
        await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(a))
            .send({ members: [b._id.toString()] });

        // c tries to invite b (already pending in a's group)
        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(c))
            .send({ members: [b._id.toString()] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already in a group/i);
    });

    it('numbers a new group from active groups only, ignoring archived past-session groups', async () => {
        // Regression: 94 archived groups from a finished session must not push the next
        // number to 95 — archived groups belong to past sessions and reserve nothing.
        const archived = new Group({
            name: '94', members: [], status: 'Dissolved',
            isArchived: true, targetBatch: '2023', archivedSession: 'Even 2022-23',
        });
        await archived.save();

        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT099' });
        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(student))
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('1'); // not '95'
    });

    it('still continues numbering after active groups in the same batch', async () => {
        const active = new Group({ name: '1', members: [], status: 'Approved', targetBatch: '2023' });
        await active.save();

        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT099' });
        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(student))
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('2');
    });
});

describe('POST /api/groups/:id/accept', () => {
    it('moves the user from pendingMembers to members', async () => {
        const { group, members: [creator] } = await createTestGroup(1);
        const invitee = await createTestUser({ email: 'invitee@t.ac.in' });

        // Add invitee as pending directly in DB (bypasses group creation invite flow)
        group.pendingMembers.push(invitee._id as any);
        await group.save();

        const res = await request(app)
            .post(`/api/groups/${group._id}/accept`)
            .set('x-auth-token', generateToken(invitee));

        expect(res.status).toBe(200);
        const updated = await Group.findById(group._id);
        const memberIds = updated!.members.map(m => m.toString());
        const pendingIds = updated!.pendingMembers.map(m => m.toString());
        expect(memberIds).toContain(invitee._id.toString());
        expect(pendingIds).not.toContain(invitee._id.toString());

        // Suppress unused variable warning
        void creator;
    });

    it('returns 403 when the user has no pending invite for the group', async () => {
        const { group } = await createTestGroup(1);
        const outsider = await createTestUser({ email: 'outsider@t.ac.in' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/accept`)
            .set('x-auth-token', generateToken(outsider));

        expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent group id', async () => {
        const user = await createTestUser();
        const fakeId = '000000000000000000000000';
        const res = await request(app)
            .post(`/api/groups/${fakeId}/accept`)
            .set('x-auth-token', generateToken(user));
        expect(res.status).toBe(404);
    });
});

describe('POST /api/groups/:id/reject', () => {
    it('removes the user from pendingMembers on rejection', async () => {
        const { group } = await createTestGroup(1);
        const invitee = await createTestUser({ email: 'rejectme@t.ac.in' });

        group.pendingMembers.push(invitee._id as any);
        await group.save();

        const res = await request(app)
            .post(`/api/groups/${group._id}/reject`)
            .set('x-auth-token', generateToken(invitee));

        expect(res.status).toBe(200);
        const updated = await Group.findById(group._id);
        const pendingIds = updated!.pendingMembers.map(m => m.toString());
        expect(pendingIds).not.toContain(invitee._id.toString());
    });

    it('returns 403 when the user was not invited', async () => {
        const { group } = await createTestGroup(1);
        const stranger = await createTestUser({ email: 'stranger@t.ac.in' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/reject`)
            .set('x-auth-token', generateToken(stranger));

        expect(res.status).toBe(403);
    });
});

describe('POST /api/groups/leave', () => {
    it('blocks leaving once a proposal has been sent (Pending)', async () => {
        // Regression: a sent proposal (Pending or Approved) must lock the group —
        // previously only Approved blocked, so members could leave with a proposal pending.
        const { group, members: [student] } = await createTestGroup(2);
        await createTestProject(group._id, { status: 'Pending' });
        group.status = 'ProposalPending';
        await group.save();

        const res = await request(app)
            .post('/api/groups/leave')
            .set('x-auth-token', generateToken(student))
            .send({ password: 'Password123!' });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/pending or accepted/i);
        const updated = await Group.findById(group._id);
        expect(updated!.members.map(m => m.toString())).toContain(student._id.toString());
    });

    it('allows leaving when only a Draft proposal exists', async () => {
        const { group, members: [student] } = await createTestGroup(2);
        await createTestProject(group._id, { status: 'Draft' });

        const res = await request(app)
            .post('/api/groups/leave')
            .set('x-auth-token', generateToken(student))
            .send({ password: 'Password123!' });

        expect(res.status).toBe(200);
        const updated = await Group.findById(group._id);
        expect(updated!.members.map(m => m.toString())).not.toContain(student._id.toString());
    });
});

describe('GET /api/groups (admin-only)', () => {
    it('returns 403 for a non-admin user', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/groups')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });

    it('returns group list for an admin user', async () => {
        await createTestGroup(1);
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .get('/api/groups')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        // Response may be an array or paginated object
        const groups = Array.isArray(res.body) ? res.body : res.body.data;
        expect(groups.length).toBeGreaterThanOrEqual(1);
    });
});
