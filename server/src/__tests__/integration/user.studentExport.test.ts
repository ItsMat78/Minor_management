/**
 * Tests for GET /api/users/students/export (Student Directory export).
 * Also bundled into the admin "Complete Export" ZIP under Students/.
 */
import * as XLSX from 'xlsx';
import request from 'supertest';
import app from '../../app';
import { createTestUser, createTestGroup, createTestProject, generateToken } from '../helpers/factories';
import User, { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

const GUIDE_NAME = 'Dr. Guide Under Test';

function readRows(body: Buffer) {
    const wb = XLSX.read(body, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
}

const fetchExport = (token: string) =>
    request(app)
        .get('/api/users/students/export')
        .set('x-auth-token', token)
        .buffer()
        .parse((r, cb) => {
            const chunks: Buffer[] = [];
            r.on('data', (c: Buffer) => chunks.push(c));
            r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

describe('GET /api/users/students/export', () => {
    it('includes the group guide and project status for grouped students', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `admin-${Date.now()}@iiitnr.ac.in` });
        const guide = await createTestUser({
            role: UserRole.FACULTY,
            name: GUIDE_NAME,
            email: `guide-${Date.now()}@iiitnr.ac.in`,
        });

        const { group, members } = await createTestGroup(2);
        const project = await createTestProject(group._id, { faculty: guide._id, status: 'Approved' });
        group.project = project._id as any;
        group.status = 'Approved';
        await group.save();

        const res = await fetchExport(generateToken(admin));
        expect(res.status).toBe(200);

        const rows = readRows(res.body);
        const row = rows.find(r => r['Roll Number'] === members[0].rollNumber);
        expect(row).toBeDefined();
        expect(row['Group Status']).toBe('In Group');
        expect(row['Group Name']).toBe(group.name);
        expect(row['Guide']).toBe(GUIDE_NAME);
        // Regression: 'status' was missing from the query projection, so this was always blank.
        expect(row['Project Status']).toBe('Approved');
    });

    it('leaves guide blank for students not in a group', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `admin2-${Date.now()}@iiitnr.ac.in` });
        const loner = await createTestUser({ rollNumber: '23IT999', email: `loner-${Date.now()}@iiitnr.ac.in` });

        const res = await fetchExport(generateToken(admin));
        expect(res.status).toBe(200);

        const row = readRows(res.body).find(r => r['Roll Number'] === loner.rollNumber);
        expect(row).toBeDefined();
        expect(row['Group Status']).toBe('Unassigned');
        expect(row['Guide']).toBe('');
    });

    it('leaves guide blank when a group has no approved project yet', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, email: `admin3-${Date.now()}@iiitnr.ac.in` });
        const { group, members } = await createTestGroup(1);
        await User.updateMany({ _id: { $in: members.map(m => m._id) } }, { isParticipating: true });

        const res = await fetchExport(generateToken(admin));
        expect(res.status).toBe(200);

        const row = readRows(res.body).find(r => r['Roll Number'] === members[0].rollNumber);
        expect(row).toBeDefined();
        expect(row['Group Status']).toBe('In Group');
        expect(row['Guide']).toBe('');
        expect(row['Project Status']).toBe('Forming');
    });
});
