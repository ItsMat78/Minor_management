/**
 * Integration tests for the admin's project-details lock.
 *
 * A toggle in Setup Events (PUT /api/events/project-details-lock) stops every group editing
 * its project title / description. While it is on, PUT /api/projects/:id is refused for group
 * members and /api/groups/my reports detailsLocked so the UI can grey the editor out. The lock
 * is independent of the evaluation events — a mid-term window opening does not lock anything.
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

async function setLock(locked: boolean, role: UserRole = UserRole.ADMIN) {
    const staff = await createTestUser({ role });
    return request(app)
        .put('/api/events/project-details-lock')
        .set('x-auth-token', generateToken(staff))
        .send({ locked });
}

describe('PUT /api/events/project-details-lock', () => {
    it('lets the admin switch the lock on and off and reports it back', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const token = generateToken(admin);

        let res = await request(app).get('/api/events/project-details-lock').set('x-auth-token', token);
        expect(res.status).toBe(200);
        expect(res.body.locked).toBe(false);

        res = await setLock(true);
        expect(res.status).toBe(200);
        expect(res.body.locked).toBe(true);

        res = await request(app).get('/api/events/project-details-lock').set('x-auth-token', token);
        expect(res.body.locked).toBe(true);
    });

    it('rejects a non-boolean value', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        const res = await request(app)
            .put('/api/events/project-details-lock')
            .set('x-auth-token', generateToken(admin))
            .send({ locked: 'yes' });
        expect(res.status).toBe(400);
    });

    it('refuses a student', async () => {
        const res = await setLock(true, UserRole.STUDENT);
        expect(res.status).toBe(403);
    });
});

describe('PUT /api/projects/:id — project details lock', () => {
    it('lets a member edit while the lock is off', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Refined');

        expect(res.status).toBe(200);
        expect((await Project.findById(project._id))!.title).toBe('Refined');
    });

    it('refuses the edit while the lock is on', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        await setLock(true);

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Too Late');

        expect(res.status).toBe(403);
        expect(res.body.detailsLocked).toBe(true);
        expect(res.body.message).toMatch(/locked by the admin/i);
        expect((await Project.findById(project._id))!.title).toBe('Test Project'); // unchanged
    });

    it('allows edits again once the lock is switched off', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        await setLock(true);
        await setLock(false);

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Reopened');

        expect(res.status).toBe(200);
    });

    it('does not lock just because the mid-term window opened', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Event.create({
            type: EventType.MID_TERM_EVALUATION, isActive: true,
            startDate: new Date(Date.now() - HOUR), endDate: new Date(Date.now() + 14 * 24 * HOUR),
            createdBy: admin._id,
        });
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        await Project.findByIdAndUpdate(project._id, { midTermEvaluation: { remarks: 'Good progress', date: new Date() } });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Still Editable');

        expect(res.status).toBe(200);
    });

    it('still rejects a non-member before considering the lock', async () => {
        const { group } = await createTestGroup(1);
        const outsider = await createTestUser({ role: UserRole.STUDENT });
        const project = await createTestProject(group._id, { status: 'Approved' });
        await setLock(true);

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(outsider))
            .field('title', 'Hijacked');

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not authorized/i);
    });
});

describe('GET /api/groups/my — detailsLocked flag', () => {
    const fetchMyGroup = async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });
        group.project = project._id as any;
        await group.save();
        return () => request(app).get('/api/groups/my').set('x-auth-token', generateToken(student));
    };

    it('reports detailsLocked false while the lock is off', async () => {
        const res = await (await fetchMyGroup())();
        expect(res.status).toBe(200);
        expect(res.body.project.detailsLocked).toBe(false);
        expect(res.body.projects[0].detailsLocked).toBe(false);
    });

    it('reports detailsLocked true while the lock is on', async () => {
        const get = await fetchMyGroup();
        await setLock(true);
        const res = await get();
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
