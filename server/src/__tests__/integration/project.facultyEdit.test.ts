/**
 * Integration tests for PUT /api/projects/:id/details — a supervisor (or the admin)
 * correcting a project's own text.
 *
 * The interesting cases are all about who may write and what they may write: the assigned
 * mentor and the admin yes, any other faculty and the group's own members no (they have
 * updateProject). The route is also deliberately exempt from the mid-term freeze, which is
 * what makes the freeze message's "ask your mentor" advice actionable — covered below so
 * the exemption cannot be removed by accident.
 */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../../app';
import Project from '../../models/Project';
import Event, { EventType } from '../../models/Event';
import { UserRole } from '../../models/User';
import { createTestUser, generateToken, createTestGroup, createTestProject } from '../helpers/factories';
import { sendProjectDetailsChangedEmail } from '../../utils/emailService';

const mockDetailsEmail = sendProjectDetailsChangedEmail as jest.Mock;

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

// An approved project with `mentor` supervising a two-student group.
async function mentoredProject() {
    const mentor = await createTestUser({ role: UserRole.FACULTY, email: `mentor-${Date.now()}@t.ac.in`, name: 'Dr Mentor' });
    const { group, members } = await createTestGroup(2);
    const project = await createTestProject(group._id as any, {
        title: 'Origional Titel',
        status: 'Approved',
        faculty: mentor._id as any,
    });
    return { mentor, group, members, project };
}

beforeEach(() => {
    mockDetailsEmail.mockClear();
});

describe('PUT /api/projects/:id/details', () => {
    it('lets the assigned mentor fix the title', async () => {
        const { mentor, project } = await mentoredProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Original Title' });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.title).toBe('Original Title');
    });

    it('lets the admin edit description and tags too', async () => {
        const { project } = await mentoredProject();
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `admin-${Date.now()}@t.ac.in` });

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(admin))
            .send({ description: 'A clearer description', tags: 'ml, vision' });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.description).toBe('A clearer description');
        expect(stored!.tags).toEqual(['ml', 'vision']);
    });

    it('refuses a faculty who does not mentor this project', async () => {
        const { project } = await mentoredProject();
        const stranger = await createTestUser({ role: UserRole.FACULTY, email: `other-${Date.now()}@t.ac.in` });

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(stranger))
            .send({ title: 'Hijacked' });

        expect(res.status).toBe(403);
        const stored = await Project.findById(project._id);
        expect(stored!.title).toBe('Origional Titel');
    });

    it('refuses the group\'s own members — they have updateProject', async () => {
        const { members, project } = await mentoredProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(members[0]))
            .send({ title: 'Student Edit' });

        expect(res.status).toBe(403);
    });

    it('cannot be used to change the mentor or the status', async () => {
        const { mentor, project } = await mentoredProject();
        const other = await createTestUser({ role: UserRole.FACULTY, email: `swap-${Date.now()}@t.ac.in` });

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Renamed', status: 'Rejected', faculty: other._id, facultyId: other._id });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.title).toBe('Renamed');
        expect(stored!.status).toBe('Approved');
        expect(String(stored!.faculty)).toBe(String(mentor._id));
    });

    it('refuses an archived project', async () => {
        const { mentor, project } = await mentoredProject();
        project.isArchived = true;
        await project.save();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Too Late' });

        expect(res.status).toBe(400);
    });

    it('rejects a no-op edit', async () => {
        const { mentor, project } = await mentoredProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Origional Titel' });

        expect(res.status).toBe(400);
    });

    it('still works after mid-term evaluation has opened', async () => {
        const { mentor, project } = await mentoredProject();
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `ev-${Date.now()}@t.ac.in` });

        // The freeze looks for a mid-term window that started after the current cycle's
        // group-formation window — build both so projectDetailsFrozen would be true for a student.
        await Event.create({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            startDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
            endDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
            isActive: false, createdBy: admin._id,
        });
        await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            startDate: new Date(Date.now() - 24 * 3600 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            isActive: true, createdBy: admin._id,
        });

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Corrected During Evaluation' });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.title).toBe('Corrected During Evaluation');
    });

    // ── Attachments ───────────────────────────────────────────────────────────
    //
    // `existingAttachments` is the surviving list; anything missing from it is removed
    // and deleted from disk. Same wire shape the student editor uses.

    it('adds an uploaded file to the attachments', async () => {
        const { mentor, project } = await mentoredProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .field('title', 'Origional Titel')
            .attach('files', Buffer.from('%PDF-1.4'), { filename: 'spec.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.attachments).toHaveLength(1);
        expect(stored!.attachments![0]).toMatch(/\/uploads\/proposals\//);
    });

    it('removes an attachment the editor dropped, and deletes it from disk', async () => {
        const { mentor, project } = await mentoredProject();

        // Upload two, then save keeping only the first.
        const first = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .field('title', 'Origional Titel')
            .attach('files', Buffer.from('one'), { filename: 'one.txt', contentType: 'text/plain' })
            .attach('files', Buffer.from('two'), { filename: 'two.txt', contentType: 'text/plain' });

        const [keep, drop] = first.body.attachments;
        const droppedPath = path.join(process.env.UPLOAD_DIR!, drop.split('/uploads/')[1]);
        expect(fs.existsSync(droppedPath)).toBe(true);

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .field('existingAttachments', JSON.stringify([keep]));

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.attachments).toEqual([keep]);
        expect(fs.existsSync(droppedPath)).toBe(false);
    });

    it('ignores attachment URLs the project does not already own', async () => {
        const { mentor, project } = await mentoredProject();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .field('existingAttachments', JSON.stringify(['http://evil.test/uploads/submissions/someone-elses.pdf']))
            .field('title', 'Renamed To Force A Change');

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.attachments).toEqual([]);
    });

    it('leaves attachments alone when the field is absent', async () => {
        const { mentor, project } = await mentoredProject();
        project.attachments = ['http://localhost:5000/uploads/proposals/keepme.pdf'];
        await project.save();

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Just A Rename' });

        expect(res.status).toBe(200);
        const stored = await Project.findById(project._id);
        expect(stored!.attachments).toEqual(['http://localhost:5000/uploads/proposals/keepme.pdf']);
    });

    it('refuses attachment edits from a faculty who does not mentor the project', async () => {
        const { project } = await mentoredProject();
        const stranger = await createTestUser({ role: UserRole.FACULTY, email: `att-${Date.now()}@t.ac.in` });

        const res = await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(stranger))
            .field('existingAttachments', JSON.stringify([]));

        expect(res.status).toBe(403);
    });

    it('tells the group their details changed', async () => {
        const { mentor, project } = await mentoredProject();

        await request(app)
            .put(`/api/projects/${project._id}/details`)
            .set('x-auth-token', generateToken(mentor))
            .send({ title: 'Original Title' });

        expect(mockDetailsEmail).toHaveBeenCalledTimes(1);
        const [emails, opts] = mockDetailsEmail.mock.calls[0];
        expect(emails).toHaveLength(2);
        expect(opts.previousTitle).toBe('Origional Titel');
        expect(opts.newTitle).toBe('Original Title');
        expect(opts.changedFields).toEqual(['title']);
    });
});
