import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import Project from '../models/Project';
import Group from '../models/Group';
import User, { UserRole } from '../models/User';

// The weekly workbook: WORKBOOK_WEEKS fixed slots per project, independent of events and dates.
//   • any group member may write/rewrite a week's content, until the week is approved;
//   • the mentor marks each member present/absent on a week that has content;
//   • the mentor approves (signs) a week once every member's attendance is marked, which locks
//     it — un-approving unlocks it again.
// Attendance is informational only; it does not feed into marks.
export const WORKBOOK_WEEKS = 15;

const parseWeek = (raw: unknown): number | null => {
    const week = Number(raw);
    return Number.isInteger(week) && week >= 1 && week <= WORKBOOK_WEEKS ? week : null;
};

// Loads the project + its group and works out the caller's relationship to it.
const loadContext = async (req: Request, res: Response) => {
    const userId = String((req as any).user.id);
    const project = await Project.findById(req.params.id);
    if (!project) { res.status(404).json({ message: 'Project not found' }); return null; }
    const group = project.group ? await Group.findById(project.group).select('name members').lean() as any : null;
    const memberIds: string[] = (group?.members || []).map((m: any) => String(m));
    return {
        userId,
        project,
        group,
        memberIds,
        isMember: memberIds.includes(userId),
        isMentor: !!project.faculty && String(project.faculty) === userId,
    };
};

const findEntry = (project: any, week: number) => (project.workbook || []).find((e: any) => e.week === week);

// PUT /projects/:id/workbook/:week  { content } — a group member writes a week. Empty content
// removes the entry (with its attendance) altogether.
export const saveWorkbookWeek = async (req: Request, res: Response) => {
    try {
        const week = parseWeek(req.params.week);
        if (!week) return res.status(400).json({ message: `Week must be between 1 and ${WORKBOOK_WEEKS}` });
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { project, isMember, userId } = ctx;
        if (!isMember) return res.status(403).json({ message: 'Only group members can edit the workbook' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot edit the workbook of an archived project' });

        const entry: any = findEntry(project, week);
        if (entry?.approvedAt) return res.status(409).json({ message: 'This week has been approved by your mentor and can no longer be edited' });

        const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
        if (!content) {
            project.workbook = (project.workbook || []).filter((e: any) => e.week !== week) as any;
        } else if (entry) {
            entry.content = content;
            entry.lastEditedBy = userId;
            entry.lastEditedAt = new Date();
        } else {
            project.workbook.push({ week, content, lastEditedBy: userId as any, lastEditedAt: new Date(), attendance: [] });
        }
        project.workbook.sort((a: any, b: any) => a.week - b.week);
        await project.save();
        res.json(project.workbook);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// PUT /projects/:id/workbook/:week/attendance  { attendance: { [studentId]: 'present'|'absent' } }
// — mentor only. Merges into the week's existing marks; only current group members count.
export const setWorkbookAttendance = async (req: Request, res: Response) => {
    try {
        const week = parseWeek(req.params.week);
        if (!week) return res.status(400).json({ message: `Week must be between 1 and ${WORKBOOK_WEEKS}` });
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { project, isMentor, memberIds } = ctx;
        if (!isMentor) return res.status(403).json({ message: 'Only the mentor can mark attendance' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot edit the workbook of an archived project' });

        const entry: any = findEntry(project, week);
        if (!entry) return res.status(400).json({ message: 'Attendance can only be marked on a week where the group has recorded its work' });
        if (entry.approvedAt) return res.status(409).json({ message: 'Un-approve this week before changing its attendance' });

        const marks = req.body.attendance;
        if (!marks || typeof marks !== 'object') return res.status(400).json({ message: 'attendance must be an object of studentId → status' });
        for (const [studentId, status] of Object.entries(marks)) {
            if (!memberIds.includes(studentId)) return res.status(400).json({ message: 'Attendance can only be marked for group members' });
            if (status !== 'present' && status !== 'absent') return res.status(400).json({ message: 'Status must be present or absent' });
            const existing = entry.attendance.find((a: any) => String(a.student) === studentId);
            if (existing) existing.status = status;
            else entry.attendance.push({ student: studentId, status });
        }
        await project.save();
        res.json(project.workbook);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// PUT /projects/:id/workbook/:week/approve  { approved: boolean } — mentor only. Approving needs
// every current member's attendance marked; it locks the week until un-approved.
export const setWorkbookApproval = async (req: Request, res: Response) => {
    try {
        const week = parseWeek(req.params.week);
        if (!week) return res.status(400).json({ message: `Week must be between 1 and ${WORKBOOK_WEEKS}` });
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { project, isMentor, memberIds, userId } = ctx;
        if (!isMentor) return res.status(403).json({ message: 'Only the mentor can approve the workbook' });
        if (project.isArchived) return res.status(400).json({ message: 'Cannot edit the workbook of an archived project' });

        const entry: any = findEntry(project, week);
        if (!entry) return res.status(400).json({ message: 'Nothing has been recorded for this week yet' });

        if (req.body.approved) {
            const marked = new Set(entry.attendance.map((a: any) => String(a.student)));
            if (memberIds.some(id => !marked.has(id))) {
                return res.status(400).json({ message: 'Mark attendance for every member before approving' });
            }
            entry.approvedBy = userId;
            entry.approvedAt = new Date();
        } else {
            entry.approvedBy = undefined;
            entry.approvedAt = undefined;
        }
        await project.save();
        res.json(project.workbook);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// GET /projects/:id/workbook/export — the mentor (or an admin) downloads the workbook as xlsx:
// one row per week with the work done, each member's attendance, and the approval.
export const exportWorkbook = async (req: Request, res: Response) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { project, isMentor } = ctx;
        if (!isMentor && (req as any).user.role !== UserRole.ADMIN) {
            return res.status(403).json({ message: 'Only the mentor can export the workbook' });
        }

        const group = project.group ? await Group.findById(project.group).populate('members', 'name rollNumber').lean() as any : null;
        const members: any[] = group?.members || [];
        const mentor = project.faculty ? await User.findById(project.faculty).select('name').lean() as any : null;
        const mentorName = mentor?.name || project.archivedMentorName || '';

        const wb = new ExcelJS.Workbook();
        wb.creator = 'IIITNR Minor Management';
        const ws = wb.addWorksheet('Workbook');
        const header = ['Week', 'Work Done', ...members.map(m => m.rollNumber ? `${m.name} (${m.rollNumber})` : m.name), 'Approved On'];

        ws.addRow([`Project: ${project.title}`]);
        ws.addRow([`Group: ${group?.name ?? project.archivedGroupName ?? '—'}    |    Mentor: ${mentorName || '—'}`]);
        ws.addRow([]);
        for (let i = 1; i <= 2; i++) {
            ws.mergeCells(i, 1, i, header.length);
            ws.getRow(i).font = { bold: true, size: i === 1 ? 13 : 11 };
        }

        const headerRow = ws.addRow(header);
        headerRow.font = { bold: true };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
            cell.border = { bottom: { style: 'thin' } };
        });

        for (let week = 1; week <= WORKBOOK_WEEKS; week++) {
            const entry: any = findEntry(project, week);
            const statusFor = (m: any) => {
                const a = entry?.attendance?.find((x: any) => String(x.student) === String(m._id));
                return a ? (a.status === 'present' ? 'Present' : 'Absent') : '';
            };
            const row = ws.addRow([
                week,
                entry?.content || '',
                ...members.map(statusFor),
                entry?.approvedAt ? new Date(entry.approvedAt).toLocaleDateString('en-IN') : '',
            ]);
            row.alignment = { vertical: 'top', wrapText: true };
        }

        ws.getColumn(1).width = 7;
        ws.getColumn(2).width = 60;
        for (let c = 3; c <= header.length; c++) ws.getColumn(c).width = 20;

        const buffer = await wb.xlsx.writeBuffer();
        const safeName = String(group?.name ?? project._id).replace(/[^\w-]+/g, '_');
        res.set('Content-Disposition', `attachment; filename=workbook_group_${safeName}.xlsx`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
