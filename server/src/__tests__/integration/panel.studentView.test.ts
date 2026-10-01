/**
 * Integration tests for GET /api/panels/my-student-panel — a student's evaluation panel
 * (resolved through their mentor) and the rubrics published via evaluation events.
 */
import request from 'supertest';
import app from '../../app';
import Panel from '../../models/Panel';
import Event, { EventType } from '../../models/Event';
import { createTestUser, createTestGroup, createTestProject, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

// A student (batch 2023, from roll 23IT001) whose approved project is mentored by `mentor`.
const setupMenteeGroup = async () => {
    const mentor = await createTestUser({ role: UserRole.FACULTY, name: 'Mentor', email: 'mentor@t.ac.in' });
    const { group, members } = await createTestGroup(1);
    const project = await createTestProject(group._id as any, { status: 'Approved', faculty: mentor._id as any });
    group.project = project._id as any;
    group.status = 'Approved';
    await group.save();
    return { mentor, student: members[0] };
};

describe('GET /api/panels/my-student-panel', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/panels/my-student-panel');
        expect(res.status).toBe(401);
    });

    it('returns 404 for a student without a group', async () => {
        const student = await createTestUser({ rollNumber: '23IT099' });
        const res = await request(app).get('/api/panels/my-student-panel').set('x-auth-token', generateToken(student));
        expect(res.status).toBe(404);
    });

    it('returns no panel and no rubrics before either has been made', async () => {
        const { student } = await setupMenteeGroup();
        const res = await request(app).get('/api/panels/my-student-panel').set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(res.body.panel).toBeNull();
        expect(res.body.rubrics).toEqual({ 'mid-term': null, 'end-term': null });
    });

    it("returns the panel containing the student's mentor for their batch", async () => {
        const { mentor, student } = await setupMenteeGroup();
        const other = await createTestUser({ role: UserRole.FACULTY, name: 'Other', email: 'other@t.ac.in' });
        await Panel.create({ faculty: [other._id], batchYear: 2023 });
        await Panel.create({ faculty: [mentor._id], batchYear: 2024 }); // wrong batch
        await Panel.create({ faculty: [mentor._id], batchYear: 2023, isArchived: true }); // archived
        const mine = await Panel.create({ faculty: [other._id, mentor._id], batchYear: 2023, room: 'LH-1' });

        const res = await request(app).get('/api/panels/my-student-panel').set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(String(res.body.panel._id)).toBe(String(mine._id));
        expect(res.body.panel.room).toBe('LH-1');
        expect(res.body.panel.faculty.map((f: any) => f.name).sort()).toEqual(['Mentor', 'Other']);
        expect(res.body.mentorId).toBe(String(mentor._id));
        // Numbered by creation order within the batch, as the faculty panel view does
        expect(res.body.panelNumber).toBe(3);
    });

    it('returns the rubric of the latest evaluation event for the batch', async () => {
        const { student } = await setupMenteeGroup();
        const custom = { maxMarks: 10, sections: [{ key: 'panel', title: 'Panel', maxMarks: 10, fields: [{ key: 'demo', label: 'Demo', max: 10 }] }] };
        const endDate = new Date(Date.now() + 86400000);
        await Event.create({ type: EventType.MID_TERM_EVALUATION, endDate, batchYear: '2023', rubricParams: custom });
        await Event.create({ type: EventType.END_TERM_EVALUATION, endDate, batchYear: '2024', rubricParams: custom }); // other batch

        const res = await request(app).get('/api/panels/my-student-panel').set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(res.body.rubrics['mid-term'].rubricParams).toEqual(custom);
        expect(res.body.rubrics['end-term']).toBeNull();
    });

    it('marks an event without a custom rubric as using the default (rubricParams null)', async () => {
        const { student } = await setupMenteeGroup();
        await Event.create({ type: EventType.END_TERM_EVALUATION, endDate: new Date(Date.now() + 86400000) });

        const res = await request(app).get('/api/panels/my-student-panel').set('x-auth-token', generateToken(student));
        expect(res.body.rubrics['end-term']).not.toBeNull();
        expect(res.body.rubrics['end-term'].rubricParams).toBeNull();
    });
});
