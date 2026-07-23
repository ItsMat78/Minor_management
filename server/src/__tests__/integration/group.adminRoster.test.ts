/**
 * Integration tests for the admin roster endpoints backing the Group Directory:
 *   POST   /api/groups/:id/members
 *   DELETE /api/groups/:id/members/:memberId
 *
 * These deliberately bypass the student-facing invite flow (no Group Formation window,
 * no proposal lock, no accept step), so the tests focus on the invariants that ARE kept:
 * admin-only access, students only, no double-membership, the 3-member cap, archived
 * groups read-only, and never emptying a group.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import { createTestUser, generateToken, createTestGroup } from '../helpers/factories';
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

const adminToken = async () =>
    generateToken(await createTestUser({ role: UserRole.ADMIN }));

describe('POST /api/groups/:id/members', () => {
    it('rejects a non-admin caller', async () => {
        const { group } = await createTestGroup(1);
        const student = await createTestUser({ role: UserRole.STUDENT });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', generateToken(student))
            .send({ members: [String(student._id)] });

        expect(res.status).toBe(403);
    });

    it('adds a student as an accepted member straight away', async () => {
        const { group } = await createTestGroup(1);
        const newcomer = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT099' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(200);
        expect(res.body.group.members).toHaveLength(2);

        const stored = await Group.findById(group._id);
        expect(stored!.members.map(String)).toContain(String(newcomer._id));
        // Straight to members, never parked in pendingMembers.
        expect(stored!.pendingMembers.map(String)).not.toContain(String(newcomer._id));
    });

    it('works after group formation has closed (no active GF event exists in this suite)', async () => {
        const { group } = await createTestGroup(2);
        const newcomer = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT098' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(200);
    });

    it('refuses to exceed the 3-member cap', async () => {
        const { group } = await createTestGroup(3);
        const newcomer = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT097' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/cannot exceed 3/i);
        expect((await Group.findById(group._id))!.members).toHaveLength(3);
    });

    it('refuses a student who is already in another active group', async () => {
        const { group } = await createTestGroup(1);
        const other = await createTestGroup(1);

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(other.members[0]._id)] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already in group/i);
    });

    it('allows a student whose only other group is archived', async () => {
        const { group } = await createTestGroup(1);
        const old = await createTestGroup(1);
        await Group.findByIdAndUpdate(old.group._id, { isArchived: true });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(old.members[0]._id)] });

        expect(res.status).toBe(200);
    });

    it('refuses a faculty account', async () => {
        const { group } = await createTestGroup(1);
        const faculty = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(faculty._id)] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not a student/i);
    });

    it('refuses to modify an archived group', async () => {
        const { group } = await createTestGroup(1);
        await Group.findByIdAndUpdate(group._id, { isArchived: true });
        const newcomer = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT096' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(403);
    });

    it('rejects an empty selection', async () => {
        const { group } = await createTestGroup(1);

        const res = await request(app)
            .post(`/api/groups/${group._id}/members`)
            .set('x-auth-token', await adminToken())
            .send({ members: [] });

        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/groups/:id/members/:memberId', () => {
    it('rejects a non-admin caller', async () => {
        const { group, members } = await createTestGroup(2);

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${members[1]._id}`)
            .set('x-auth-token', generateToken(members[0]));

        expect(res.status).toBe(403);
    });

    it('removes a member and leaves the rest intact', async () => {
        const { group, members } = await createTestGroup(3);

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${members[2]._id}`)
            .set('x-auth-token', await adminToken());

        expect(res.status).toBe(200);
        expect(res.body.group.members).toHaveLength(2);

        const stored = await Group.findById(group._id);
        expect(stored!.members.map(String)).not.toContain(String(members[2]._id));
    });

    it('re-points createdBy at a remaining member when the creator is removed', async () => {
        const { group, members } = await createTestGroup(2);
        expect(String(group.createdBy)).toBe(String(members[0]._id));

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${members[0]._id}`)
            .set('x-auth-token', await adminToken());

        expect(res.status).toBe(200);
        const stored = await Group.findById(group._id);
        expect(String(stored!.createdBy)).toBe(String(members[1]._id));
    });

    it('refuses to remove the last member', async () => {
        const { group, members } = await createTestGroup(1);

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${members[0]._id}`)
            .set('x-auth-token', await adminToken());

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/last member/i);
        expect(await Group.findById(group._id)).not.toBeNull();
    });

    it('withdraws a pending invite', async () => {
        const { group } = await createTestGroup(1);
        const invitee = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT095' });
        await Group.findByIdAndUpdate(group._id, { $push: { pendingMembers: invitee._id } });

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${invitee._id}`)
            .set('x-auth-token', await adminToken());

        expect(res.status).toBe(200);
        const stored = await Group.findById(group._id);
        expect(stored!.pendingMembers.map(String)).not.toContain(String(invitee._id));
        expect(stored!.members).toHaveLength(1);
    });

    it('404s for someone who is not in the group', async () => {
        const { group } = await createTestGroup(2);
        const stranger = await createTestUser({ role: UserRole.STUDENT });

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${stranger._id}`)
            .set('x-auth-token', await adminToken());

        expect(res.status).toBe(404);
    });

    it('refuses to modify an archived group', async () => {
        const { group, members } = await createTestGroup(2);
        await Group.findByIdAndUpdate(group._id, { isArchived: true });

        const res = await request(app)
            .delete(`/api/groups/${group._id}/members/${members[1]._id}`)
            .set('x-auth-token', await adminToken());

        expect(res.status).toBe(403);
    });
});
