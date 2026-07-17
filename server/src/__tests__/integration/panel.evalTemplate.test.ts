/**
 * Round-trip tests for the evaluation template: download -> fill -> import.
 *
 * The template writer and the import parser address columns by index, so they must
 * agree on the layout. These tests fail loudly if either side is changed alone.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import app from '../../app';
import Panel from '../../models/Panel';
import Project from '../../models/Project';
import Group from '../../models/Group';
import { createTestUser, createTestGroup, createTestProject, generateToken } from '../helpers/factories';
import User, { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail2: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

const MENTOR_NAME = 'Dr. Mentor Under Test';
const BATCH = 2023;

// Builds: a guide (mentor) + a panel containing them + a group of 2 whose approved
// project is guided by that mentor. That's what getPanelWithGroups() matches on.
async function seed() {
    const mentor = await createTestUser({
        role: UserRole.FACULTY,
        name: MENTOR_NAME,
        email: `mentor-${Date.now()}@iiitnr.ac.in`,
    });

    const { group, members } = await createTestGroup(2);
    // isParticipating defaults to false, and getPanelWithGroups drops non-participating
    // members — without this the panel resolves to zero groups.
    await User.updateMany({ _id: { $in: members.map(m => m._id) } }, { isParticipating: true });

    // getPanelWithGroups derives the batch from targetBatch, falling back to the roll prefix.
    group.targetBatch = String(BATCH);
    group.status = 'Approved';
    await group.save();

    const project = await createTestProject(group._id, {
        title: 'Round Trip Project',
        faculty: mentor._id,
        status: 'Approved',
    });
    group.project = project._id as any;
    await group.save();

    const panel = await new Panel({
        faculty: [mentor._id],
        batchYear: BATCH,
        room: 'R101',
    }).save();

    return { mentor, group, members, project, panel };
}

async function loadSheet(buffer: Buffer) {
    const tmp = path.join(os.tmpdir(), `tpl-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
    fs.writeFileSync(tmp, buffer);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(tmp);
    fs.unlinkSync(tmp);
    return wb;
}

describe('Evaluation template — mentor column', () => {
    it('per-panel template includes the mentor name on the group row', async () => {
        const { mentor, panel } = await seed();

        const res = await request(app)
            .get(`/api/panels/${panel._id}/evaluation-template?evalType=mid-term`)
            .set('x-auth-token', generateToken(mentor))
            .buffer()
            .parse((r, cb) => {
                const chunks: Buffer[] = [];
                r.on('data', (c: Buffer) => chunks.push(c));
                r.on('end', () => cb(null, Buffer.concat(chunks)));
            });

        expect(res.status).toBe(200);

        const ws = (await loadSheet(res.body)).getWorksheet('Evaluation Template')!;
        expect(ws).toBeDefined();

        // Find the header row, then assert Mentor sits between Project Title and Student Name.
        let headerRow = 0;
        ws.eachRow((row, n) => {
            if (String(row.getCell(1).value || '') === '__GROUP_ID__') headerRow = n;
        });
        expect(headerRow).toBeGreaterThan(0);

        const header = (c: number) => String(ws.getRow(headerRow).getCell(c).value || '');
        expect(header(4)).toBe('Project Title');
        expect(header(5)).toBe('Mentor');
        expect(header(6)).toBe('Student Name');

        // First data row carries the mentor name in the Mentor column.
        const firstData = ws.getRow(headerRow + 1);
        expect(String(firstData.getCell(5).value || '')).toBe(MENTOR_NAME);
    });

    it('round-trips: marks filled into the downloaded template import back correctly', async () => {
        const { mentor, panel, members, project } = await seed();

        const dl = await request(app)
            .get(`/api/panels/${panel._id}/evaluation-template?evalType=mid-term&marksMode=direct`)
            .set('x-auth-token', generateToken(mentor))
            .buffer()
            .parse((r, cb) => {
                const chunks: Buffer[] = [];
                r.on('data', (c: Buffer) => chunks.push(c));
                r.on('end', () => cb(null, Buffer.concat(chunks)));
            });
        expect(dl.status).toBe(200);

        const wb = await loadSheet(dl.body);
        const ws = wb.getWorksheet('Evaluation Template')!;

        let headerRow = 0;
        ws.eachRow((row, n) => {
            if (String(row.getCell(1).value || '') === '__GROUP_ID__') headerRow = n;
        });

        // marksMode=direct + mid-term => 3 rubric cols (Guide/E1/E2) starting after the fixed block.
        const FIXED = 9;
        let filled = 0;
        ws.eachRow((row, n) => {
            if (n <= headerRow) return;
            const gid = String(row.getCell(1).value || '');
            if (gid.length !== 24) return;
            row.getCell(FIXED + 1).value = 10; // Guide
            row.getCell(FIXED + 2).value = 11; // E1
            row.getCell(FIXED + 3).value = 12; // E2
            row.getCell(8).value = 'Present';  // Attendance
            row.getCell(9).value = 4;          // Stars
            filled++;
        });
        expect(filled).toBe(members.length);

        const out = path.join(os.tmpdir(), `filled-${Date.now()}.xlsx`);
        await wb.xlsx.writeFile(out);

        const up = await request(app)
            .post(`/api/panels/${panel._id}/evaluation-import?evalType=mid-term&marksMode=direct`)
            .set('x-auth-token', generateToken(mentor))
            .attach('file', out);
        fs.unlinkSync(out);

        // A column-index mismatch surfaces here: attendance would read off the wrong
        // cell and the import would 400 with validation errors.
        expect(up.status).toBe(200);
        expect(up.body.message).toMatch(/success/i);

        const saved = await Project.findById(project._id).lean() as any;
        expect(saved.studentEvaluations).toHaveLength(members.length);
        const se = saved.studentEvaluations[0];
        expect(se.attendance).toBe('present');
        expect(se.evalType).toBe('mid-term');

        // In 'direct' mode the entered section total is redistributed across that
        // section's rubric keys, so assert the sums rather than a single field.
        const sum = (o: any) => Object.values(o || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
        expect(sum(se.guide)).toBeCloseTo(10);
        expect(sum(se.panel1)).toBeCloseTo(11);
        expect(sum(se.panel2)).toBeCloseTo(12);
        // marks = guide + avg(E1, E2) = 10 + 11.5
        expect(se.marks).toBeCloseTo(21.5);
    });

    it('final sheet export carries the mentor name', async () => {
        const { mentor, panel } = await seed();

        const res = await request(app)
            .get(`/api/panels/${panel._id}/export-final?evalType=full`)
            .set('x-auth-token', generateToken(mentor))
            .buffer()
            .parse((r, cb) => {
                const chunks: Buffer[] = [];
                r.on('data', (c: Buffer) => chunks.push(c));
                r.on('end', () => cb(null, Buffer.concat(chunks)));
            });
        expect(res.status).toBe(200);

        const ws = (await loadSheet(res.body)).getWorksheet('Final Sheet')!;
        let found = false;
        ws.eachRow(row => {
            row.eachCell(cell => {
                if (String(cell.value || '') === MENTOR_NAME) found = true;
            });
        });
        expect(found).toBe(true);
    });
});
