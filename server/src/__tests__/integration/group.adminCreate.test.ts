/**
 * Integration tests for POST /api/groups/admin — the admin building a group by hand.
 *
 * This path deliberately bypasses the student flow (no Group Formation window, no invites, no
 * branch restriction), so the tests focus on the invariants it still has to keep: admin-only
 * access, students only, one active group per student, the 3-member cap, an unambiguous batch,
 * and a group number that does not collide with a live group.
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
    sendMentorChangeEmail: jest.fn().mockResolvedValue(undefined),
}));

const adminToken = async () => generateToken(await createTestUser({ role: UserRole.ADMIN }));

let seq = 0;
const student = (roll: string) =>
    createTestUser({ rollNumber: roll, email: `ac-${roll}-${seq++}-${Date.now()}@iiitnr.ac.in` });

describe('POST /api/groups/admin', () => {
    it('rejects a non-admin caller', async () => {
        const s = await student('24CS001');

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', generateToken(s))
            .send({ members: [s._id] });

        expect(res.status).toBe(403);
    });

    it('creates a group of accepted members with no pending invites', async () => {
        const a = await student('24CS010');
        const b = await student('24CS011');

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [a._id, b._id] });

        expect(res.status).toBe(201);
        const stored = await Group.findById(res.body.group._id);
        expect(stored!.members).toHaveLength(2);
        expect(stored!.pendingMembers).toHaveLength(0);
        expect(stored!.status).toBe('Forming');
        expect(stored!.targetBatch).toBe('2024');
        // createdBy points at a real member so the schema's member cap stays armed.
        expect(String(stored!.createdBy)).toBe(String(a._id));
    });

    it('numbers the group from the live groups in that batch', async () => {
        const existing = await student('24CS020');
        await Group.create({ name: '1', members: [existing._id], createdBy: existing._id, targetBatch: '2024', status: 'Forming' });

        const a = await student('24CS021');
        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [a._id] });

        expect(res.status).toBe(201);
        expect(res.body.group.name).toBe('2');
    });

    it('refuses an empty selection', async () => {
        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [] });

        expect(res.status).toBe(400);
    });

    it('refuses more than three students', async () => {
        const members = [];
        for (let i = 0; i < 4; i++) members.push((await student(`24CS03${i}`))._id);

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/cannot exceed 3/i);
    });

    it('refuses a faculty member', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: `fac-${Date.now()}@t.ac.in`, name: 'Prof X' });

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [faculty._id] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not a student/i);
    });

    it('refuses a student who is already in an active group', async () => {
        const { members } = await createTestGroup(1);

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [members[0]._id] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already in group/i);
    });

    it('refuses a mixed-batch selection unless the batch is set explicitly', async () => {
        const a = await student('24CS040');
        const b = await student('23CS040');

        const mixed = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [a._id, b._id] });

        expect(mixed.status).toBe(400);
        expect(mixed.body.message).toMatch(/different batches/i);

        const forced = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [a._id, b._id], targetBatch: '2024' });

        expect(forced.status).toBe(201);
        expect(forced.body.group.targetBatch).toBe('2024');
    });

    it("resolves a dropper's batch through their targetBatch override", async () => {
        // Roll number says 2023, but the override puts them with the 2024 cohort.
        const dropper = await createTestUser({
            rollNumber: '23CS050',
            targetBatch: '2024',
            email: `drop-${Date.now()}@iiitnr.ac.in`,
        });

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [dropper._id] });

        expect(res.status).toBe(201);
        expect(res.body.group.targetBatch).toBe('2024');
    });

    it('creates the group with no project, so it has no mentor yet', async () => {
        const a = await student('24CS060');

        const res = await request(app)
            .post('/api/groups/admin')
            .set('x-auth-token', await adminToken())
            .send({ members: [a._id] });

        expect(res.status).toBe(201);
        expect(res.body.group.project).toBeFalsy();
    });
});
