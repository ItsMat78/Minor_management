/**
 * Integration tests for /api/projects routes.
 * Covers project creation, status transitions, deletion, and access control.
 */
import request from 'supertest';
import app from '../../app';
import Project from '../../models/Project';
import Group from '../../models/Group';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

// ── POST /api/projects ───────────────────────────────────────────────────────

describe('POST /api/projects', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).post('/api/projects').send({});
        expect(res.status).toBe(401);
    });

    it('returns 400 when the user is not in any group', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'My Project', description: 'Desc' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/must be in a group/i);
    });

    it('returns 400 when the group still has pending invites', async () => {
        const { group, members: [creator] } = await createTestGroup(1);
        const invitee = await createTestUser({ email: 'pending@t.ac.in' });
        group.pendingMembers.push(invitee._id as any);
        await group.save();

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(creator))
            .send({ title: 'Project', description: 'Desc' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/must accept/i);
    });

    it('defaults to Pending status when no status is provided', async () => {
        // The controller destructures: status = 'Pending' — omitting status sends a Pending proposal
        const { members: [student] } = await createTestGroup(1);
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Default Status Project', description: 'A description' });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('Pending');
        expect(res.body.title).toBe('Default Status Project');
    });

    it('creates a Draft project when status: Draft is explicitly sent', async () => {
        const { group: _g2, members: [student2] } = await createTestGroup(1);
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student2))
            .send({ title: 'Draft Project', description: 'A description', status: 'Draft' });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('Draft');
    });

    it('creates a Pending project and sets group status to ProposalPending', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Pending Project', description: 'Desc', status: 'Pending' });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('Pending');

        const updatedGroup = await Group.findById(group._id);
        expect(updatedGroup!.status).toBe('ProposalPending');
    });

    it('prevents a second Pending proposal when group already has an Approved project', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        await createTestProject(group._id, { status: 'Approved' });
        group.status = 'Approved';
        await group.save();

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Second Proposal', description: 'Desc', status: 'Pending' });
        expect(res.status).toBe(400);
        // One active proposal at a time: Pending OR Approved blocks a new submission.
        expect(res.body.message).toMatch(/already has an active proposal/i);
    });

    it('returns 400 when an invalid facultyId is provided', async () => {
        const { members: [student] } = await createTestGroup(1);
        const nonExistentId = '000000000000000000000000';
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Proj', description: 'Desc', facultyId: nonExistentId });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid faculty/i);
    });
});

// ── PUT /api/projects/:id/status ─────────────────────────────────────────────

describe('PUT /api/projects/:id/status', () => {
    it('allows assigned faculty to approve a pending project', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac@t.ac.in' });
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, {
            status: 'Pending',
            faculty: faculty._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Approved' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Approved');

        const updatedGroup = await Group.findById(group._id);
        expect(updatedGroup!.status).toBe('Approved');
    });

    it('allows assigned faculty to reject a pending project', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac2@t.ac.in' });
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, {
            status: 'Pending',
            faculty: faculty._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Rejected', feedback: 'Needs more work' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Rejected');
        expect(res.body.feedback).toBe('Needs more work');

        const updatedGroup = await Group.findById(group._id);
        expect(updatedGroup!.status).toBe('Forming'); // reset on rejection

        // Suppress unused variable
        void student;
    });

    it('returns 403 when a non-assigned faculty tries to update status', async () => {
        const assignedFaculty = await createTestUser({ role: UserRole.FACULTY, email: 'assigned@t.ac.in' });
        const otherFaculty = await createTestUser({ role: UserRole.FACULTY, email: 'other@t.ac.in' });
        const { group } = await createTestGroup(1);
        const project = await createTestProject(group._id, {
            status: 'Pending',
            faculty: assignedFaculty._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project._id}/status`)
            .set('x-auth-token', generateToken(otherFaculty))
            .send({ status: 'Approved' });
        expect(res.status).toBe(403);
    });

    it('allows an admin to update status regardless of faculty assignment', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac3@t.ac.in' });
        const admin = await createTestUser({ role: UserRole.ADMIN, email: 'adm@t.ac.in' });
        const { group } = await createTestGroup(1);
        const project = await createTestProject(group._id, {
            status: 'Pending',
            faculty: faculty._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project._id}/status`)
            .set('x-auth-token', generateToken(admin))
            .send({ status: 'Approved' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Approved');
    });

    it('deletes other proposals for the group when one is approved', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac4@t.ac.in' });
        const { group } = await createTestGroup(1);

        const toApprove = await createTestProject(group._id, { status: 'Pending', faculty: faculty._id });
        const draft = await createTestProject(group._id, { status: 'Draft', title: 'Competing Draft' });

        await request(app)
            .put(`/api/projects/${toApprove._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Approved' });

        const survivingDraft = await Project.findById(draft._id);
        expect(survivingDraft).toBeNull(); // deleted when sibling was approved
    });
});

// ── DELETE /api/projects/:id ─────────────────────────────────────────────────

describe('DELETE /api/projects/:id', () => {
    it('allows a group member to delete a Draft project', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Draft' });

        const res = await request(app)
            .delete(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(await Project.findById(project._id)).toBeNull();
    });

    it('allows a group member to delete a Pending project', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Pending' });

        const res = await request(app)
            .delete(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
    });

    it('prevents deleting an Approved project', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .delete(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/not Pending or Draft/i);
    });

    it('returns 403 when a non-member tries to delete', async () => {
        const { group } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Draft' });
        const outsider = await createTestUser({ email: 'outsider@t.ac.in' });

        const res = await request(app)
            .delete(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(outsider));
        expect(res.status).toBe(403);
    });
});

// ── GET /api/projects ────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
    it('returns only the student\'s own group projects', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        await createTestProject(group._id, { title: 'Mine' });

        const { group: otherGroup } = await createTestGroup(1);
        await createTestProject(otherGroup._id, { title: 'Not mine' });

        const res = await request(app)
            .get('/api/projects')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        const titles = res.body.map((p: any) => p.title);
        expect(titles).toContain('Mine');
        expect(titles).not.toContain('Not mine');
    });

    it('returns only assigned projects for faculty', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac5@t.ac.in' });
        const { group } = await createTestGroup(1);
        await createTestProject(group._id, { faculty: faculty._id, title: 'My mentee project' });

        const { group: otherGroup } = await createTestGroup(1);
        await createTestProject(otherGroup._id, { title: 'Someone else' });

        const res = await request(app)
            .get('/api/projects')
            .set('x-auth-token', generateToken(faculty));
        expect(res.status).toBe(200);
        const titles = res.body.map((p: any) => p.title);
        expect(titles).toContain('My mentee project');
        expect(titles).not.toContain('Someone else');
    });
});
