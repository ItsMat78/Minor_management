/**
 * Integration tests for PUT /api/projects/:id/admin-status — the admin walking a project's
 * status in either direction.
 *
 * The faculty path (PUT /:id/status) only ever decides a submitted proposal, so it accepts
 * Approved and Rejected and nothing else. This route is the correction path, and the things
 * worth pinning down are the ones that make it safe: it is admin-only, it keeps Group.status
 * in step with Project.status in all four directions, it still refuses to overbook a
 * supervisor, and it will not silently strand evaluation work.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import Project from '../../models/Project';
import User, { UserRole } from '../../models/User';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';

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
    sendProjectUpdateEmail: jest.fn().mockResolvedValue(undefined),
    sendMentorChangeEmail: jest.fn().mockResolvedValue(undefined),
    sendProjectDetailsChangedEmail: jest.fn().mockResolvedValue(undefined),
}));

const adminToken = async () => generateToken(await createTestUser({ role: UserRole.ADMIN }));

// An approved project supervised by a faculty with plenty of room.
async function approvedProject(memberCount = 2) {
    const faculty = await createTestUser({ role: UserRole.FACULTY, email: `sup-${Date.now()}-${Math.random()}@t.ac.in` });
    const { group, members } = await createTestGroup(memberCount);
    const project = await createTestProject(group._id as any, {
        status: 'Approved',
        faculty: faculty._id as any,
    });
    group.status = 'Approved';
    group.project = project._id as any;
    await group.save();
    return { faculty, group, members, project };
}

describe('PUT /api/projects/:id/admin-status', () => {
    it('refuses a non-admin caller', async () => {
        const { faculty, project } = await approvedProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Pending' });

        expect(res.status).toBe(403);
    });

    it('rejects a status outside the four', async () => {
        const { project } = await approvedProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Forming' });

        expect(res.status).toBe(400);
    });

    it('moves Approved back to Pending and returns the group to ProposalPending', async () => {
        const { group, project } = await approvedProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Pending' });

        expect(res.status).toBe(200);
        const storedProject = await Project.findById(project._id);
        const storedGroup = await Group.findById(group._id);
        expect(storedProject!.status).toBe('Pending');
        expect(storedGroup!.status).toBe('ProposalPending');
        expect(String(storedGroup!.project)).toBe(String(project._id));
    });

    it('moves Approved back to Draft, returning the group to Forming and dropping the pointer', async () => {
        const { group, project } = await approvedProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Draft' });

        expect(res.status).toBe(200);
        const storedGroup = await Group.findById(group._id);
        expect(storedGroup!.status).toBe('Forming');
        expect(storedGroup!.project).toBeUndefined();
    });

    it('rejects a project and returns the group to Forming', async () => {
        const { group, project } = await approvedProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Rejected', feedback: 'Approved by mistake.' });

        expect(res.status).toBe(200);
        const storedProject = await Project.findById(project._id);
        const storedGroup = await Group.findById(group._id);
        expect(storedProject!.status).toBe('Rejected');
        expect(storedProject!.feedback).toBe('Approved by mistake.');
        expect(storedGroup!.status).toBe('Forming');
        expect(storedGroup!.project).toBeUndefined();
    });

    it('approves a pending proposal, syncing the group and clearing competing proposals', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: `sup2-${Date.now()}@t.ac.in` });
        const { group } = await createTestGroup(2);
        const chosen = await createTestProject(group._id as any, { status: 'Pending', faculty: faculty._id as any });
        const alsoRan = await createTestProject(group._id as any, { status: 'Draft', faculty: faculty._id as any });

        const res = await request(app)
            .put(`/api/projects/${chosen._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Approved' });

        expect(res.status).toBe(200);
        const storedGroup = await Group.findById(group._id);
        expect(storedGroup!.status).toBe('Approved');
        expect(String(storedGroup!.project)).toBe(String(chosen._id));
        // Approval destroys the group's other proposals — the same behaviour as the faculty path.
        expect(await Project.findById(alsoRan._id)).toBeNull();
    });

    it('still refuses to push a supervisor over their student limit', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: `cap-${Date.now()}@t.ac.in` });
        await User.findByIdAndUpdate(faculty._id, { maxStudents: 2 });

        // Two students already committed to this supervisor.
        const { group: taken } = await createTestGroup(2);
        await createTestProject(taken._id as any, { status: 'Approved', faculty: faculty._id as any });

        const { group: waiting } = await createTestGroup(1);
        const pending = await createTestProject(waiting._id as any, { status: 'Pending', faculty: faculty._id as any });

        const res = await request(app)
            .put(`/api/projects/${pending._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Approved' });

        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);
        expect((await Project.findById(pending._id))!.status).toBe('Pending');
    });

    it('refuses to un-approve a graded project without confirmation', async () => {
        const { project } = await approvedProject();
        project.midTermEvaluation = { marks: 18, remarks: 'Good' } as any;
        await project.save();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Pending' });

        expect(res.status).toBe(409);
        expect(res.body.requiresConfirmation).toBe(true);
        expect((await Project.findById(project._id))!.status).toBe('Approved');
    });

    it('un-approves a graded project when confirmed, leaving the marks in place', async () => {
        const { project } = await approvedProject();
        project.midTermEvaluation = { marks: 18, remarks: 'Good' } as any;
        await project.save();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Pending', confirm: true });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.status).toBe('Pending');
        expect((stored!.midTermEvaluation as any).marks).toBe(18);
    });

    it('refuses an archived project', async () => {
        const { project } = await approvedProject();
        project.isArchived = true;
        await project.save();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Pending' });

        expect(res.status).toBe(400);
    });

    it('rejects a no-op transition', async () => {
        const { project } = await approvedProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/admin-status`)
            .set('x-auth-token', await adminToken())
            .send({ status: 'Approved' });

        expect(res.status).toBe(400);
    });
});
