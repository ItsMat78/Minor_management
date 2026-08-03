/**
 * Integration tests for the supervisor student cap as students meet it.
 *
 * The cap used to be enforced only when the mentor pressed Approve, which returned the refusal
 * to the mentor and left the proposal sitting at Pending — the group was never told anything.
 * These cover the submit-time guard that now refuses the submission up front (POST /api/projects
 * and PUT /api/projects/:id), plus the approval-time check that remains the authority.
 */
import request from 'supertest';
import app from '../../app';
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
}));

/**
 * A faculty capped at `maxStudents` who already mentors `alreadyMentoring` approved students.
 * The load is spread over as many groups as it takes, since a group holds at most 3 members.
 */
async function mentorWithLoad(maxStudents: number, alreadyMentoring: number, name = 'Dr. Busy') {
    const mentor = await createTestUser({ role: UserRole.FACULTY, name });
    await User.findByIdAndUpdate(mentor._id, { maxStudents });

    for (let left = alreadyMentoring; left > 0; ) {
        const size = Math.min(3, left);
        const existing = await createTestGroup(size);
        await createTestProject(existing.group._id, { status: 'Approved', faculty: mentor._id as any });
        left -= size;
    }

    return (await User.findById(mentor._id))!;
}

// ── POST /api/projects ───────────────────────────────────────────────────────

describe('POST /api/projects — supervisor capacity', () => {
    it('refuses a submission to a mentor with no room, and says so in the group\'s terms', async () => {
        // 3-student group aiming at a mentor capped at 4 who already has 2: 2 + 3 > 4.
        const { group, members } = await createTestGroup(3);
        const mentor = await mentorWithLoad(4, 2, 'Dr. Full');

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Overflow', description: 'Desc', status: 'Pending', facultyId: String(mentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);
        expect(res.body.message).toMatch(/Dr\. Full/);
        expect(res.body.message).toMatch(/only 2 places left/i);
        expect(res.body.message).toMatch(/pick a different mentor/i);
        expect(res.body.limit).toMatchObject({ maxStudents: 4, currentStudents: 2, incoming: 3, remaining: 2 });

        // Nothing was created, so the group can still submit elsewhere.
        expect(await Project.countDocuments({ group: group._id })).toBe(0);
    });

    it('still saves a Draft naming a full mentor', async () => {
        // A draft commits nobody, so the group may pencil in a mentor and decide later.
        const { members } = await createTestGroup(3);
        const mentor = await mentorWithLoad(4, 4);

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Draft', description: 'Desc', status: 'Draft', facultyId: String(mentor._id) });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('Draft');
    });

    it('allows a submission that exactly fills the mentor', async () => {
        const { members } = await createTestGroup(2);
        const mentor = await mentorWithLoad(4, 2);

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Exact Fit', description: 'Desc', status: 'Pending', facultyId: String(mentor._id) });

        expect(res.status).toBe(201);
    });

    it('ignores the mentor\'s archived past-semester load', async () => {
        const { members } = await createTestGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(mentor._id, { maxStudents: 2 });

        const past = await createTestGroup(3);
        const pastProject = await createTestProject(past.group._id, { status: 'Approved', faculty: mentor._id as any });
        await Project.findByIdAndUpdate(pastProject._id, { isArchived: true });

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'New Semester', description: 'Desc', status: 'Pending', facultyId: String(mentor._id) });

        expect(res.status).toBe(201);
    });

    it('does not count a mentor\'s pending proposals against them', async () => {
        // Only approved work holds a place — a mentor may still reject what is queued, and
        // counting it would let one group's unapproved proposal block everyone else.
        const { members } = await createTestGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(mentor._id, { maxStudents: 2 });

        const queued = await createTestGroup(2);
        await createTestProject(queued.group._id, { status: 'Pending', faculty: mentor._id as any });

        const res = await request(app)
            .post('/api/projects')
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Also Queued', description: 'Desc', status: 'Pending', facultyId: String(mentor._id) });

        expect(res.status).toBe(201);
    });
});

// ── PUT /api/projects/:id ────────────────────────────────────────────────────

describe('PUT /api/projects/:id — supervisor capacity', () => {
    it('refuses promoting a Draft to Pending under a mentor with no room', async () => {
        const { group, members } = await createTestGroup(3);
        const mentor = await mentorWithLoad(4, 2);
        const project = await createTestProject(group._id, { status: 'Draft' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Promoted', description: 'Desc', status: 'Pending', facultyId: String(mentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);

        // The edit was refused whole — it did not half-apply and leave a Pending with no mentor.
        const saved = await Project.findById(project._id);
        expect(saved!.status).toBe('Draft');
        expect(saved!.faculty).toBeFalsy();
    });

    it('refuses swapping a live Pending proposal onto a mentor with no room', async () => {
        // This edit changes the mentor without changing the status, so it bypassed the old
        // status-transition guard entirely.
        const { group, members } = await createTestGroup(3);
        const firstMentor = await createTestUser({ role: UserRole.FACULTY });
        const fullMentor = await mentorWithLoad(4, 4);
        const project = await createTestProject(group._id, { status: 'Pending', faculty: firstMentor._id as any });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Swap', description: 'Desc', status: 'Pending', facultyId: String(fullMentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);
        expect(String((await Project.findById(project._id))!.faculty)).toBe(String(firstMentor._id));
    });

    it('allows editing an Approved project whose mentor is over the current cap', async () => {
        // The mentor is locked on an approved project, so capacity cannot change here and an
        // admin lowering the limit afterwards must not freeze the group out of its own edits.
        const { group, members } = await createTestGroup(3);
        const mentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(mentor._id, { maxStudents: 1 });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: mentor._id as any });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Refined Title', description: 'Desc', status: 'Pending' });

        expect(res.status).toBe(200);
        const saved = await Project.findById(project._id);
        expect(saved!.status).toBe('Approved');
        expect(saved!.title).toBe('Refined Title');
    });

    it('allows a Draft edit that keeps a full mentor pencilled in', async () => {
        const { group, members } = await createTestGroup(3);
        const mentor = await mentorWithLoad(4, 4);
        const project = await createTestProject(group._id, { status: 'Draft' });

        const res = await request(app)
            .put(`/api/projects/${project._id}`)
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Still A Draft', description: 'Desc', status: 'Draft', facultyId: String(mentor._id) });

        expect(res.status).toBe(200);
        expect((await Project.findById(project._id))!.status).toBe('Draft');
    });
});

// ── PUT /api/projects/:id/status ─────────────────────────────────────────────

describe('PUT /api/projects/:id/status — supervisor capacity', () => {
    it('remains the authority when queued proposals overflow the cap', async () => {
        // Two 2-student groups both pass the submit-time check against a mentor with 2 places
        // (pending work holds no place), so approval is where the overflow is caught.
        const mentor = await mentorWithLoad(2, 0, 'Dr. Tight');
        const first = await createTestGroup(2);
        const second = await createTestGroup(2);
        const firstProject = await createTestProject(first.group._id, { status: 'Pending', faculty: mentor._id as any });
        const secondProject = await createTestProject(second.group._id, { status: 'Pending', faculty: mentor._id as any });

        const approve = (id: any) => request(app)
            .put(`/api/projects/${id}/status`)
            .set('x-auth-token', generateToken(mentor))
            .send({ status: 'Approved' });

        expect((await approve(firstProject._id)).status).toBe(200);

        const res = await approve(secondProject._id);
        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);
        expect(res.body.message).toMatch(/supervisor limit reached/i);
        expect(res.body.message).toMatch(/Dr\. Tight/);
        expect(res.body.limit).toMatchObject({ maxStudents: 2, currentStudents: 2, incoming: 2 });

        // Refused outright — the proposal stays Pending for the mentor to decide on.
        expect((await Project.findById(secondProject._id))!.status).toBe('Pending');
    });

    it('does not count the project being approved against its own mentor', async () => {
        const mentor = await mentorWithLoad(2, 0);
        const { group } = await createTestGroup(2);
        const project = await createTestProject(group._id, { status: 'Pending', faculty: mentor._id as any });

        const res = await request(app)
            .put(`/api/projects/${project._id}/status`)
            .set('x-auth-token', generateToken(mentor))
            .send({ status: 'Approved' });

        expect(res.status).toBe(200);
    });
});
