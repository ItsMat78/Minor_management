/**
 * Integration tests for /api/projects routes.
 * Covers project creation, status transitions, deletion, and access control.
 */
import request from 'supertest';
import app from '../../app';
import Project from '../../models/Project';
import Group from '../../models/Group';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';
import User, { UserRole } from '../../models/User';
import { sendProjectUpdateEmail } from '../../utils/emailService';

const mockUpdateEmail = sendProjectUpdateEmail as jest.Mock;

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
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor-default@t.ac.in' });
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Default Status Project', description: 'A description', facultyId: String(mentor._id) });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('Pending');
        expect(res.body.title).toBe('Default Status Project');
    });

    it('returns 400 when submitting a Pending proposal without a faculty', async () => {
        // 'Decide Later' is only valid for a Draft — a submitted proposal must name a mentor.
        const { members: [student] } = await createTestGroup(1);
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Mentorless Proposal', description: 'Desc', status: 'Pending' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/faculty mentor before submitting/i);
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
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor-pending@t.ac.in' });
        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'Pending Project', description: 'Desc', status: 'Pending', facultyId: String(mentor._id) });
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

    it('lets a student propose in their active group despite an archived group with an approved project', async () => {
        // Regression: after a session rollover the student's past group is archived but its
        // project keeps status 'Approved'. createProject must look at the ACTIVE group only,
        // otherwise the old archived proposal wrongly blocks a fresh one.
        const student = await createTestUser({ role: UserRole.STUDENT, rollNumber: '23IT050' });

        const oldGroup = new Group({
            name: '12', members: [student._id], status: 'Dissolved',
            isArchived: true, targetBatch: '2023', archivedSession: 'Even 2022-23',
        });
        await oldGroup.save();
        const oldProject = await createTestProject(oldGroup._id, { status: 'Approved' });
        oldProject.isArchived = true;
        await oldProject.save();

        const newGroup = new Group({
            name: '1', members: [student._id], createdBy: student._id, status: 'Forming',
        });
        await newGroup.save();
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor-archived@t.ac.in' });

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(student))
            .send({ title: 'New Proposal', description: 'Desc', facultyId: String(mentor._id) });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('Pending');
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

    it('does not block approval on the group-count guideline alone — the student cap is the hard limit', async () => {
        // The group count is only a rough guideline now: a supervisor can go past the old group
        // proxy as long as the semester-wide student cap still has room. (Small groups legitimately
        // push the group total up while staying well under the student cap.)
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'cap_groups@t.ac.in' });
        await User.updateOne({ _id: faculty._id }, { $set: { maxGroups: 2, maxStudents: 99 } });

        // Two approved single-member groups already meet the group proxy (2 groups, 2 students).
        for (let i = 0; i < 2; i++) {
            const member = await createTestUser({
                email: `cap23-${i}@t.ac.in`, rollNumber: `2310000${i}`,
            });
            const g = await Group.create({
                name: `Cap23-${i}`, members: [member._id], createdBy: member._id,
                status: 'Approved', inviteCode: `C23${i}`,
            });
            await createTestProject(g._id, { status: 'Approved', faculty: faculty._id });
        }

        // A third group asks for approval: 3 groups (over maxGroups=2) but only 3 students (well
        // under maxStudents=99), so approval must still succeed.
        const member24 = await createTestUser({ email: 'cap24@t.ac.in', rollNumber: '241000001' });
        const group24 = await Group.create({
            name: 'Cap24', members: [member24._id], createdBy: member24._id,
            status: 'Forming', inviteCode: 'C24',
        });
        const project24 = await createTestProject(group24._id, {
            status: 'Pending', faculty: faculty._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project24._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Approved' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Approved');
    });

    it('counts a supervisor student limit across ALL batches, not per batch', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'cap_students@t.ac.in' });
        await User.updateOne({ _id: faculty._id }, { $set: { maxGroups: 99, maxStudents: 3 } });

        const existing = await createTestGroup(3);
        existing.group.status = 'Approved';
        await existing.group.save();
        await createTestProject(existing.group._id, { status: 'Approved', faculty: faculty._id });

        const member24 = await createTestUser({ email: 'scap24@t.ac.in', rollNumber: '241000009' });
        const group24 = await Group.create({
            name: 'SCap24', members: [member24._id], createdBy: member24._id,
            status: 'Forming', inviteCode: 'SC24',
        });
        const project24 = await createTestProject(group24._id, {
            status: 'Pending', faculty: faculty._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project24._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Approved' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/max 3 students/i);
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

    it('refuses to approve a Draft (unsent) proposal', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac-draft@t.ac.in' });
        const { group } = await createTestGroup(1);
        const draft = await createTestProject(group._id, { status: 'Draft', faculty: faculty._id });

        const res = await request(app)
            .put(`/api/projects/${draft._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Approved' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/draft/i);
        expect((await Project.findById(draft._id))!.status).toBe('Draft'); // unchanged
    });

    it('rejects a status value that is not Approved or Rejected', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac-badstatus@t.ac.in' });
        const { group } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Pending', faculty: faculty._id });

        const res = await request(app)
            .put(`/api/projects/${project._id}/status`)
            .set('x-auth-token', generateToken(faculty))
            .send({ status: 'Withdrawn' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Approved or Rejected/i);
        expect((await Project.findById(project._id))!.status).toBe('Pending'); // unchanged
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

// ── PUT /api/projects/:id (edit) ─────────────────────────────────────────────

describe('PUT /api/projects/:id — editing an approved project', () => {
    it('lets a member edit an approved project and keeps it Approved even when the client posts a different status', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor.keep@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });
        group.status = 'Approved';
        await group.save();

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            // The editor UI posts status: 'Pending' by default — the server must not un-approve.
            .field('title', 'Revised Approved Title')
            .field('description', 'Updated scope after approval')
            .field('status', 'Pending');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Approved');
        expect(res.body.title).toBe('Revised Approved Title');

        const updatedGroup = await Group.findById(group._id);
        expect(updatedGroup!.status).toBe('Approved');
    });

    it('ignores a faculty change on an approved project (mentor stays locked)', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor.lock@t.ac.in' });
        const otherFaculty = await createTestUser({ role: UserRole.FACULTY, email: 'other.faculty@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            .field('facultyId', String(otherFaculty._id))
            .field('status', 'Approved');

        expect(res.status).toBe(200);
        const saved = await Project.findById(project._id);
        expect(String(saved!.faculty)).toBe(String(mentor._id));
    });

    it('rejects an edit from a non-member', async () => {
        const { group } = await createTestGroup(1);
        const outsider = await createTestUser({ role: UserRole.STUDENT, email: 'outsider@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(outsider))
            .field('title', 'Hijacked');

        expect(res.status).toBe(403);
    });
});

describe('PUT /api/projects/:id — resubmitting a rejected proposal', () => {
    it('promotes a rejected proposal back to Pending and clears the old rejection feedback', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor.resub@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Rejected', faculty: mentor._id as any });
        await Project.updateOne({ _id: project._id }, { feedback: 'Scope too broad' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(student))
            // The proposal editor posts status: 'Pending' when a group revises and resubmits.
            .field('title', 'Revised Proposal')
            .field('status', 'Pending');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Pending');

        const saved = await Project.findById(project._id);
        expect(saved!.status).toBe('Pending');
        expect(saved!.feedback).toBeFalsy(); // stale rejection remark must not carry over

        const updatedGroup = await Group.findById(group._id);
        expect(updatedGroup!.status).toBe('ProposalPending');
    });

    it('blocks promoting a mentor-less Draft to Pending', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const draft = await createTestProject(group._id, { status: 'Draft' }); // no faculty

        const res = await request(app)
            .put(`/api/projects/${draft._id}`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Still no mentor')
            .field('status', 'Pending');

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/faculty mentor before submitting/i);
        expect((await Project.findById(draft._id))!.status).toBe('Draft'); // unchanged
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

// ── GET /api/projects/admin/proposals ────────────────────────────────────────

describe('GET /api/projects/admin/proposals', () => {
    it('returns 403 for a faculty user', async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, email: 'fac-prop@t.ac.in' });
        const res = await request(app)
            .get('/api/projects/admin/proposals')
            .set('x-auth-token', generateToken(faculty));
        expect(res.status).toBe(403);
    });

    it('returns 403 for a student user', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT, email: 'stu-prop@t.ac.in' });
        const res = await request(app)
            .get('/api/projects/admin/proposals')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });

    it('returns every faculty\'s active proposals with faculty and members populated', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: 'admin-prop@t.ac.in' });
        const facultyA = await createTestUser({ role: UserRole.FACULTY, email: 'fac-a@t.ac.in' });
        const facultyB = await createTestUser({ role: UserRole.FACULTY, email: 'fac-b@t.ac.in' });

        const { group: groupA } = await createTestGroup(2);
        await createTestProject(groupA._id, { faculty: facultyA._id, title: 'Proposal A' });
        const { group: groupB } = await createTestGroup(1);
        await createTestProject(groupB._id, { faculty: facultyB._id, title: 'Proposal B' });

        const res = await request(app)
            .get('/api/projects/admin/proposals')
            .set('x-auth-token', generateToken(admin));

        expect(res.status).toBe(200);
        const titles = res.body.map((p: any) => p.title);
        expect(titles).toContain('Proposal A');
        expect(titles).toContain('Proposal B');

        const a = res.body.find((p: any) => p.title === 'Proposal A');
        expect(a.faculty.name).toBe(facultyA.name);
        expect(a.group.members).toHaveLength(2);
        expect(a.group.members[0].rollNumber).toBeDefined();
    });

    it('returns just the pending count when countOnly is set', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: 'admin-count@t.ac.in' });
        const { group: g1 } = await createTestGroup(1);
        await createTestProject(g1._id, { title: 'Pending one', status: 'Pending' });
        const { group: g2 } = await createTestGroup(1);
        await createTestProject(g2._id, { title: 'Already approved', status: 'Approved' });

        const res = await request(app)
            .get('/api/projects/admin/proposals?countOnly=1')
            .set('x-auth-token', generateToken(admin));

        expect(res.status).toBe(200);
        expect(res.body.pending).toBe(1);
        expect(Array.isArray(res.body)).toBe(false);
    });

    it('excludes archived projects', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: 'admin-arch@t.ac.in' });
        const { group } = await createTestGroup(1);
        const archived = await createTestProject(group._id, { title: 'Old semester' });
        await Project.findByIdAndUpdate(archived._id, { isArchived: true });

        const res = await request(app)
            .get('/api/projects/admin/proposals')
            .set('x-auth-token', generateToken(admin));

        expect(res.status).toBe(200);
        expect(res.body.map((p: any) => p.title)).not.toContain('Old semester');
    });
});

// ── POST /api/projects/:id/updates ───────────────────────────────────────────

describe('POST /api/projects/:id/updates', () => {
    it('stores the optional heading the mentor\'s update form sends', async () => {
        const { group } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor-upd@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(mentor))
            .field('title', 'Week 3 review')
            .field('content', 'Discussed the dataset split.');

        expect(res.status).toBe(200);

        const saved = await Project.findById(project._id);
        expect(saved!.updates).toHaveLength(1);
        expect(saved!.updates[0].title).toBe('Week 3 review');
        expect(saved!.updates[0].content).toBe('Discussed the dataset split.');
    });

    it('leaves the heading unset when none is sent, and trims a blank one away', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('content', 'No heading on the student form.');

        await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('title', '   ')
            .field('content', 'Whitespace heading.');

        const saved = await Project.findById(project._id);
        expect(saved!.updates).toHaveLength(2);
        expect(saved!.updates[0].title).toBeUndefined();
        expect(saved!.updates[1].title).toBeUndefined();
    });

    it('records links posted alongside an update', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('content', 'Pushed the repo.')
            .field('links', 'https://github.com/a, https://github.com/b');

        expect(res.status).toBe(200);
        const saved = await Project.findById(project._id);
        expect(saved!.updates[0].links).toEqual(['https://github.com/a', 'https://github.com/b']);
    });

    it('accepts a Markdown attachment even when the browser reports no useful mimetype', async () => {
        // Many systems have no registered type for .md, so Chrome sends application/octet-stream.
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('content', 'Notes attached.')
            .attach('files', Buffer.from('# Sprint notes\n'), {
                filename: 'notes.md',
                contentType: 'application/octet-stream',
            });

        expect(res.status).toBe(200);
        const saved = await Project.findById(project._id);
        expect(saved!.updates[0].attachments).toHaveLength(1);
        expect(saved!.updates[0].attachments![0]).toMatch(/\.md$/);
    });

    it('answers 400 with a readable reason for an unsupported file type', async () => {
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('content', 'Trying to attach a binary.')
            .attach('files', Buffer.from('MZ\x00\x00'), {
                filename: 'tool.exe',
                contentType: 'application/x-msdownload',
            });

        // Not a 500 HTML page: the client needs the reason to show the user.
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/tool\.exe.*not a supported file type/i);
        expect(res.body.message).toMatch(/Markdown/);

        // Nothing was recorded for a rejected upload.
        const saved = await Project.findById(project._id);
        expect(saved!.updates).toHaveLength(0);
    });

    it('emails only the mentor when a student posts', async () => {
        mockUpdateEmail.mockClear();
        const { group, members: [student] } = await createTestGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'mentor-notify@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('title', 'Week 4')
            .field('content', 'Finished the parser.')
            .field('links', 'https://github.com/a');
        expect(res.status).toBe(200);

        expect(mockUpdateEmail).toHaveBeenCalledTimes(1);
        const [emails, projectTitle, authorName, audience, opts] = mockUpdateEmail.mock.calls[0];
        expect(emails).toEqual(['mentor-notify@t.ac.in']); // the co-member is NOT mailed
        expect(projectTitle).toBe('Test Project');
        expect(authorName).toBe(student.name);
        expect(audience).toBe('mentor');
        expect(opts).toMatchObject({ updateTitle: 'Week 4', content: 'Finished the parser.', linkCount: 1, attachmentCount: 0 });
    });

    it('emails every group member when the mentor posts', async () => {
        mockUpdateEmail.mockClear();
        const { group, members } = await createTestGroup(3);
        const mentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Guide', email: 'guide-posts@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(mentor))
            .field('content', 'Please tighten the scope before mid-term.');
        expect(res.status).toBe(200);

        expect(mockUpdateEmail).toHaveBeenCalledTimes(1);
        const [emails, , authorName, audience] = mockUpdateEmail.mock.calls[0];
        expect(emails).toEqual(expect.arrayContaining(members.map(m => m.email)));
        expect(emails).not.toContain('guide-posts@t.ac.in'); // never mail the poster
        expect(authorName).toBe('Dr. Guide');
        expect(audience).toBe('members');
    });

    it('sends nothing when a student posts on a project with no mentor yet', async () => {
        mockUpdateEmail.mockClear();
        const { group, members: [student] } = await createTestGroup(1);
        const project = await createTestProject(group._id, { status: 'Approved' }); // no faculty

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(student))
            .field('content', 'Nobody to tell.');

        expect(res.status).toBe(200);
        expect(mockUpdateEmail).not.toHaveBeenCalled();
    });

    it('rejects an update from someone who is neither a member nor the mentor', async () => {
        const { group } = await createTestGroup(1);
        const outsider = await createTestUser({ role: UserRole.STUDENT, email: 'outsider-upd@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved' });

        const res = await request(app)
            .post(`/api/projects/${project._id}/updates`)
            .set('x-auth-token', generateToken(outsider))
            .field('content', 'Not mine to post on.');

        expect(res.status).toBe(403);
    });
});
