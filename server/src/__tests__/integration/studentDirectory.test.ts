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
