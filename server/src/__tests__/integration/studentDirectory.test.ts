/**
 * Regression test for the "couldn't select anyone in the directory" bug.
 *
 * GET /api/users/students marks each student isGrouped. It must only count membership
 * in ACTIVE (non-archived) groups — otherwise every student who was in a group last
 * semester (archived at rollover) stays flagged "grouped" forever and is unselectable.
 */
import request from 'supertest';
import app from '../../app';
import Group from '../../models/Group';
import { createTestUser, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }), getEmailOutage: jest.fn().mockReturnValue(null), emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable') }));

async function makeGroup(memberId: any, isArchived: boolean) {
    return Group.create({
        name: `G-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        members: [memberId],
        createdBy: memberId,
        status: isArchived ? 'Dissolved' : 'Forming',
        inviteCode: Math.random().toString(36).slice(2),
        isArchived,
    });
}

describe('GET /api/users/students — isGrouped ignores archived groups', () => {
    it('marks an archived-group member as selectable and an active-group member as grouped', async () => {
        const viewer = await createTestUser({ role: UserRole.STUDENT, rollNumber: '231000001' });
        const archivedMember = await createTestUser({ role: UserRole.STUDENT, rollNumber: '231000002' });
        const activeMember = await createTestUser({ role: UserRole.STUDENT, rollNumber: '231000003' });

        await makeGroup(archivedMember._id, true);  // last semester, archived
        await makeGroup(activeMember._id, false);   // this semester, active

        const res = await request(app)
            .get('/api/users/students')
            .set('x-auth-token', generateToken(viewer));

        expect(res.status).toBe(200);
        const byId = (id: any) => res.body.find((s: any) => s._id === id.toString());

        expect(byId(archivedMember._id)?.isGrouped).toBe(false); // the bug: was true
        expect(byId(activeMember._id)?.isGrouped).toBe(true);
    });
});

/**
 * Regression test for "the Create Group picker only lists 2 of the 7 ungrouped students".
 *
 * status=available used to be applied in JS to the already-paginated page, so a paginated
 * caller got the ungrouped students that happened to fall inside the first N by roll number
 * rather than the first N ungrouped students — and `total` counted the unfiltered set.
 */
describe('GET /api/users/students — status filter and pagination', () => {
    // 25 grouped students sorting BEFORE 7 ungrouped ones, so a limit-25 page of the
    // unfiltered set would contain none of the ungrouped students.
    async function batchWhereGroupedSortFirst() {
        const ungrouped = [];
        for (let i = 1; i <= 25; i++) {
            const s = await createTestUser({
                rollNumber: `24CS${String(i).padStart(3, '0')}`,
                email: `grouped-${i}-${Date.now()}@iiitnr.ac.in`,
            });
            await makeGroup(s._id, false);
        }
        for (let i = 26; i <= 32; i++) {
            ungrouped.push(await createTestUser({
                rollNumber: `24CS${String(i).padStart(3, '0')}`,
                email: `free-${i}-${Date.now()}@iiitnr.ac.in`,
            }));
        }
        return ungrouped;
    }

    it('returns every ungrouped student, not just those inside the first page', async () => {
        const ungrouped = await batchWhereGroupedSortFirst();
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `admin-${Date.now()}@iiitnr.ac.in` });

        const res = await request(app)
            .get('/api/users/students')
            .query({ status: 'available', batch: '2024', page: 1, limit: 25 })
            .set('x-auth-token', generateToken(admin));

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(ungrouped.length); // the bug: was 0
        expect(res.body.total).toBe(ungrouped.length);
        for (const s of res.body.data) {
            expect(s.isGrouped).toBe(false);
        }
    });

    it('counts only grouped students when asked for them', async () => {
        await batchWhereGroupedSortFirst();
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `admin2-${Date.now()}@iiitnr.ac.in` });

        const res = await request(app)
            .get('/api/users/students')
            .query({ status: 'grouped', batch: '2024', page: 1, limit: 10 })
            .set('x-auth-token', generateToken(admin));

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(25);
        expect(res.body.data).toHaveLength(10); // one page of them
        expect(res.body.pages).toBe(3);
    });
});
