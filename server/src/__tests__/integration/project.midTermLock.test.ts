/**
 * Integration tests for the mid-semester evaluation edit freeze.
 *
 * A group may refine its project up to the moment mid-semester evaluation opens; after that
 * the details are what the mentors and panels are grading, so PUT /api/projects/:id is
 * refused and /api/groups/my reports detailsLocked so the UI can grey the editor out.
 *
 * The freeze must also survive semester rollover, which archives groups and projects but
 * never events — a previous semester's mid-term must not freeze this semester's proposals.
 * The cycle boundary is the newest Group Formation event.
 */
import request from 'supertest';
import app from '../../app';
import Project from '../../models/Project';
import Event, { EventType } from '../../models/Event';
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

const HOUR = 60 * 60 * 1000;

// An event of `type` starting `startOffsetMs` from now, so a negative offset is one that has
// already opened.
async function eventAt(type: EventType, startOffsetMs: number, opts: { isActive?: boolean } = {}) {
    const admin = await createTestUser({ role: UserRole.ADMIN });
    const startDate = new Date(Date.now() + startOffsetMs);
    return Event.create({
        type,
        isActive: opts.isActive ?? true,
        startDate,
        endDate: new Date(startDate.getTime() + 14 * 24 * HOUR),
        participatingBatches: type === EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL ? ['2023'] : undefined,
        createdBy: admin._id,
    });
}

const midTermEvent = (startOffsetMs: number, opts: { isActive?: boolean } = {}) =>
    eventAt(EventType.MID_TERM_EVALUATION, startOffsetMs, opts);

const groupFormationEvent = (startOffsetMs: number) =>
    eventAt(EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL, startOffsetMs);

describe('PUT /api/projects/:id — mid-semester evaluation freeze', () => {
    it('lets a member edit while no mid-term window has opened', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Refined Before Mid-Term');

        expect(res.status).toBe(200);
        expect((await Project.findById(project._id))!.title).toBe('Refined Before Mid-Term');
    });

    it('refuses the edit once the mid-term window has opened', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });
        await midTermEvent(-HOUR); // opened an hour ago, after the project was created

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Too Late');

        expect(res.status).toBe(403);
        expect(res.body.detailsLocked).toBe(true);
        expect(res.body.message).toMatch(/mid-semester evaluation has begun/i);
        expect((await Project.findById(project._id))!.title).toBe('Test Project'); // unchanged
    });

    it('still allows edits while the mid-term window is only scheduled', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        await midTermEvent(24 * HOUR); // opens tomorrow

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Still Open');

        expect(res.status).toBe(200);
    });

    it('ignores a deactivated mid-term window', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        await midTermEvent(-HOUR, { isActive: false });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Admin Reopened It');

        expect(res.status).toBe(200);
    });

    it('ignores last semester\'s mid-term window once a new Group Formation cycle has begun', async () => {
        // Rollover archives projects but leaves events behind, so an older mid-term must not
        // freeze proposals belonging to the cycle that started after it.
        await midTermEvent(-90 * 24 * HOUR);
        await groupFormationEvent(-30 * 24 * HOUR);
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Draft' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'New Semester, New Proposal');

        expect(res.status).toBe(200);
    });

    it('freezes again once this cycle\'s mid-term window opens', async () => {
        await midTermEvent(-90 * 24 * HOUR);       // last semester's
        await groupFormationEvent(-30 * 24 * HOUR); // this semester began
        await midTermEvent(-HOUR);                  // and its mid-term is now open
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Too Late Again');

        expect(res.status).toBe(403);
        expect(res.body.detailsLocked).toBe(true);
    });

    it('freezes a project that already carries a mid-term evaluation even with no event on record', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        await Project.findByIdAndUpdate(project._id, {
            midTermEvaluation: { remarks: 'Good progress', date: new Date() },
        });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Graded Already');

        expect(res.status).toBe(403);
        expect(res.body.detailsLocked).toBe(true);
    });

    it('still rejects a non-member before considering the freeze', async () => {
        const { group } = await createTestGroup(1);
        const outsider = await createTestUser({ role: UserRole.STUDENT });
        const project = await createTestProject(group._id, { status: 'Approved' });
        await midTermEvent(-HOUR);

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(outsider))
            .field('title', 'Hijacked');

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not authorized/i);
    });
});

describe('GET /api/groups/my — detailsLocked flag', () => {
    it('reports detailsLocked false before the mid-term window opens', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        group.project = project._id as any;
        await group.save();

        const res = await request(app)
            .get('/api/groups/my')
            .set('x-auth-token', generateToken(student));

        expect(res.status).toBe(200);
        expect(res.body.project.detailsLocked).toBe(false);
        expect(res.body.projects[0].detailsLocked).toBe(false);
    });

    it('reports detailsLocked true once the mid-term window has opened', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        group.project = project._id as any;
        await group.save();
        await midTermEvent(-HOUR);

        const res = await request(app)
            .get('/api/groups/my')
            .set('x-auth-token', generateToken(student));

        expect(res.status).toBe(200);
        expect(res.body.project.detailsLocked).toBe(true);
        expect(res.body.projects[0].detailsLocked).toBe(true);
    });

    it('keeps the rest of the group payload intact', async () => {
        const { group, members: [student] } = await createTestGroup(2);
        const project = await createTestProject(group._id, { status: 'Approved', title: 'Payload Check' });
        group.project = project._id as any;
        await group.save();

        const res = await request(app)
            .get('/api/groups/my')
            .set('x-auth-token', generateToken(student));

        expect(res.status).toBe(200);
        expect(res.body.members).toHaveLength(2);
        expect(res.body.members[0].name).toBeDefined(); // populate survived the reshaping
        expect(res.body.project.title).toBe('Payload Check');
        expect(res.body.projects).toHaveLength(1);
    });
});
