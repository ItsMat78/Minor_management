/**
 * Integration tests for PUT /api/groups/:id/mentor — the admin reassigning a group's
 * supervisor from the Group Directory.
 *
 * The mentor lives on the group's project, and the incoming supervisor's semester-wide
 * student cap is a hard limit, so these cover: admin-only access, the project requirement,
 * archived groups read-only, a successful swap, and the cap refusal (which tells the admin
 * to raise that supervisor's limit rather than silently overbooking them).
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
}));

const adminToken = async () => generateToken(await createTestUser({ role: UserRole.ADMIN }));

// A group with an approved project already supervised by `oldMentor`.
async function mentoredGroup(memberCount = 2) {
    const { group, members } = await createTestGroup(memberCount);
    const oldMentor = await createTestUser({ role: UserRole.FACULTY });
    const project = await createTestProject(group._id, { status: 'Approved', faculty: oldMentor._id as any });
    group.project = project._id as any;
    group.status = 'Approved';
    await group.save();
    return { group, members, oldMentor, project };
}

describe('PUT /api/groups/:id/mentor', () => {
    it('rejects a non-admin caller', async () => {
        const { group, members, oldMentor } = await mentoredGroup();
        const newMentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', generateToken(members[0]))
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(403);
        const saved = await Project.findOne({ group: group._id });
        expect(String(saved!.faculty)).toBe(String(oldMentor._id));
    });

    it('moves the group to the new supervisor', async () => {
        const { group, project } = await mentoredGroup();
        const newMentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Newcomer' });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Dr. Newcomer/);
        expect(String((await Project.findById(project._id))!.faculty)).toBe(String(newMentor._id));
    });

    it('refuses a swap that would break the new supervisor\'s student limit', async () => {
        // 3-student group moving to a supervisor capped at 4 who already mentors 2.
        const { group } = await mentoredGroup(3);
        const newMentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Full' });
        await User.findByIdAndUpdate(newMentor._id, { maxStudents: 4 });

        const existing = await createTestGroup(2);
        await createTestProject(existing.group._id, { status: 'Approved', faculty: newMentor._id as any });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);
        expect(res.body.message).toMatch(/mentee limit reached/i);
        expect(res.body.message).toMatch(/raise their student limit/i);
        expect(res.body.limit).toMatchObject({ facultyName: 'Dr. Full', maxStudents: 4, currentStudents: 2, incoming: 3 });

        // Nothing moved.
        const saved = await Project.findOne({ group: group._id });
        expect(String(saved!.faculty)).not.toBe(String(newMentor._id));
    });

    it('allows a swap that exactly fills the new supervisor\'s limit', async () => {
        const { group } = await mentoredGroup(2);
        const newMentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(newMentor._id, { maxStudents: 4 });

        const existing = await createTestGroup(2);
        await createTestProject(existing.group._id, { status: 'Approved', faculty: newMentor._id as any });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(200);
    });

    it('ignores the supervisor\'s archived past-semester load when counting', async () => {
        const { group } = await mentoredGroup(2);
        const newMentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(newMentor._id, { maxStudents: 2 });

        // Last semester's 3-student group, archived — must not count against this semester.
        const past = await createTestGroup(3);
        const pastProject = await createTestProject(past.group._id, { status: 'Approved', faculty: newMentor._id as any });
        await Project.findByIdAndUpdate(pastProject._id, { isArchived: true });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(200);
    });

    it('does not count the group being reassigned twice when it returns to a supervisor', async () => {
        // The group's own project must be excluded from the incoming supervisor's load,
        // otherwise reassigning back to a mentor already at their cap would be refused.
        const { group, project } = await mentoredGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(mentor._id, { maxStudents: 2 });
        await Project.findByIdAndUpdate(project._id, { faculty: mentor._id });

        // Park it elsewhere, then bring it back — the cap of 2 must still be satisfiable.
        const interim = await createTestUser({ role: UserRole.FACULTY });
        await Project.findByIdAndUpdate(project._id, { faculty: interim._id });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(mentor._id) });

        expect(res.status).toBe(200);
    });

    it('rejects a faculty id that is not a faculty account', async () => {
        const { group } = await mentoredGroup();
        const student = await createTestUser({ role: UserRole.STUDENT });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(student._id) });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid faculty/i);
    });

    it('rejects re-picking the current mentor', async () => {
        const { group, oldMentor } = await mentoredGroup();

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(oldMentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already mentors/i);
    });

    it('rejects a missing facultyId', async () => {
        const { group } = await mentoredGroup();

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({});

        expect(res.status).toBe(400);
    });

    it('400s for a group with no active project', async () => {
        const { group } = await createTestGroup(2); // never proposed anything
        const newMentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no active project/i);
    });

    it('reassigns a Pending proposal even when the group pointer is unset', async () => {
        const { group } = await createTestGroup(1);
        const oldMentor = await createTestUser({ role: UserRole.FACULTY });
        const project = await createTestProject(group._id, { status: 'Pending', faculty: oldMentor._id as any });
        const newMentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(200);
        expect(String((await Project.findById(project._id))!.faculty)).toBe(String(newMentor._id));
    });

    it('refuses to touch an archived group', async () => {
        const { group } = await mentoredGroup();
        await Group.findByIdAndUpdate(group._id, { isArchived: true });
        const newMentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(403);
    });
});
