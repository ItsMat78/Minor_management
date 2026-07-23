/**
 * Integration tests for per-batch branch restriction during group formation.
 *
 * Reproduces the reported bug ("couldn't form a group with anyone once branch
 * restriction was on") and pins down the intended behaviour:
 *   - same-branch members are allowed
 *   - cross-branch members are rejected ONLY when the creator's batch is restricted
 *   - legacy events (boolean branchRestricted, no per-batch list) still enforce
 */
import request from 'supertest';
import app from '../../app';
import Event, { EventType } from '../../models/Event';
import User, { UserRole } from '../../models/User';
import { createTestUser, generateToken } from '../helpers/factories';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCompleteEmail: jest.fn().mockResolvedValue(undefined),
}));

// createTestUser doesn't take a branch, so set it explicitly here.
async function makeStudent(rollNumber: string, branch?: string) {
    const u = await createTestUser({ rollNumber });
    if (branch !== undefined) {
        (u as any).branch = branch;
        await u.save();
    }
    return u;
}

async function makeActiveGFEvent(fields: Partial<{ participatingBatches: string[]; branchRestrictedBatches: string[]; branchRestricted: boolean; branchRestrictionGroups: { batch: string; clusters: string[] }[] }>) {
    return Event.create({
        type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
        isActive: true,
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
        participatingBatches: fields.participatingBatches,
        branchRestrictedBatches: fields.branchRestrictedBatches,
        branchRestricted: fields.branchRestricted,
        branchRestrictionGroups: fields.branchRestrictionGroups,
        createdBy: new (require('mongoose').Types.ObjectId)(),
    });
}

describe('POST /api/groups — per-batch branch restriction', () => {
    it('allows a same-branch member when the creator\'s batch is restricted', async () => {
        await makeActiveGFEvent({ participatingBatches: ['2023'], branchRestrictedBatches: ['2023'] });
        const creator = await makeStudent('23CSE001', 'CSE');
        const member = await makeStudent('23CSE002', 'CSE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(201);
    });

    it('rejects a cross-branch member when the creator\'s batch is restricted', async () => {
        await makeActiveGFEvent({ participatingBatches: ['2023'], branchRestrictedBatches: ['2023'] });
        const creator = await makeStudent('23CSE010', 'CSE');
        const member = await makeStudent('23ECE011', 'ECE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/single-branch/i);
    });

    it('allows a cross-branch member when the creator\'s batch is NOT restricted', async () => {
        await makeActiveGFEvent({ participatingBatches: ['2023', '2024'], branchRestrictedBatches: ['2024'] });
        const creator = await makeStudent('23CSE020', 'CSE'); // batch 2023, not restricted
        const member = await makeStudent('23ECE021', 'ECE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(201);
    });

    it('does NOT lock out a creator whose branch field is missing (data-robustness)', async () => {
        // Reproduces "couldn't form a group with anyone": if the creator's branch is
        // unknown we can't prove a mismatch, so we must not block.
        await makeActiveGFEvent({ participatingBatches: ['2023'], branchRestrictedBatches: ['2023'] });
        const creator = await makeStudent('23CSE040'); // branch intentionally unset
        const member = await makeStudent('23CSE041', 'CSE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(201);
    });

    it('treats branch case/whitespace differences as the same branch', async () => {
        await makeActiveGFEvent({ participatingBatches: ['2023'], branchRestrictedBatches: ['2023'] });
        const creator = await makeStudent('23CSE050', 'CSE');
        const member = await makeStudent('23CSE051', ' cse ');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(201);
    });

    it('legacy boolean branchRestricted still blocks cross-branch (no per-batch list)', async () => {
        await makeActiveGFEvent({ participatingBatches: ['2023'], branchRestricted: true });
        const creator = await makeStudent('23CSE030', 'CSE');
        const member = await makeStudent('23ECE031', 'ECE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/groups — per-batch branch clustering', () => {
    // Batch 2023 restricted, but CSE & DSAI are clustered together (ECE stays separate).
    const clusteredEvent = () => makeActiveGFEvent({
        participatingBatches: ['2023'],
        branchRestrictedBatches: ['2023'],
        branchRestrictionGroups: [{ batch: '2023', clusters: ['CSE,DSAI', 'ECE'] }],
    });

    it('allows a cross-branch member within the same cluster (CSE + DSAI)', async () => {
        await clusteredEvent();
        const creator = await makeStudent('23CSE100', 'CSE');
        const member = await makeStudent('23DSAI101', 'DSAI');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(201);
    });

    it('rejects a member from a different cluster (CSE + ECE)', async () => {
        await clusteredEvent();
        const creator = await makeStudent('23CSE110', 'CSE');
        const member = await makeStudent('23ECE111', 'ECE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/CSE\+DSAI/);
    });

    it('still rejects across two singleton clusters (DSAI + ECE)', async () => {
        await clusteredEvent();
        const creator = await makeStudent('23DSAI120', 'DSAI');
        const member = await makeStudent('23ECE121', 'ECE');

        const res = await request(app)
            .post('/api/groups')
            .set('x-auth-token', generateToken(creator))
            .send({ members: [member._id] });

        expect(res.status).toBe(400);
    });
});
