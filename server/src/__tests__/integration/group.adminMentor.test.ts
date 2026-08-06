/**
 * Integration tests for PUT /api/groups/:id/mentor — the admin reassigning a group's
 * supervisor from the Group Directory.
 *
 * Two shapes of the same operation. With a project, the supervisor on it is swapped. Without
 * one, there is nowhere to hold a supervisor, so the office files the group's proposal in full
 * — title, description, tags, attachments — and the mentor comes with it; `status` decides
 * whether that goes to the mentor for review or is approved outright.
 *
 * These cover both, plus admin-only access, archived groups read-only, the cap refusal (which
 * tells the admin to raise that supervisor's limit rather than overbooking them), and that a
 * refusal leaves nothing behind.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import Project from '../../models/Project';
import User, { UserRole } from '../../models/User';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';
import { sendMentorChangeEmail, sendProposalSubmissionEmail } from '../../utils/emailService';

const mockMentorEmail = sendMentorChangeEmail as jest.Mock;
const mockSubmissionEmail = sendProposalSubmissionEmail as jest.Mock;

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

    it('tells the new mentor, the previous mentor and the group', async () => {
        mockMentorEmail.mockClear();
        const { group, members } = await createTestGroup(2);
        const oldMentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Outgoing', email: 'outgoing@t.ac.in' });
        const project = await createTestProject(group._id, { status: 'Approved', faculty: oldMentor._id as any });
        group.project = project._id as any;
        await group.save();
        const newMentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Incoming', email: 'incoming@t.ac.in' });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });
        expect(res.status).toBe(200);

        expect(mockMentorEmail).toHaveBeenCalledTimes(3);
        const byAudience = Object.fromEntries(
            mockMentorEmail.mock.calls.map(([emails, audience, opts]: any) => [audience, { emails, opts }])
        );

        expect(byAudience['new-mentor'].emails).toEqual(['incoming@t.ac.in']);
        expect(byAudience['previous-mentor'].emails).toEqual(['outgoing@t.ac.in']);
        expect(byAudience['members'].emails).toEqual(
            expect.arrayContaining(members.map(m => m.email))
        );

        // Every audience gets the same facts, including who it moved from and to.
        for (const audience of ['new-mentor', 'previous-mentor', 'members']) {
            expect(byAudience[audience].opts).toMatchObject({
                projectTitle: 'Test Project',
                newMentorName: 'Dr. Incoming',
                previousMentorName: 'Dr. Outgoing',
            });
        }
    });

    it('skips the previous-mentor email when the project had no mentor', async () => {
        mockMentorEmail.mockClear();
        const { group } = await createTestGroup(1);
        await createTestProject(group._id, { status: 'Pending' }); // no faculty
        const newMentor = await createTestUser({ role: UserRole.FACULTY, email: 'first@t.ac.in' });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });
        expect(res.status).toBe(200);

        const audiences = mockMentorEmail.mock.calls.map(([, audience]: any) => audience);
        expect(audiences).toEqual(expect.arrayContaining(['new-mentor', 'members']));
        expect(audiences).not.toContain('previous-mentor');
    });

    it('sends nothing when the reassignment is refused', async () => {
        mockMentorEmail.mockClear();
        const { group } = await mentoredGroup(3);
        const newMentor = await createTestUser({ role: UserRole.FACULTY });
        await User.findByIdAndUpdate(newMentor._id, { maxStudents: 1 });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(400);
        expect(mockMentorEmail).not.toHaveBeenCalled();
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

    // A group with no project is the admin-created case: the mentor lives on the proposal, so the
    // office files the proposal in full rather than a stub created to hold the mentor.

    it('refuses to file a proposal with no title, and creates nothing', async () => {
        const { group } = await createTestGroup(2); // never proposed anything
        const newMentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id) });

        expect(res.status).toBe(400);
        expect(res.body.needsProject).toBe(true);
        expect(res.body.message).toMatch(/no proposal yet/i);
        expect(await Project.findOne({ group: group._id })).toBeNull();

        // The group is untouched — in particular not silently approved.
        const stored = await Group.findById(group._id);
        expect(stored!.project).toBeFalsy();
        expect(stored!.status).toBe('Forming');
    });

    it('refuses a title with no description, as the student proposal form does', async () => {
        const { group } = await createTestGroup(2);
        const newMentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(newMentor._id), title: 'Title Only' });

        expect(res.status).toBe(400);
        expect(res.body.needsProject).toBe(true);
        expect(await Project.findOne({ group: group._id })).toBeNull();
    });

    it('keeps the attachments uploaded with the filing', async () => {
        const { group } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .field('facultyId', String(mentor._id))
            .field('title', 'With Attachments')
            .field('description', 'Filed with a file.')
            .attach('files', Buffer.from('proposal annexure'), 'annexure.txt');

        expect(res.status).toBe(200);
        const project = await Project.findOne({ group: group._id });
        // Stored under the proposals bucket like any other proposal attachment (the uploader
        // renames files, so the URL carries the extension rather than the original name).
        expect(project!.attachments).toHaveLength(1);
        expect(project!.attachments![0]).toMatch(/\/uploads\/proposals\/.+\.txt$/);
    });

    it('files the proposal for review by default, leaving the decision to the mentor', async () => {
        const { group } = await createTestGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Reviewer' });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({
                facultyId: String(mentor._id),
                title: 'Campus Navigation',
                description: 'Filed by the office.',
                tags: 'Web, Maps'
            });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/sent to Dr. Reviewer for review/i);

        const project = await Project.findOne({ group: group._id });
        expect(project!.title).toBe('Campus Navigation');
        expect(project!.description).toBe('Filed by the office.');
        expect(project!.tags).toEqual(['Web', 'Maps']);
        expect(project!.status).toBe('Pending');
        expect(String(project!.faculty)).toBe(String(mentor._id));

        // The group is waiting on a decision, not approved behind the mentor's back.
        const stored = await Group.findById(group._id);
        expect(stored!.status).toBe('ProposalPending');
        expect(String(stored!.project)).toBe(String(project!._id));
    });

    it('approves outright when the admin asks for it', async () => {
        const { group } = await createTestGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Final' });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(mentor._id), title: 'Placed By Office', description: 'Filed by the office.', status: 'Approved' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/approved with Dr. Final/i);

        const project = await Project.findOne({ group: group._id });
        expect(project!.status).toBe('Approved');

        const stored = await Group.findById(group._id);
        expect(stored!.status).toBe('Approved');
        expect(String(stored!.project)).toBe(String(project!._id));
    });

    it('rejects a filing status that is neither Pending nor Approved', async () => {
        const { group } = await createTestGroup(1);
        const mentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(mentor._id), title: 'Draft Sneak', description: 'Desc', status: 'Draft' });

        expect(res.status).toBe(400);
        expect(await Project.findOne({ group: group._id })).toBeNull();
    });

    it('numbers an unnumbered group when the office files its proposal', async () => {
        // A student-formed group only earns its number when a proposal lands, so filing one for
        // them has to do the same.
        const { group } = await createTestGroup(2);
        await Group.findByIdAndUpdate(group._id, { name: undefined, targetBatch: '2024' });
        const mentor = await createTestUser({ role: UserRole.FACULTY });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(mentor._id), title: 'Needs A Number', description: 'Desc' });

        expect(res.status).toBe(200);
        const stored = await Group.findById(group._id);
        expect(Number.isNaN(parseInt(stored!.name || ''))).toBe(false);
    });

    it('still enforces the student limit when filing a proposal', async () => {
        const { group } = await createTestGroup(3);
        const mentor = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Booked' });
        await User.findByIdAndUpdate(mentor._id, { maxStudents: 2 });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(mentor._id), title: 'Too Many', description: 'Desc' });

        expect(res.status).toBe(400);
        expect(res.body.limitExceeded).toBe(true);
        // Nothing was created on the way to the refusal.
        expect(await Project.findOne({ group: group._id })).toBeNull();
        expect((await Group.findById(group._id))!.status).toBe('Forming');
    });

    it('reaches the mentor as a submission, not a mentor change, when filed for review', async () => {
        mockMentorEmail.mockClear();
        mockSubmissionEmail.mockClear();
        const { group } = await createTestGroup(2);
        const mentor = await createTestUser({ role: UserRole.FACULTY, email: 'reviewer@t.ac.in' });

        const res = await request(app)
            .put(`/api/groups/${group._id}/mentor`)
            .set('x-auth-token', await adminToken())
            .send({ facultyId: String(mentor._id), title: 'For Review', description: 'Desc' });
        expect(res.status).toBe(200);

        expect(mockSubmissionEmail).toHaveBeenCalledTimes(1);
        expect(mockSubmissionEmail.mock.calls[0][0]).toEqual(['reviewer@t.ac.in']);

        // The mentor is not also told their mentorship "changed" — only the group is written to.
        const audiences = mockMentorEmail.mock.calls.map(([, audience]: any) => audience);
        expect(audiences).toEqual(['members']);
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
