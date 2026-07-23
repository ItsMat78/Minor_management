/**
 * Integration tests for managing invites on an already-formed group:
 *   - POST /api/groups/:id/cancel-invite  — withdraw an outstanding invite
 *   - POST /api/groups/:id/invite         — add new members to a formed group
 *
 * Pins down the rules: only a current member may manage invites; new invites are
 * allowed only while a Group Formation event is open AND the group has not sent a
 * proposal (Pending/Approved); the 3-member cap counts pending invites; and the
 * per-batch branch restriction is re-enforced for added members.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import Event, { EventType } from '../../models/Event';
import { createTestUser, generateToken, createTestProject } from '../helpers/factories';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCompleteEmail: jest.fn().mockResolvedValue(undefined),
}));

async function makeStudent(rollNumber: string, branch?: string) {
    const u = await createTestUser({ rollNumber, email: `${rollNumber}-${Date.now()}@iiitnr.ac.in` });
    if (branch !== undefined) {
        (u as any).branch = branch;
        await u.save();
    }
    return u;
}

async function makeGFEvent(fields: Partial<{ participatingBatches: string[]; branchRestrictedBatches: string[] }> = {}) {
    return Event.create({
        type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
        isActive: true,
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
        participatingBatches: fields.participatingBatches,
        branchRestrictedBatches: fields.branchRestrictedBatches,
        createdBy: new (require('mongoose').Types.ObjectId)(),
    });
}

async function makeGroup(creatorId: any, opts: { members?: any[]; pending?: any[] } = {}) {
    const group = new Group({
        name: '1',
        members: [creatorId, ...(opts.members ?? [])],
        pendingMembers: opts.pending ?? [],
        createdBy: creatorId,
        status: 'Forming',
        inviteCode: 'TESTCODE',
    });
    return group.save();
}

// ── POST /api/groups/:id/cancel-invite ───────────────────────────────────────

describe('POST /api/groups/:id/cancel-invite', () => {
    it('lets a group member withdraw a pending invite', async () => {
        const creator = await makeStudent('23CSE001', 'CSE');
        const invitee = await makeStudent('23CSE002', 'CSE');
        const group = await makeGroup(creator._id, { pending: [invitee._id] });

        const res = await request(app)
            .post(`/api/groups/${group._id}/cancel-invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ memberId: String(invitee._id) });

        expect(res.status).toBe(200);
        const updated = await Group.findById(group._id);
        expect(updated!.pendingMembers.map(m => String(m))).not.toContain(String(invitee._id));
    });

    it('returns 403 when a non-member tries to cancel an invite', async () => {
        const creator = await makeStudent('23CSE003', 'CSE');
        const invitee = await makeStudent('23CSE004', 'CSE');
        const outsider = await makeStudent('23CSE005', 'CSE');
        const group = await makeGroup(creator._id, { pending: [invitee._id] });

        const res = await request(app)
            .post(`/api/groups/${group._id}/cancel-invite`)
            .set('x-auth-token', generateToken(outsider))
            .send({ memberId: String(invitee._id) });

        expect(res.status).toBe(403);
    });

    it('returns 400 when the target has no pending invite', async () => {
        const creator = await makeStudent('23CSE006', 'CSE');
        const stranger = await makeStudent('23CSE007', 'CSE');
        const group = await makeGroup(creator._id);

        const res = await request(app)
            .post(`/api/groups/${group._id}/cancel-invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ memberId: String(stranger._id) });

        expect(res.status).toBe(400);
    });
});

// ── POST /api/groups/:id/invite ──────────────────────────────────────────────

describe('POST /api/groups/:id/invite', () => {
    it('adds a pending member when GF is open and no proposal has been sent', async () => {
        await makeGFEvent({ participatingBatches: ['2023'] });
        const creator = await makeStudent('23CSE010', 'CSE');
        const newcomer = await makeStudent('23CSE011', 'CSE');
        const group = await makeGroup(creator._id);

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(200);
        const updated = await Group.findById(group._id);
        expect(updated!.pendingMembers.map(m => String(m))).toContain(String(newcomer._id));
    });

    it('blocks inviting once the group has a Pending proposal', async () => {
        await makeGFEvent({ participatingBatches: ['2023'] });
        const creator = await makeStudent('23CSE020', 'CSE');
        const newcomer = await makeStudent('23CSE021', 'CSE');
        const group = await makeGroup(creator._id);
        await createTestProject(group._id, { status: 'Pending' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/withdraw|rejected/i);
    });

    it('allows inviting when the only proposal is a Draft (not sent)', async () => {
        await makeGFEvent({ participatingBatches: ['2023'] });
        const creator = await makeStudent('23CSE025', 'CSE');
        const newcomer = await makeStudent('23CSE026', 'CSE');
        const group = await makeGroup(creator._id);
        await createTestProject(group._id, { status: 'Draft' });

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(200);
    });

    it('blocks inviting when group formation is not open', async () => {
        // No active GF event created.
        const creator = await makeStudent('23CSE030', 'CSE');
        const newcomer = await makeStudent('23CSE031', 'CSE');
        const group = await makeGroup(creator._id);

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not currently open/i);
    });

    it('enforces the 3-member cap including pending invites', async () => {
        await makeGFEvent({ participatingBatches: ['2023'] });
        const creator = await makeStudent('23CSE040', 'CSE');
        const m2 = await makeStudent('23CSE041', 'CSE');
        const pending = await makeStudent('23CSE042', 'CSE');
        const newcomer = await makeStudent('23CSE043', 'CSE');
        // members: creator + m2 = 2, pending: 1 → already at 3
        const group = await makeGroup(creator._id, { members: [m2._id], pending: [pending._id] });

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/exceed 3/i);
    });

    it('re-enforces branch restriction for added members', async () => {
        await makeGFEvent({ participatingBatches: ['2023'], branchRestrictedBatches: ['2023'] });
        const creator = await makeStudent('23CSE050', 'CSE');
        const crossBranch = await makeStudent('23ECE051', 'ECE');
        const group = await makeGroup(creator._id);

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(creator))
            .send({ members: [String(crossBranch._id)] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/single-branch/i);
    });

    it('returns 403 when a non-member tries to invite', async () => {
        await makeGFEvent({ participatingBatches: ['2023'] });
        const creator = await makeStudent('23CSE060', 'CSE');
        const outsider = await makeStudent('23CSE061', 'CSE');
        const newcomer = await makeStudent('23CSE062', 'CSE');
        const group = await makeGroup(creator._id);

        const res = await request(app)
            .post(`/api/groups/${group._id}/invite`)
            .set('x-auth-token', generateToken(outsider))
            .send({ members: [String(newcomer._id)] });

        expect(res.status).toBe(403);
    });
});
