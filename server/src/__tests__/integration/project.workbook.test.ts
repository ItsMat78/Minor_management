/**
 * Integration tests for the weekly workbook: members write weeks, the mentor marks attendance
 * and approves (locks) them, and the mentor/admin can export it.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import Project from '../../models/Project';
import { createTestUser, createTestGroup, createTestProject, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
}));

const setup = async () => {
    const mentor = await createTestUser({ role: UserRole.FACULTY, name: 'Mentor' });
    const { group, members } = await createTestGroup(2);
    const project = await createTestProject(group._id as any, { status: 'Approved', faculty: mentor._id as any });
    group.project = project._id as any;
    await group.save();
    return { mentor, members, project, group };
};

const put = (url: string, user: any, body: any) => request(app).put(url).set('x-auth-token', generateToken(user)).send(body);
const base = (project: any) => `/api/projects/${project._id}/workbook`;

describe('Workbook: writing a week', () => {
    it('lets a member write and rewrite a week, tracking the last editor', async () => {
        const { members, project } = await setup();
        let res = await put(`${base(project)}/3`, members[0], { content: 'Set up repo' });
        expect(res.status).toBe(200);
        res = await put(`${base(project)}/3`, members[1], { content: 'Set up repo and CI' });
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({ week: 3, content: 'Set up repo and CI', lastEditedBy: String(members[1]._id) });
    });

    it('rejects non-members, out-of-range weeks, and the mentor', async () => {
        const { mentor, project } = await setup();
        const outsider = await createTestUser({ rollNumber: '23IT099' });
        expect((await put(`${base(project)}/1`, outsider, { content: 'x' })).status).toBe(403);
        expect((await put(`${base(project)}/1`, mentor, { content: 'x' })).status).toBe(403);
        const { members } = await setup();
        expect((await put(`${base(project)}/16`, members[0], { content: 'x' })).status).toBe(400);
        expect((await put(`${base(project)}/0`, members[0], { content: 'x' })).status).toBe(400);
    });

    it('clears a week when saved empty', async () => {
        const { members, project } = await setup();
        await put(`${base(project)}/2`, members[0], { content: 'Work' });
        const res = await put(`${base(project)}/2`, members[0], { content: '   ' });
        expect(res.body).toEqual([]);
    });

    it('blocks edits on archived projects', async () => {
        const { members, project } = await setup();
        await Project.findByIdAndUpdate(project._id, { isArchived: true });
        expect((await put(`${base(project)}/1`, members[0], { content: 'x' })).status).toBe(400);
    });
});

describe('Workbook: attendance and approval', () => {
    it('requires content before attendance can be marked', async () => {
        const { mentor, members, project } = await setup();
        const res = await put(`${base(project)}/1/attendance`, mentor, { attendance: { [String(members[0]._id)]: 'present' } });
        expect(res.status).toBe(400);
    });

    it('only the mentor marks attendance, and only for group members', async () => {
        const { mentor, members, project } = await setup();
        await put(`${base(project)}/1`, members[0], { content: 'Work' });
        expect((await put(`${base(project)}/1/attendance`, members[0], { attendance: { [String(members[0]._id)]: 'present' } })).status).toBe(403);
        const outsider = await createTestUser({ rollNumber: '23IT098' });
        expect((await put(`${base(project)}/1/attendance`, mentor, { attendance: { [String(outsider._id)]: 'present' } })).status).toBe(400);
        expect((await put(`${base(project)}/1/attendance`, mentor, { attendance: { [String(members[0]._id)]: 'late' } })).status).toBe(400);

        const res = await put(`${base(project)}/1/attendance`, mentor, { attendance: { [String(members[0]._id)]: 'present' } });
        expect(res.status).toBe(200);
        expect(res.body[0].attendance).toEqual([{ student: String(members[0]._id), status: 'present' }]);
    });

    it('approval needs every member marked, then locks the week until un-approved', async () => {
        const { mentor, members, project } = await setup();
        const [a, b] = members.map(m => String(m._id));
        await put(`${base(project)}/1`, members[0], { content: 'Work' });
        await put(`${base(project)}/1/attendance`, mentor, { attendance: { [a]: 'present' } });
        expect((await put(`${base(project)}/1/approve`, mentor, { approved: true })).status).toBe(400);

        await put(`${base(project)}/1/attendance`, mentor, { attendance: { [b]: 'absent' } });
        expect((await put(`${base(project)}/1/approve`, members[0], { approved: true })).status).toBe(403);
        const approved = await put(`${base(project)}/1/approve`, mentor, { approved: true });
        expect(approved.status).toBe(200);
        expect(approved.body[0].approvedAt).toBeTruthy();

        // Locked: no content or attendance changes
        expect((await put(`${base(project)}/1`, members[1], { content: 'Changed' })).status).toBe(409);
        expect((await put(`${base(project)}/1/attendance`, mentor, { attendance: { [b]: 'present' } })).status).toBe(409);

        // Un-approving unlocks it
        await put(`${base(project)}/1/approve`, mentor, { approved: false });
        const edited = await put(`${base(project)}/1`, members[1], { content: 'Changed' });
        expect(edited.status).toBe(200);
        expect(edited.body[0].content).toBe('Changed');
    });
});

describe('Workbook: export and visibility', () => {
    it('exports xlsx for the mentor and admins only', async () => {
        const { mentor, members, project } = await setup();
        await put(`${base(project)}/1`, members[0], { content: 'Work' });
        const admin = await createTestUser({ role: UserRole.ADMIN });

        const ok = await request(app).get(`${base(project)}/export`).set('x-auth-token', generateToken(mentor));
        expect(ok.status).toBe(200);
        expect(ok.headers['content-type']).toMatch(/spreadsheetml/);
        expect((await request(app).get(`${base(project)}/export`).set('x-auth-token', generateToken(admin))).status).toBe(200);
        expect((await request(app).get(`${base(project)}/export`).set('x-auth-token', generateToken(members[0]))).status).toBe(403);
    });

    it("appears on the owner's archive entry but not on other people's", async () => {
        const { mentor, members, project, group } = await setup();
        const [a, b] = members.map(m => String(m._id));
        await put(`${base(project)}/1`, members[0], { content: 'Work' });
        await put(`${base(project)}/1/attendance`, mentor, { attendance: { [a]: 'present', [b]: 'absent' } });
        await Project.findByIdAndUpdate(project._id, { isArchived: true, archivedMentorName: 'Mentor' });
        await Group.findByIdAndUpdate(group._id, { isArchived: true });

        const own = await request(app).get('/api/projects/archived').set('x-auth-token', generateToken(members[0]));
        expect(own.body[0].workbook[0]).toMatchObject({ week: 1, content: 'Work' });
        expect(own.body[0].workbook[0].attendance.map((x: any) => x.status).sort()).toEqual(['absent', 'present']);

        const stranger = await createTestUser({ rollNumber: '23IT097' });
        const other = await request(app).get('/api/projects/archived').set('x-auth-token', generateToken(stranger));
        expect(other.body[0].workbook).toBeUndefined();
    });
});
