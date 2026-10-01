/**
 * Integration tests for the archive endpoints: every user sees every archived (approved) project,
 * limited to title/description/tags/members/supervisor/session/semester unless it is their own.
 * Students see only their own marks; the mentor sees every member's.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import Project from '../../models/Project';
import { createTestUser, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
}));

const PUBLIC_KEYS = ['_id', 'batch', 'description', 'isMine', 'members', 'semester', 'session', 'supervisor', 'tags', 'title'];

// An archived group of `members` with an approved project, as left behind by a rollover in
// "Even 2024-25" (batch 2023 → semester 4). Each member gets mid 20 + index, end 40 + index.
const archiveGroup = async (members: any[], title: string, mentorName: string, status = 'Approved') => {
    const group = await Group.create({
        name: `G-${title}`, members: members.map(m => m._id), createdBy: members[0]._id,
        status: 'Dissolved', isArchived: true, targetBatch: '2023', archivedSession: 'Even 2024-25'
    });
    const project = await Project.create({
        title, description: 'desc', tags: ['ml'], group: group._id, status, isArchived: true,
        archivedMentorName: mentorName, archivedGroupName: group.name, archivedBatch: '2023', archivedSession: 'Even 2024-25',
        feedback: 'private feedback',
        studentEvaluations: members.flatMap((m, i) => [
            { student: m._id, evalType: 'mid-term', marks: 20 + i },
            { student: m._id, evalType: 'end-term', marks: 40 + i },
        ]),
    });
    group.project = project._id as any;
    await group.save();
    return project;
};

const get = (url: string, user: any) => request(app).get(url).set('x-auth-token', generateToken(user));

describe('GET /api/projects/archived (student)', () => {
    it("shows other groups' projects with only the public fields", async () => {
        const me = await createTestUser({ rollNumber: '23IT001' });
        const other = await createTestUser({ name: 'Other Student', rollNumber: '23IT002' });
        await archiveGroup([other], 'Theirs', 'Dr. X');

        const res = await get('/api/projects/archived', me);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        const entry = res.body[0];
        expect(Object.keys(entry).sort()).toEqual(PUBLIC_KEYS);
        expect(entry).toMatchObject({
            title: 'Theirs', description: 'desc', tags: ['ml'], supervisor: 'Dr. X',
            batch: '2023', session: 'Even 2024-25', semester: 4, isMine: false,
            members: [{ name: 'Other Student' }],
        });
        expect(Object.keys(entry.members[0])).toEqual(['name']);
    });

    it('lists own project first, with only their own marks', async () => {
        const me = await createTestUser({ name: 'Me', rollNumber: '23IT001' });
        const mate = await createTestUser({ name: 'Mate', rollNumber: '23IT003' });
        const other = await createTestUser({ rollNumber: '23IT002' });
        await archiveGroup([other], 'Theirs', 'Dr. X');
        await archiveGroup([mate, me], 'Mine', 'Dr. Y');

        const res = await get('/api/projects/archived', me);
        expect(res.body.map((e: any) => e.title)).toEqual(['Mine', 'Theirs']);
        const mine = res.body[0];
        expect(mine.isMine).toBe(true);
        expect(mine.groupName).toBe('G-Mine');
        const meEntry = mine.members.find((m: any) => m.name === 'Me');
        const mateEntry = mine.members.find((m: any) => m.name === 'Mate');
        expect(meEntry.marks).toEqual({ midTerm: 21, endTerm: 41 });
        expect(mateEntry.marks).toBeUndefined();
        expect(mine.feedback).toBeUndefined();
    });

    it('matches imported (group-less) projects to the student by email', async () => {
        const me = await createTestUser({ email: 'mine@t.ac.in', rollNumber: '22IT001' });
        await Project.create({
            title: 'Imported', description: 'd', status: 'Approved', isArchived: true,
            archivedBatch: '2022', archivedSession: 'Odd 2024-25', archivedMentorName: 'Dr. Z',
            archivedMembers: [{ name: 'Me', email: 'mine@t.ac.in', rollNumber: '22IT001' }],
            studentEvaluations: [{ student: me._id, evalType: 'mid-term', marks: 18 }],
        });
        const res = await get('/api/projects/archived', me);
        expect(res.body[0]).toMatchObject({ isMine: true, semester: 5 });
        expect(res.body[0].members[0].marks).toEqual({ midTerm: 18, endTerm: null });
    });

    it('leaves out archived projects that were never approved', async () => {
        const me = await createTestUser({ rollNumber: '23IT001' });
        const other = await createTestUser({ rollNumber: '23IT002' });
        await archiveGroup([other], 'Rejected one', 'Dr. X', 'Rejected');
        const res = await get('/api/projects/archived', me);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/projects/archived/faculty', () => {
    it("lists mentored projects first with every member's marks; others stay public-only", async () => {
        const faculty = await createTestUser({ role: UserRole.FACULTY, name: 'Dr. Y' });
        const s1 = await createTestUser({ rollNumber: '23IT003' });
        const s2 = await createTestUser({ name: 'A', rollNumber: '23IT004' });
        const s3 = await createTestUser({ name: 'B', rollNumber: '23IT005' });
        await archiveGroup([s1], 'Not mentored', 'Dr. X');
        await archiveGroup([s2, s3], 'Mentored', 'Dr. Y');

        const res = await get('/api/projects/archived/faculty', faculty);
        expect(res.status).toBe(200);
        expect(res.body.map((p: any) => p.title)).toEqual(['Mentored', 'Not mentored']);
        expect(res.body[0].members).toEqual([
            { name: 'A', rollNumber: '23IT004', marks: { midTerm: 20, endTerm: 40 } },
            { name: 'B', rollNumber: '23IT005', marks: { midTerm: 21, endTerm: 41 } },
        ]);
        expect(Object.keys(res.body[1]).sort()).toEqual(PUBLIC_KEYS);
    });
});
