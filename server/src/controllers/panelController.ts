import { Request, Response } from 'express';
import Panel, { IPanel } from '../models/Panel';
import Group from '../models/Group';
import Project from '../models/Project';
import User from '../models/User';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { sendPanelAssignmentEmail } from '../utils/emailService';

const RUBRIC_FIELDS: Record<string, { guide: { key: string; label: string; max: number }[]; panel: { key: string; label: string; max: number }[] }> = {
    'mid-term': {
        guide: [
            { key: 'dataElicitation', label: 'Data Elicitation', max: 5 },
            { key: 'problemDefinition', label: 'Problem Definition', max: 5 },
            { key: 'planning', label: 'Planning', max: 5 },
        ],
        panel: [
            { key: 'literatureSurvey', label: 'Literature Survey', max: 5 },
            { key: 'presentationSkills', label: 'Presentation Skills', max: 5 },
            { key: 'technicalUnderstanding', label: 'Technical Understanding', max: 5 },
        ]
    },
    'end-term': {
        guide: [
            { key: 'requirementSpecification', label: 'Requirement Specification', max: 7 },
            { key: 'systemDesign', label: 'System Design', max: 7 },
            { key: 'implementation', label: 'Implementation', max: 7 },
            { key: 'projectManagement', label: 'Project Management', max: 7 },
            { key: 'planningVsExecution', label: 'Planning vs Execution', max: 7 },
        ],
        panel: [
            { key: 'testingAndResults', label: 'Testing & Results', max: 10 },
            { key: 'innovationAndRelevance', label: 'Innovation & Relevance', max: 5 },
            { key: 'presentationAndViva', label: 'Presentation & Viva', max: 10 },
            { key: 'conceptualDepth', label: 'Conceptual Depth', max: 10 },
        ]
    }
};

const calculateGrade = (total: number) => {
    if (total >= 90) return 'A+';
    if (total >= 80) return 'A';
    if (total >= 70) return 'B+';
    if (total >= 60) return 'B';
    if (total >= 50) return 'C+';
    if (total >= 40) return 'C';
    if (total > 0) return 'F';
    return '';
};

const colLetter = (n: number): string => {
    let s = '';
    while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); }
    return s;
};

// Inserts 7 college + panel header rows at the top of a worksheet. Returns 7.
const addCollegeAndPanelHeader = (ws: ExcelJS.Worksheet, panel: any, evalLabel: string, totalCols: number, panelNumber: number): number => {
    const lastCol = colLetter(totalCols);
    const panelFacultyNames = (panel.faculty || []).map((f: any) => f.name || '').filter(Boolean).join(' / ') || 'Panel';
    const batchYear: number = panel.batchYear;

    // Academic year: e.g. batchYear=2022, current 2025 → 2025-26
    const now = new Date();
    const cy = now.getFullYear();
    const acadYear = `${cy}-${String(cy + 1).slice(2)}`;

    // Semester string derived from batch year
    const yearDiff = cy - batchYear;
    const semCount = Math.max(1, yearDiff * 2 + (now.getMonth() >= 6 ? 1 : 0));
    const romanSems = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    const semStr = romanSems[semCount - 1] || `${semCount}th`;

    ws.addRow(['Dr. SPM International Institute of Information Technology, Naya Raipur']);
    ws.addRow(['(A Joint Initiative of Govt. of Chhattisgarh and NTPC)']);
    ws.addRow(['Email: iiitnr@iiitnr.ac.in, Tel: (0771) 2474040, Web: www.iiitnr.ac.in']);
    ws.addRow([`MINOR PROJECT — ${evalLabel} EVALUATION | B.Tech. ${semStr} Sem | Batch ${batchYear} | Academic Year ${acadYear}`]);
    ws.addRow([`Panel No. ${panelNumber}    |    ${panelFacultyNames}`]);
    ws.addRow([]);

    for (let i = 1; i <= 6; i++) {
        ws.mergeCells(`A${i}:${lastCol}${i}`);
        const cell = ws.getCell(`A${i}`);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (i === 1) { cell.font = { bold: true, size: 14, color: { argb: 'FF0070C0' } }; ws.getRow(i).height = 28; }
        else if (i === 4) { cell.font = { bold: true, size: 12, underline: true }; }
        else if (i === 5) { cell.font = { bold: true, size: 11, italic: true, color: { argb: 'FF7030A0' } }; }
        else { cell.font = { size: 11 }; }
    }
    return 6;
};

export const exportEvaluations = async (req: any, res: Response) => {
    try {
        const { batchYear, evalType } = req.query; // evalType: 'midterm' or 'full'

        // Get all groups and filter by batch
        const allGroups = await Group.find({ status: { $in: ['Approved', 'Pending'] }, isArchived: { $ne: true } })
            .populate('members', 'name rollNumber photoUrl branch department')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email photoUrl _id' }
            })
            .lean();

        // Filter by batch if specified
        let filteredGroups = allGroups.filter((g: any) => {
            const gBatch = g.targetBatch ? String(g.targetBatch) : (g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + String(g.members[0].rollNumber).substring(0, 2) : 'Unknown');
            if (batchYear && batchYear !== 'All' && gBatch !== String(batchYear)) return false;
            return true;
        });

        // Sort groups by group number (parse g.name as integer)
        filteredGroups.sort((a: any, b: any) => {
            const numA = parseInt(a.name) || 0;
            const numB = parseInt(b.name) || 0;
            return numA - numB;
        });

        if (filteredGroups.length === 0) {
            return res.status(204).end();
        }


        const workbook = new ExcelJS.Workbook();
        const pSheet = workbook.addWorksheet('Evaluations');

        const borderStyle: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // Formatting columns
        pSheet.columns = [
            { width: 4 }, { width: 12 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 45 }, { width: 26 },
            { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 12 }, { width: 12 },
        ];

        // Header titles (Rows 1-4)
        pSheet.addRow([null, 'Dr. SPM International Institute of Information Technology, Naya Raipur']);
        pSheet.addRow([null, '(A Joint Initiative of Govt. of Chhattisgarh and NTPC)']);
        pSheet.addRow([null, 'Email: iiitnr@iiitnr.ac.in, Tel: (0771) 2474040, Web: www.iiitnr.ac.in']);

        // Calculate semester string for header
        const currentYear = new Date().getFullYear();
        let displayBatchYear = batchYear && batchYear !== 'All' ? Number(batchYear) : currentYear;
        const yearDiff = currentYear - displayBatchYear;
        let semCount = yearDiff * 2 + (new Date().getMonth() >= 6 ? 1 : 0);
        if (semCount < 1) semCount = 1;
        const romanSems = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const semStr = romanSems[semCount - 1] || `${semCount}th`;

        pSheet.addRow([null, `MINOR PROJECT EVALUATION- B.Tech. ${semStr} SEM (Batch ${batchYear || 'All'})`]);

        for (let i = 1; i <= 4; i++) {
            pSheet.mergeCells(`B${i}:Q${i}`);
            const cell = pSheet.getCell(`B${i}`);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (i === 1) cell.font = { bold: true, size: 14, color: { argb: 'FF0070C0' } };
            else if (i === 4) cell.font = { bold: true, size: 12, underline: true };
            else cell.font = { size: 11 };
        }

        pSheet.addRow([]); // Empty Row 5

        // Headers (Rows 6 & 7)
        const headerRow1Data: any[] = [
            null, 'Group No.', 'Student\'s name', 'Roll no.', 'Department', 'Title of the Project', 'Supervisor Name',
            'MID-TERM (15+15)', '', '', `Average Marks (30) Guide+(E1+E2)/2`
        ];
        const headerRow2Data: any[] = [
            null, '', '', '', '', '', '',
            'E1 (15)', 'E2 (15)', 'Guide (15)', ''
        ];

        if (evalType === 'full') {
            headerRow1Data.push('END-TERM (35+35)', '', '', 'Average Marks (70) Guide+(E1+E2)/2', 'Total (100)', 'Grade');
            headerRow2Data.push('E1 f(35)', 'E2 (35)', 'Guide (35)', '', '', '');
        }

        const headerRow1 = pSheet.addRow(headerRow1Data);
        const headerRow2 = pSheet.addRow(headerRow2Data);
        headerRow1.height = 38;
        headerRow2.height = 30;

        // Header Merging Logic
        const commonFields = ['B', 'C', 'D', 'E', 'F', 'G', 'K'];
        if (evalType === 'full') {
            commonFields.push('O', 'P', 'Q');
        }

        commonFields.forEach(col => {
            pSheet.mergeCells(`${col}6:${col}7`);
        });

        pSheet.mergeCells('H6:J6');
        if (evalType === 'full') {
            pSheet.mergeCells('L6:N6');
        }

        const MID = 'FFFCE4D6'; const END = 'FFE2EFDA'; const AVG = 'FFFFF2CC'; const TOT = 'FFDCE6F1'; const HDR = 'FF002060';
        const colBg: Record<number, string> = { 2: HDR, 3: HDR, 4: HDR, 5: HDR, 6: HDR, 7: HDR, 8: MID, 9: MID, 10: MID, 11: AVG, 12: END, 13: END, 14: END, 15: AVG, 16: TOT, 17: TOT };
        const colFg: Record<number, string> = { 2: 'FFFFFFFF', 3: 'FFFFFFFF', 4: 'FFFFFFFF', 5: 'FFFFFFFF', 6: 'FFFFFFFF', 7: 'FFFFFFFF', 8: 'FF843C0C', 9: 'FF843C0C', 10: 'FF843C0C', 11: 'FF7F6000', 12: 'FF1F4E3D', 13: 'FF1F4E3D', 14: 'FF1F4E3D', 15: 'FF7F6000', 16: 'FF1F3864', 17: 'FF1F3864' };

        [headerRow1, headerRow2].forEach(row => {
            row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            row.eachCell((cell, colNumber) => {
                if (colNumber > 1) {
                    cell.border = borderStyle;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colBg[colNumber] || 'FFFFFFFF' } };
                    cell.font = { bold: true, size: 9, color: { argb: colFg[colNumber] || 'FF000000' } };
                }
            });
        });

        // Grading Logic
        const calculateGrade = (total: number) => {
            if (total >= 90) return 'A+';
            if (total >= 80) return 'A';
            if (total >= 70) return 'B+';
            if (total >= 60) return 'B';
            if (total >= 50) return 'C+';
            if (total >= 40) return 'C';
            if (total > 0) return 'F';
            return '';
        };

        // Data Population — marks are now per-student in studentEvaluations
        filteredGroups.forEach((g: any, gIdx: number) => {
            const project = g.project;
            const members = g.members || [];
            const studentEvals: any[] = project?.studentEvaluations || [];
            
            const firstMemberRow = pSheet.rowCount + 1;

            members.forEach((m: any, mIdx: number) => {
                const midSE = studentEvals.find((e: any) => String(e.student?._id || e.student) === String(m._id) && e.evalType === 'mid-term');
                const endSE = studentEvals.find((e: any) => String(e.student?._id || e.student) === String(m._id) && e.evalType === 'end-term');

                const fmtMark = (n: number) => n > 0 ? String(Math.round(n * 100) / 100) : '';
                let midE1 = '', midE2 = '', midGuide = '', midAvg = '';
                if (midSE) {
                    const midGNum = Object.values(midSE.guide || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    const midP1 = Object.values(midSE.panel1 || midSE.panel || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    const midP2 = Object.values(midSE.panel2 || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    midGuide = fmtMark(midGNum) || String(midGNum);
                    midE1 = fmtMark(midP1) || String(midP1);
                    midE2 = fmtMark(midP2);
                    const pAvg = midP2 > 0 ? (midP1 + midP2) / 2 : midP1;
                    const finalMarks = midSE.marks ?? (midGNum + pAvg);
                    midAvg = fmtMark(finalMarks) || String(finalMarks);
                }

                let endE1 = '', endE2 = '', endGuide = '', endAvg = '';
                if (endSE && evalType === 'full') {
                    const endGNum = Object.values(endSE.guide || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    const endP1 = Object.values(endSE.panel1 || endSE.panel || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    const endP2 = Object.values(endSE.panel2 || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    endGuide = fmtMark(endGNum) || String(endGNum);
                    endE1 = fmtMark(endP1) || String(endP1);
                    endE2 = fmtMark(endP2);
                    const pAvg = endP2 > 0 ? (endP1 + endP2) / 2 : endP1;
                    const finalMarks = endSE.marks ?? (endGNum + pAvg);
                    endAvg = fmtMark(finalMarks) || String(finalMarks);
                }

                const total = evalType === 'full' ? (Number(midAvg || 0) + Number(endAvg || 0)) : 0;
                const grade = (evalType === 'full' && (midSE || endSE)) ? calculateGrade(total) : '';

                const rowData: any[] = [
                    null,
                    mIdx === 0 ? g.name : '',
                    m.name || '',
                    m.rollNumber || '',
                    m.branch || m.department || '',
                    mIdx === 0 ? project?.title : '',
                    mIdx === 0 ? project?.faculty?.name : '',
                    midE1, midE2, midGuide, midAvg
                ];

                if (evalType === 'full') {
                    rowData.push(
                        endE1, endE2, endGuide, endAvg,
                        total > 0 ? total : '',
                        grade
                    );
                }

                const row = pSheet.addRow(rowData);
                row.height = 32; // Give more space

                // Color logic: Alternate background for each GROUP (not each row)
                const fillColor = gIdx % 2 === 0 ? 'FFFFFFFF' : 'FFEAEAEA'; // White vs Light Grey (Darker than before)

                row.eachCell((cell, colNum) => {
                    if (colNum > 1) {
                        cell.border = borderStyle;
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: fillColor }
                        };
                    }
                });
            });

            if (members.length > 1) {
                const lastMemberRow = pSheet.rowCount;
                ['B', 'F', 'G'].forEach(col => {
                    pSheet.mergeCells(`${col}${firstMemberRow}:${col}${lastMemberRow}`);
                    // Re-apply common alignment for the merged blocks
                    const mergedCell = pSheet.getCell(`${col}${firstMemberRow}`);
                    mergedCell.alignment = { horizontal: col === 'B' ? 'center' : 'left', vertical: 'middle', wrapText: true };
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename=evaluation_export_${batchYear || 'All'}_${evalType}.xlsx`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error exporting evaluations', error: error.message });
    }
};

export const createPanel = async (req: any, res: Response) => {
    try {
        const { faculty, batchYear, room } = req.body;
        if (!faculty || !batchYear) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const newPanel = new Panel({ faculty, batchYear, room: room || undefined });
        await newPanel.save();

        // Send Email to Faculty Panel Members
        const panelFaculty = await User.find({ _id: { $in: faculty } }).select('email');
        const emails = panelFaculty.map(f => f.email).filter(e => e);
        if (emails.length > 0) {
            sendPanelAssignmentEmail(emails, `Batch ${batchYear} Evaluations`).catch(err => console.error("Email failed:", err));
        }

        res.status(201).json(newPanel);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating panel', error: error.message });
    }
};

export const updatePanel = async (req: any, res: Response) => {
    try {
        const panelId = req.params.id;
        const { faculty, batchYear, room } = req.body;

        if (!faculty || !batchYear) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const updatedPanel = await Panel.findByIdAndUpdate(
            panelId,
            { faculty, batchYear, room: room || undefined },
            { new: true }
        ).populate('faculty', 'name email photoUrl department maxGroups currentGroups');

        if (!updatedPanel) {
            return res.status(404).json({ message: 'Panel not found' });
        }

        res.status(200).json(updatedPanel);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating panel', error: error.message });
    }
};

export const getPanels = async (req: any, res: Response) => {
    try {
        const { batchYear, includeArchived } = req.query;
        let query: any = {};
        if (batchYear && batchYear !== 'All') query.batchYear = Number(batchYear);
        if (includeArchived !== 'true') query.isArchived = { $ne: true };
        const panels = await Panel.find(query).populate('faculty', 'name email photoUrl department maxGroups currentGroups').lean();

        // Populate groups for each panel based on faculty
        const panelsWithGroups = await Promise.all(panels.map(async (panel: any) => {
            const panelFacultyIds = panel.faculty.map((f: any) => f._id.toString());
            const groups = await Group.find({ status: { $in: ['Approved', 'Forming', 'Pending'] }, isArchived: { $ne: true } })
                .populate('members', 'name rollNumber photoUrl email branch')
                .populate({ path: 'project', populate: { path: 'faculty', select: 'name email photoUrl' } })
                .lean();

            const panelGroups = groups.filter((g: any) => {
                if (!g.project) return false;
                let projFacId = null;
                if (typeof g.project.faculty === 'string') {
                    projFacId = g.project.faculty;
                } else if (g.project.faculty && g.project.faculty._id) {
                    projFacId = g.project.faculty._id.toString();
                }
                if (!projFacId) return false;
                if (!panelFacultyIds.includes(projFacId)) return false;

                const gBatch = g.targetBatch ? String(g.targetBatch) : (g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + g.members[0].rollNumber.substring(0, 2) : 'Unknown');
                if (gBatch !== String(panel.batchYear)) return false;

                return true;
            });

            return {
                ...panel,
                groups: panelGroups
            };
        }));

        res.status(200).json(panelsWithGroups);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching panels', error: error.message });
    }
};

export const deletePanel = async (req: any, res: Response) => {
    try {
        await Panel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Panel deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting panel', error: error.message });
    }
};

export const getMyPanelEvaluationGroups = async (req: any, res: Response) => {
    try {
        const facultyId = req.user.id;
        const { batchYear } = req.query;

        let panelQuery: any = { faculty: facultyId, isArchived: { $ne: true } };
        if (batchYear && batchYear !== 'All') panelQuery.batchYear = Number(batchYear);

        const panels = await Panel.find(panelQuery).populate('faculty', 'name email photoUrl');

        const result = [];
        for (const panel of panels) {
            const panelFacultyIds = panel.faculty.map(f => f._id.toString());

            // Get all groups allocated to these faculty members, specifically those with approved projects
            const groups = await Group.find({
                status: { $in: ['Approved', 'Forming', 'Pending'] },
                isArchived: { $ne: true }
            }).populate('members', 'name rollNumber photoUrl email branch')
                .populate({
                    path: 'project',
                    populate: { path: 'faculty', select: 'name email photoUrl' }
                });

            // Filter groups:
            // 1. Group must have a project.
            // 2. Project faculty must be in panelFacultyIds.
            // 3. Batch year must match panel's batchYear.

            const panelGroups = groups.filter((g: any) => {
                if (!g.project) return false;

                let projFacId = null;
                if (typeof g.project.faculty === 'string') {
                    projFacId = g.project.faculty;
                } else if (g.project.faculty && g.project.faculty._id) {
                    projFacId = g.project.faculty._id.toString();
                }

                if (!projFacId) return false;

                if (!panelFacultyIds.includes(projFacId)) return false;

                const gBatch = g.targetBatch ? String(g.targetBatch) : (g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + g.members[0].rollNumber.substring(0, 2) : 'Unknown');
                if (gBatch !== String(panel.batchYear)) return false;

                return true;
            });

            const batchPanels = await Panel.find({ batchYear: panel.batchYear }).sort({ createdAt: 1 }).select('_id').lean();
            const panelNumber = batchPanels.findIndex((p: any) => String(p._id) === String(panel._id)) + 1;

            result.push({
                panel,
                groups: panelGroups,
                panelNumber
            });
        }
        res.status(200).json(result);

    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching panel groups', error: error.message });
    }
};

export const exportPanels = async (req: any, res: Response) => {
    try {
        const { batchYear, includeArchived } = req.query;

        let query: any = {};
        if (batchYear && batchYear !== 'All') query.batchYear = Number(batchYear);
        if (includeArchived !== 'true') query.isArchived = { $ne: true };

        const panels = await Panel.find(query).populate('faculty', 'name email').lean();
        const groups = await Group.find({ status: { $in: ['Approved', 'Pending'] }, isArchived: { $ne: true } })
            .populate('members', 'name rollNumber branch department')
            .populate({ path: 'project', populate: { path: 'faculty', select: 'name email _id' } })
            .lean();

        // helpers
        const thin: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const medium: Partial<ExcelJS.Borders> = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
        const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const leftAlign: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };
        const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
        const getBranch = (roll: string) => { if (!roll || roll.length < 5) return ''; const c = roll[4]; return c === '1' ? 'ECE' : c === '2' ? 'DSAI' : 'CSE'; };

        // academic context
        const refBatch = panels.length > 0 ? (panels[0] as any).batchYear : (batchYear !== 'All' ? Number(batchYear) : new Date().getFullYear());
        const now = new Date(); const cy = now.getFullYear(); const cm = now.getMonth();
        let semCount = (cy - refBatch) * 2 + (cm >= 6 ? 1 : 0);
        if (semCount < 1) semCount = 1;
        const romanSems = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const semStr = romanSems[Math.min(semCount - 1, 9)] || `${semCount}th`;
        const acadYear = `${cy}-${String(cy + 1).slice(2)}`;

        if (panels.length === 0) {
            return res.status(204).end();
        }

        // group assignment per panel
        const panelGroups: any[][] = (panels as any[]).map((panel: any) => {
            const facIds = new Set(panel.faculty.map((f: any) => f._id.toString()));
            return (groups as any[]).filter((g: any) => {
                if (!g.project) return false;
                const facId = g.project.faculty?._id?.toString() ?? g.project.faculty;
                if (!facId || !facIds.has(facId)) return false;
                const gb = g.targetBatch ? String(g.targetBatch) : (g.members?.[0]?.rollNumber ? '20' + g.members[0].rollNumber.substring(0, 2) : '');
                return gb === String(panel.batchYear);
            });
        });

        const panelChairs: string[] = (panels as any[]).map((panel: any, pi: number) => {
            const pg = panelGroups[pi]; let bestId = '', bestCount = 0;
            panel.faculty.forEach((f: any) => {
                const fid = f._id.toString();
                const cnt = pg.filter((g: any) => { const id = g.project?.faculty?._id?.toString() ?? g.project?.faculty; return id === fid; }).length;
                if (cnt > bestCount) { bestCount = cnt; bestId = fid; }
            });
            return bestId;
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'IIITNR Minor Management';

        // SHEET 1: Summary
        const summary = workbook.addWorksheet('Panel Summary');
        const totalCols = (panels as any[]).length + 1;
        summary.columns = [{ width: 16 }, ...(panels as any[]).map(() => ({ width: 32 }))];

        const instLines = [
            'Dr. SPM International Institute of Information Technology, Naya Raipur',
            '(A Joint Initiative of Govt. of Chhattisgarh and NTPC)',
            'Email: iiitnr@iiitnr.ac.in  |  Tel: (0771) 2474040  |  Web: www.iiitnr.ac.in',
            `MINOR PROJECT EVALUATION  -  B.Tech. ${semStr} Semester  |  Batch ${refBatch}  |  Academic Year ${acadYear}`,
        ];
        instLines.forEach((text, idx) => {
            summary.addRow([text]);
            if (totalCols > 1) summary.mergeCells(idx + 1, 1, idx + 1, totalCols);
            const cell = summary.getCell(idx + 1, 1);
            cell.alignment = center; cell.border = thin;
            if (idx === 0) { cell.font = { bold: true, size: 14, color: { argb: 'FF0070C0' } }; summary.getRow(1).height = 38; }
            else if (idx === 3) { cell.font = { bold: true, size: 11, underline: true }; cell.fill = fill('FFDCE6F1'); summary.getRow(4).height = 38; }
            else { cell.font = { size: 10, italic: true }; }
        });

        const panelHeaderRow = summary.addRow(['', ...(panels as any[]).map((_: any, i: number) => `Panel ${i + 1}`)]);
        panelHeaderRow.height = 38;
        panelHeaderRow.eachCell({ includeEmpty: true }, (cell, col) => {
            cell.border = medium; cell.alignment = center;
            if (col === 1) { cell.font = { bold: true, size: 10, color: { argb: 'FF404040' } }; cell.fill = fill('FFD6DCE4'); }
            else { cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; cell.fill = fill('FF2E75B6'); }
        });

        const facRow = summary.addRow([
            'Faculty (Chair *)',
            ...(panels as any[]).map((p: any, i: number) => p.faculty.map((f: any) => f._id.toString() === panelChairs[i] ? `${f.name} (Chair)` : f.name).join('\n')),
        ]);
        facRow.height = Math.max(40, (panels as any[]).reduce((mx: number, p: any) => Math.max(mx, p.faculty.length * 32), 40));
        facRow.eachCell({ includeEmpty: true }, (cell, col) => {
            cell.border = thin; cell.alignment = { ...center, wrapText: true };
            if (col === 1) { cell.font = { bold: true, italic: true, size: 9, color: { argb: 'FF595959' } }; cell.fill = fill('FFF2F2F2'); }
            else { cell.font = { bold: true, size: 10 }; cell.fill = fill('FFE2EFDA'); }
        });



        const maxGroupCount = Math.max(...panelGroups.map(pg => pg.length), 0);
        if (maxGroupCount > 0) {
            const grpStart = summary.rowCount + 1;
            for (let gi = 0; gi < maxGroupCount; gi++) {
                const rowData = [gi === 0 ? 'Group Nos.' : '', ...(panels as any[]).map((_: any, pi: number) => panelGroups[pi][gi]?.name ?? '')];
                const dataRow = summary.addRow(rowData);
                dataRow.height = 38;
                dataRow.eachCell({ includeEmpty: true }, (cell, col) => {
                    if (col === 1) return;
                    cell.alignment = center; cell.font = { color: { argb: 'FFCC0000' }, bold: true, size: 10 }; cell.border = thin;
                });
            }
            const grpEnd = summary.rowCount;
            if (grpEnd > grpStart) summary.mergeCells(grpStart, 1, grpEnd, 1);
            const lc = summary.getCell(grpStart, 1);
            lc.value = 'Group Nos.'; lc.alignment = center; lc.font = { bold: true, size: 10, color: { argb: 'FF404040' } }; lc.fill = fill('FFF2F2F2'); lc.border = medium;
        }

        const roomRow = summary.addRow(['Venue / Room', ...(panels as any[]).map((p: any, i: number) => p.room || `Room ${300 + i + 4}`)]);
        roomRow.height = 38;
        roomRow.eachCell({ includeEmpty: true }, (cell, col) => {
            cell.border = thin; cell.alignment = center;
            if (col === 1) { cell.font = { bold: true, size: 9, color: { argb: 'FF595959' } }; cell.fill = fill('FFF2F2F2'); }
            else { cell.font = { bold: true, size: 10, color: { argb: 'FF0070C0' } }; cell.fill = fill('FFF2F2F2'); }
        });

        // INDIVIDUAL PANEL SHEETS
        (panels as any[]).forEach((panel: any, pi: number) => {
            const pg = panelGroups[pi]; const chairId = panelChairs[pi];
            const ws = workbook.addWorksheet(`Panel ${pi + 1}`);
            ws.columns = [
                { width: 4 }, { width: 12 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 45 }, { width: 26 },
                { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 12 }, { width: 12 },
            ];
            const LAST = 17;

            const sheetInstRows = [
                'Dr. SPM International Institute of Information Technology, Naya Raipur',
                '(A Joint Initiative of Govt. of Chhattisgarh and NTPC)',
                'Email: iiitnr@iiitnr.ac.in  |  Tel: (0771) 2474040  |  Web: www.iiitnr.ac.in',
                `MINOR PROJECT - ${semStr} Semester Evaluation  |  Batch ${panel.batchYear}  |  Academic Year ${acadYear}`,
            ];
            sheetInstRows.forEach((text, idx) => {
                ws.addRow([null, text]);
                ws.mergeCells(idx + 1, 2, idx + 1, LAST);
                const cell = ws.getCell(idx + 1, 2);
                cell.alignment = center; cell.border = thin;
                if (idx === 0) { cell.font = { bold: true, size: 13, color: { argb: 'FF0070C0' } }; ws.getRow(1).height = 38; }
                else if (idx === 3) { cell.font = { bold: true, size: 11, underline: true }; cell.fill = fill('FFDCE6F1'); ws.getRow(4).height = 38; }
                else { cell.font = { size: 10, italic: true }; }
            });

            ws.addRow([]);
            const facLabel = `Panel No. ${pi + 1}   |   ` + panel.faculty.map((f: any) => f._id.toString() === chairId ? `${f.name} (Chair)` : f.name).join('  -  ');
            ws.addRow([null, `Panel No. ${pi + 1}`, null, null, facLabel]);
            ws.mergeCells('B6:D6'); ws.mergeCells('E6:Q6'); ws.getRow(6).height = 38;
            for (let col = 2; col <= LAST; col++) {
                const cell = ws.getCell(6, col);
                cell.font = { bold: true, size: 10, color: { argb: 'FF1F3864' } }; cell.fill = fill('FF9BC2E6'); cell.border = thin;
                cell.alignment = col <= 4 ? center : leftAlign;
            }

            const MID = 'FFFCE4D6'; const END = 'FFE2EFDA'; const AVG = 'FFFFF2CC'; const TOT = 'FFDCE6F1'; const HDR = 'FF002060';
            const colBg: Record<number, string> = { 2: HDR, 3: HDR, 4: HDR, 5: HDR, 6: HDR, 7: HDR, 8: MID, 9: MID, 10: MID, 11: AVG, 12: END, 13: END, 14: END, 15: AVG, 16: TOT, 17: TOT };
            const colFg: Record<number, string> = { 2: 'FFFFFFFF', 3: 'FFFFFFFF', 4: 'FFFFFFFF', 5: 'FFFFFFFF', 6: 'FFFFFFFF', 7: 'FFFFFFFF', 8: 'FF843C0C', 9: 'FF843C0C', 10: 'FF843C0C', 11: 'FF7F6000', 12: 'FF1F4E3D', 13: 'FF1F4E3D', 14: 'FF1F4E3D', 15: 'FF7F6000', 16: 'FF1F3864', 17: 'FF1F3864' };

            const h1 = ws.addRow([null, 'Group\nNo.', "Student's Name", 'Roll No.', 'Dept', 'Title of the Project', 'Supervisor', 'MID-TERM (15+15+15)', null, null, 'Avg. Mid (30) Guide+(E1+E2)/2', 'END-TERM (35+35+35)', null, null, 'Avg. End (70) Guide+(E1+E2)/2', 'Total (100)', 'Grade']);
            const h2 = ws.addRow([null, null, null, null, null, null, null, 'E1 (15)', 'E2 (15)', 'Guide (15)', null, 'E1 (35)', 'E2 (35)', 'Guide (35)', null, null, null]);
            ws.getRow(7).height = 38; ws.getRow(8).height = 38;
            ['B', 'C', 'D', 'E', 'F', 'G', 'K', 'O', 'P', 'Q'].forEach(col => ws.mergeCells(`${col}7:${col}8`));
            ws.mergeCells('H7:J7'); ws.mergeCells('L7:N7');
            [h1, h2].forEach(row => {
                row.eachCell({ includeEmpty: true }, (cell, col) => {
                    if (col < 2) return;
                    cell.border = thin; cell.alignment = center;
                    cell.font = { bold: true, size: 9, color: { argb: colFg[col] || 'FF000000' } };
                    cell.fill = fill(colBg[col] || 'FFFFFFFF');
                });
            });

            let curRow = 9;
            pg.forEach((g: any, gi: number) => {
                const members = (g.members || []) as any[];
                const title = g.project?.title || 'TBD';
                const supervisor = typeof g.project?.faculty === 'string' ? '' : (g.project?.faculty?.name || '');
                const groupNo = g.name || '';
                const rowFill = gi % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5';
                const firstRowNum = curRow;
                const count = Math.max(members.length, 1);

                if (members.length === 0) {
                    const row = ws.addRow([null, groupNo, '', '', '', title, supervisor, '', '', '', '', '', '', '', '', '', '']);
                    row.height = 38;
                    row.eachCell({ includeEmpty: true }, (cell, col) => { if (col >= 2) { cell.border = thin; cell.fill = fill(rowFill); cell.font = { size: 9.5 }; cell.alignment = col <= 2 ? center : (col >= 8 ? center : leftAlign); } });
                    curRow++;
                } else {
                    members.forEach((m: any, mi: number) => {
                        const dept = m.branch || m.department || getBranch(m.rollNumber || '');
                        const row = ws.addRow([null, mi === 0 ? groupNo : '', m.name || '', m.rollNumber || '', dept, mi === 0 ? title : '', mi === 0 ? supervisor : '', '', '', '', '', '', '', '', '', '', '']);
                        row.height = 38;
                        row.eachCell({ includeEmpty: true }, (cell, col) => {
                            if (col < 2) return;
                            cell.border = thin; cell.fill = fill(rowFill); cell.font = { size: 9.5 };
                            cell.alignment = col <= 2 ? center : (col >= 8 ? center : leftAlign);
                        });
                        curRow++;
                    });
                    if (count > 1) {
                        const lastRowNum = firstRowNum + count - 1;
                        ['B', 'F', 'G'].forEach(col => {
                            ws.mergeCells(`${col}${firstRowNum}:${col}${lastRowNum}`);
                            const mc = ws.getCell(`${col}${firstRowNum}`);
                            mc.alignment = { horizontal: col === 'B' ? 'center' : 'left', vertical: 'middle', wrapText: true };
                            mc.border = thin; mc.fill = fill(rowFill);
                        });
                    }
                }
            });

            ws.addRow([]); ws.addRow([]);
            const sigHeaderRow = ws.addRow([null, 'Evaluation Board Member', null, 'Designation / Role', null, 'Signature', null, null]);
            ws.mergeCells(`B${sigHeaderRow.number}:C${sigHeaderRow.number}`);
            ws.mergeCells(`D${sigHeaderRow.number}:E${sigHeaderRow.number}`);
            ws.mergeCells(`F${sigHeaderRow.number}:H${sigHeaderRow.number}`);
            sigHeaderRow.height = 20;
            ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                const cell = ws.getCell(`${col}${sigHeaderRow.number}`);
                cell.font = { bold: true, size: 10, color: { argb: 'FF1F3864' } }; cell.fill = fill('FFDCE6F1'); cell.border = thin; cell.alignment = center;
            });

            panel.faculty.forEach((fac: any) => {
                const isChair = fac._id.toString() === chairId;
                const sigRow = ws.addRow([null, isChair ? `${fac.name} (Chair)` : fac.name, null, isChair ? 'Panel Chair' : 'Panel Member', null, '', null, null]);
                ws.mergeCells(`B${sigRow.number}:C${sigRow.number}`);
                ws.mergeCells(`D${sigRow.number}:E${sigRow.number}`);
                ws.mergeCells(`F${sigRow.number}:H${sigRow.number}`);
                sigRow.height = 32;
                ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                    const cell = ws.getCell(`${col}${sigRow.number}`);
                    cell.border = thin; cell.alignment = col <= 'C' ? leftAlign : center; cell.font = { size: 10 };
                });
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename="Panels_Batch${batchYear || 'All'}_${semStr}Sem.xlsx"`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error exporting panels', error: error.message });
    }
};

// ─── Helper: fetch panel + its groups (shared by template/import/export-final) ────
async function getPanelWithGroups(panelId: string) {
    const panel = await Panel.findById(panelId).populate('faculty', 'name email photoUrl').lean() as any;
    if (!panel) return null;

    // Compute panel number: 1-based index among panels for the same batchYear sorted by createdAt
    const batchPanels = await Panel.find({ batchYear: panel.batchYear }).sort({ createdAt: 1 }).select('_id').lean();
    const panelNumber = batchPanels.findIndex((p: any) => String(p._id) === String(panel._id)) + 1;

    const panelFacultyIds = panel.faculty.map((f: any) => f._id.toString());
    const groups = await Group.find({ status: { $in: ['Approved', 'Forming', 'Pending'] }, isArchived: { $ne: true } })
        .populate('members', 'name rollNumber photoUrl email branch department')
        .populate({ path: 'project', populate: { path: 'faculty', select: 'name email photoUrl _id' } })
        .lean();

    const panelGroups = groups.filter((g: any) => {
        if (!g.project) return false;
        const projFacId = typeof g.project.faculty === 'string' ? g.project.faculty : g.project.faculty?._id?.toString();
        if (!projFacId || !panelFacultyIds.includes(projFacId)) return false;
        const gBatch = g.targetBatch ? String(g.targetBatch) : (g.members?.[0]?.rollNumber ? '20' + String(g.members[0].rollNumber).substring(0, 2) : 'Unknown');
        return gBatch === String(panel.batchYear);
    });

    panelGroups.sort((a: any, b: any) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0));
    return { panel, groups: panelGroups, panelNumber };
}

// Returns ordered list of rubric columns for the template (and import parser).
// For end-term: includes mid-term cols first, then end-term cols.
// section: 'guide' | 'panel1' | 'panel2'
const getTemplateRubricCols = (evalType: string, marksMode: string = 'rubric') => {
    const mid = RUBRIC_FIELDS['mid-term'];
    const end = RUBRIC_FIELDS['end-term'];
    type Col = { key: string; label: string; max: number; section: 'guide' | 'panel1' | 'panel2'; evalT: string; headerLabel: string; bgArgb: string };
    const cols: Col[] = [];

    const pMid = evalType === 'end-term' ? 'Mid-' : '';

    if (marksMode === 'direct') {
        const midGuideMax = mid.guide.reduce((acc, f) => acc + f.max, 0);
        const midPanelMax = mid.panel.reduce((acc, f) => acc + f.max, 0);

        cols.push({ key: 'guide_total', label: 'Guide Total', max: midGuideMax, section: 'guide', evalT: 'mid-term', headerLabel: `Guide (0-${midGuideMax})`, bgArgb: 'FFD6E4F7' });
        cols.push({ key: 'panel1_total', label: 'E1 Total', max: midPanelMax, section: 'panel1', evalT: 'mid-term', headerLabel: `E1 (0-${midPanelMax})`, bgArgb: 'FFD6F5D6' });
        cols.push({ key: 'panel2_total', label: 'E2 Total', max: midPanelMax, section: 'panel2', evalT: 'mid-term', headerLabel: `E2 (0-${midPanelMax})`, bgArgb: 'FFFCE4D6' });

        if (evalType === 'end-term') {
            const endGuideMax = end.guide.reduce((acc, f) => acc + f.max, 0);
            const endPanelMax = end.panel.reduce((acc, f) => acc + f.max, 0);

            cols.push({ key: 'guide_total', label: 'Guide Total', max: endGuideMax, section: 'guide', evalT: 'end-term', headerLabel: `Guide (0-${endGuideMax})`, bgArgb: 'FFBDD7EE' });
            cols.push({ key: 'panel1_total', label: 'E1 Total', max: endPanelMax, section: 'panel1', evalT: 'end-term', headerLabel: `E1 (0-${endPanelMax})`, bgArgb: 'FFB8F2B8' });
            cols.push({ key: 'panel2_total', label: 'E2 Total', max: endPanelMax, section: 'panel2', evalT: 'end-term', headerLabel: `E2 (0-${endPanelMax})`, bgArgb: 'FFFACDB0' });
        }
    } else {
        mid.guide.forEach(f => cols.push({ ...f, section: 'guide', evalT: 'mid-term', headerLabel: `[${pMid}Guide] ${f.label} (0-${f.max})`, bgArgb: 'FFD6E4F7' }));
        mid.panel.forEach(f => cols.push({ ...f, section: 'panel1', evalT: 'mid-term', headerLabel: `[${pMid}E1] ${f.label} (0-${f.max})`, bgArgb: 'FFD6F5D6' }));
        mid.panel.forEach(f => cols.push({ ...f, section: 'panel2', evalT: 'mid-term', headerLabel: `[${pMid}E2] ${f.label} (0-${f.max})`, bgArgb: 'FFFCE4D6' }));
        if (evalType === 'end-term') {
            end.guide.forEach(f => cols.push({ ...f, section: 'guide', evalT: 'end-term', headerLabel: `[End-Guide] ${f.label} (0-${f.max})`, bgArgb: 'FFBDD7EE' }));
            end.panel.forEach(f => cols.push({ ...f, section: 'panel1', evalT: 'end-term', headerLabel: `[End-E1] ${f.label} (0-${f.max})`, bgArgb: 'FFB8F2B8' }));
            end.panel.forEach(f => cols.push({ ...f, section: 'panel2', evalT: 'end-term', headerLabel: `[End-E2] ${f.label} (0-${f.max})`, bgArgb: 'FFFACDB0' }));
        }
    }
    return cols;
};

// ─── Download blank evaluation template ────────────────────────────────────────
export const downloadEvaluationTemplate = async (req: any, res: Response) => {
    try {
        const { panelId } = req.params;
        const evalType = (req.query.evalType as string) || 'end-term';

        if (!RUBRIC_FIELDS[evalType]) return res.status(400).json({ message: 'Invalid evalType. Use mid-term or end-term.' });

        const data = await getPanelWithGroups(panelId);
        if (!data) return res.status(404).json({ message: 'Panel not found' });

        const { panel, groups, panelNumber } = data;
        const marksMode = (req.query.marksMode as string) || 'rubric';
        const rubricCols = getTemplateRubricCols(evalType, marksMode);
        // FIXED_COLS = 8: 2 hidden IDs + Group No + Project Title + Name + Roll + Attendance + Stars
        const FIXED = 8;
        const totalCols = FIXED + rubricCols.length + 1; // +1 for Remarks

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Evaluation Template');

        const border: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };

        ws.columns = [
            { width: 0, hidden: true }, { width: 0, hidden: true }, // IDs
            { width: 10 }, { width: 30 }, { width: 22 }, { width: 14 }, // Group/Project/Name/Roll
            { width: 22 }, { width: 10 },                               // Attendance/Stars
            ...rubricCols.map(() => ({ width: 20 })),
            { width: 25 }                                               // Remarks
        ];

        const evalLabel = evalType === 'mid-term' ? 'MID-TERM' : 'END-TERM';
        const headerBlockRows = addCollegeAndPanelHeader(ws, panel, evalLabel, totalCols, panelNumber);

        let excelRowNum = headerBlockRows + 1;

        if (marksMode === 'direct') {
            const superLabels = ['', '', '', '', '', '', '', ''];
            superLabels.push('MID-TERM EVALUATION', '', '');
            if (evalType === 'end-term') {
                superLabels.push('END-TERM EVALUATION', '', '');
            }
            superLabels.push('');

            const sRow = ws.addRow(superLabels);
            sRow.font = { bold: true, color: { argb: 'FF000000' } };
            sRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sRow.eachCell((cell, colNum) => {
                if (colNum <= 2) return;
                cell.border = border;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
            });

            ws.mergeCells(excelRowNum, FIXED + 1, excelRowNum, FIXED + 3);
            if (evalType === 'end-term') {
                ws.mergeCells(excelRowNum, FIXED + 4, excelRowNum, FIXED + 6);
            }
            excelRowNum++;
        }

        const headerLabels = [
            '__GROUP_ID__', '__STUDENT_ID__',
            'Group No.', 'Project Title', 'Student Name', 'Roll No.',
            'Attendance (Present/Absent)', 'Stars (1-5)',
            ...rubricCols.map(c => c.headerLabel),
            'Remarks'
        ];
        const hRow = ws.addRow(headerLabels);
        hRow.font = { bold: true };
        hRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        hRow.height = 45;
        hRow.eachCell((cell, colNum) => {
            if (colNum <= 2) return;
            cell.border = border;
            if (colNum <= FIXED) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
            } else if (colNum <= FIXED + rubricCols.length) {
                const rc = rubricCols[colNum - FIXED - 1];
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rc.bgArgb } };
            } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
            }
        });

        // Data rows
        excelRowNum++; // advance past headerLabels
        groups.forEach((g: any, gIdx: number) => {
            const members: any[] = g.members || [];
            const groupStartRow = excelRowNum;
            const fillColor = gIdx % 2 === 0 ? 'FFFFFFFF' : 'FFEAEAEA';

            members.forEach((m: any, mIdx: number) => {
                const row = ws.addRow([
                    g._id.toString(), m._id.toString(),
                    mIdx === 0 ? g.name : '',
                    mIdx === 0 ? (g.project?.title || '') : '',
                    m.name || '', m.rollNumber || '',
                    'Present', '',
                    ...rubricCols.map(() => ''),
                    ''
                ]);

                // Attendance dropdown (col 7)
                (row.getCell(7) as any).dataValidation = {
                    type: 'list', allowBlank: false, formulae: ['"Present,Absent"'],
                    showErrorMessage: true, error: 'Must be Present or Absent', errorTitle: 'Invalid'
                };
                // Stars dropdown (col 8)
                (row.getCell(8) as any).dataValidation = {
                    type: 'list', allowBlank: true, formulae: ['"1,2,3,4,5"'],
                    showErrorMessage: true, error: 'Must be 1-5', errorTitle: 'Invalid'
                };
                // Per-rubric range validation
                rubricCols.forEach((rc, ci) => {
                    (row.getCell(FIXED + 1 + ci) as any).dataValidation = {
                        type: 'whole', operator: 'between', formulae: [0, rc.max],
                        allowBlank: true, showErrorMessage: true,
                        error: `Must be 0–${rc.max}`, errorTitle: 'Out of Range'
                    };
                });

                row.eachCell((cell, colNum) => {
                    if (colNum <= 2) return;
                    cell.border = border;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                });
                excelRowNum++;
            });

            if (members.length > 1) {
                const groupEndRow = groupStartRow + members.length - 1;
                ws.mergeCells(groupStartRow, 3, groupEndRow, 3);
                ws.mergeCells(groupStartRow, 4, groupEndRow, 4);
                ws.getCell(groupStartRow, 3).alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getCell(groupStartRow, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            }
        });

        if (groups.length === 0) ws.addRow(['', '', 'No groups assigned to this panel yet.']);

        const buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename=eval_template_panel_${panelId}_${evalType}.xlsx`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error generating template', error: error.message });
    }
};

// ─── Import filled evaluation template ─────────────────────────────────────────
export const importEvaluationTemplate = async (req: any, res: Response) => {
    const filePath = req.file?.path;
    try {
        const { panelId } = req.params;
        const evalType = (req.query.evalType as string) || 'end-term';
        const marksMode = (req.query.marksMode as string) || 'rubric';

        if (!RUBRIC_FIELDS[evalType]) return res.status(400).json({ message: 'Invalid evalType.' });
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

        const data = await getPanelWithGroups(panelId);
        if (!data) return res.status(404).json({ message: 'Panel not found' });

        const rubricCols = getTemplateRubricCols(evalType, marksMode);
        const FIXED = 8;
        const remarksColIdx = FIXED + rubricCols.length + 1;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath!);
        const ws = workbook.getWorksheet('Evaluation Template');
        if (!ws) return res.status(400).json({ message: 'Worksheet "Evaluation Template" not found in file.' });

        const errors: { row: number; message: string }[] = [];
        type StudentEntry = {
            studentId: string; attendance: string; stars: number;
            scores: Record<string, Record<string, Record<string, number>>>; // evalT → section → key → val
            remarks: string;
        };
        const groupMap: Record<string, { groupId: string; students: StudentEntry[] }> = {};

        const totalRows = ws.rowCount;
        for (let r = 2; r <= totalRows; r++) {
            const row = ws.getRow(r);
            const getCell = (col: number) => {
                const v = row.getCell(col).value;
                if (v === null || v === undefined) return '';
                return typeof v === 'object' && 'result' in v ? String((v as any).result) : String(v).trim();
            };

            const groupId = getCell(1);
            const studentId = getCell(2);
            if (!groupId || !studentId || groupId.length !== 24 || studentId.length !== 24) continue;

            const groupName = getCell(3);
            const attendance = getCell(7);
            const starsRaw = getCell(8);

            if (!['Present', 'Absent'].includes(attendance))
                errors.push({ row: r, message: `Group ${groupName}: Attendance must be "Present" or "Absent", got "${attendance}"` });

            let stars = 0;
            if (starsRaw !== '') {
                stars = Number(starsRaw);
                if (isNaN(stars) || stars < 1 || stars > 5)
                    errors.push({ row: r, message: `Group ${groupName}: Stars must be 1-5, got "${starsRaw}"` });
            }

            // Parse rubric scores
            const scores: Record<string, Record<string, Record<string, number>>> = {};
            rubricCols.forEach((rc, ci) => {
                const val = getCell(FIXED + 1 + ci);
                if (!scores[rc.evalT]) scores[rc.evalT] = {};
                if (!scores[rc.evalT][rc.section]) scores[rc.evalT][rc.section] = {};
                if (val === '') { scores[rc.evalT][rc.section][rc.key] = 0; return; }
                const num = Number(val);
                if (isNaN(num) || num < 0 || num > rc.max)
                    errors.push({ row: r, message: `Group ${groupName}: ${rc.headerLabel} must be 0-${rc.max}, got "${val}"` });
                scores[rc.evalT][rc.section][rc.key] = isNaN(num) ? 0 : Math.min(num, rc.max);
            });

            const remarks = getCell(remarksColIdx);
            if (!groupMap[groupId]) groupMap[groupId] = { groupId, students: [] };
            groupMap[groupId].students.push({ studentId, attendance, stars, scores, remarks });
        }

        if (errors.length > 0)
            return res.status(400).json({ message: 'Validation errors found. No data was saved.', errors });

        // Write to DB
        const upsert = (project: any, sv: StudentEntry, et: string) => {
            const sections = sv.scores[et] || {};
            let guide = sections.guide || {};
            let panel1 = sections.panel1 || {};
            let panel2 = sections.panel2 || {};

            if (marksMode === 'direct') {
                const fields = RUBRIC_FIELDS[et];
                const redistribute = (total: number, rubricSec: any[]) => {
                    const sumMax = rubricSec.reduce((a: number, b: any) => a + b.max, 0);
                    const res: any = {};
                    if (sumMax === 0 || total === 0) {
                        rubricSec.forEach((f: any) => res[f.key] = 0);
                        return res;
                    }
                    let remaining = total;
                    rubricSec.forEach((f: any, idx: number) => {
                        if (idx === rubricSec.length - 1) {
                            res[f.key] = Number(remaining.toFixed(2));
                        } else {
                            const val = (total / sumMax) * f.max;
                            res[f.key] = Number(val.toFixed(2));
                            remaining -= res[f.key];
                        }
                    });
                    return res;
                };
                guide = redistribute(Number(guide.guide_total || 0), fields.guide);
                panel1 = redistribute(Number(panel1.panel1_total || 0), fields.panel);
                panel2 = redistribute(Number(panel2.panel2_total || 0), fields.panel);
            }

            const guideTotal = Object.values(guide).reduce((s: number, v: any) => s + Number(v || 0), 0);
            const p1Total = Object.values(panel1).reduce((s: number, v: any) => s + Number(v || 0), 0);
            const p2Total = Object.values(panel2).reduce((s: number, v: any) => s + Number(v || 0), 0);
            const panelAvg = p2Total > 0 ? (p1Total + p2Total) / 2 : p1Total;
            const marks = guideTotal + panelAvg;

            const existing = (project.studentEvaluations as any[]).find(
                (e: any) => String(e.student) === sv.studentId && e.evalType === et
            );
            if (existing) {
                if (et === evalType) { existing.attendance = sv.attendance.toLowerCase(); existing.stars = sv.stars; }
                existing.guide = guide; existing.panel1 = panel1; existing.panel2 = panel2;
                existing.marks = marks; existing.updatedAt = new Date();
            } else {
                (project.studentEvaluations as any[]).push({
                    student: sv.studentId, evalType: et,
                    attendance: et === evalType ? sv.attendance.toLowerCase() : 'present',
                    stars: et === evalType ? sv.stars : 0,
                    guide, panel1, panel2, marks, updatedAt: new Date()
                });
            }
        };

        let updatedCount = 0;
        for (const entry of Object.values(groupMap)) {
            const group = data.groups.find((g: any) => g._id.toString() === entry.groupId) as any;
            if (!group?.project?._id) continue;
            const project = await Project.findById(group.project._id);
            if (!project) continue;

            const evalMeta: any = { remarks: entry.students[0]?.remarks || '', gradedBy: req.user.id, date: new Date() };
            if (evalType === 'mid-term') project.midTermEvaluation = evalMeta;
            else { project.endTermEvaluation = evalMeta; project.midTermEvaluation = project.midTermEvaluation || evalMeta; }
            project.markModified('midTermEvaluation');
            project.markModified('endTermEvaluation');

            if (!project.studentEvaluations) project.studentEvaluations = [];
            // Collect all evalTypes present in the rubricCols
            const evalTypes = [...new Set(rubricCols.map(rc => rc.evalT))];
            for (const sv of entry.students) {
                for (const et of evalTypes) upsert(project, sv, et);
            }
            project.markModified('studentEvaluations');
            await project.save();
            updatedCount++;
        }

        res.json({ message: 'Evaluations imported successfully.', updatedGroups: updatedCount });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error importing evaluations', error: error.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
};

// ─── Export final sheet with marks + grades for a single panel ─────────────────
export const exportPanelFinalSheet = async (req: any, res: Response) => {
    try {
        const { panelId } = req.params;
        const evalType = (req.query.evalType as string) || 'full';

        const data = await getPanelWithGroups(panelId);
        if (!data) return res.status(404).json({ message: 'Panel not found' });

        const { panel, groups, panelNumber } = data;
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Final Sheet');

        const border: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };

        const midRubric = RUBRIC_FIELDS['mid-term'];
        const endRubric = RUBRIC_FIELDS['end-term'];
        const includeMid = evalType === 'full' || evalType === 'mid-term';
        const includeEnd = evalType === 'full' || evalType === 'end-term';

        // Column definitions
        const cols: any[] = [
            { header: 'Group No.', width: 10 },
            { header: 'Project Title', width: 35 },
            { header: 'Student Name', width: 25 },
            { header: 'Roll No.', width: 15 },
            { header: 'Attendance', width: 12 }
        ];

        // Helper: read rubric field from panel1 (with fallback to legacy panel) or panel2
        const getP = (se: any, section: 'panel1' | 'panel2', key: string) =>
            se?.[section]?.[key] ?? (section === 'panel1' ? se?.panel?.[key] : 0) ?? 0;

        if (includeMid) {
            cols.push({ header: `Guide (0-15)`, width: 15 });
            cols.push({ header: `E1 (0-15)`, width: 15 });
            cols.push({ header: `E2 (0-15)`, width: 15 });
        }
        if (includeEnd) {
            cols.push({ header: `Guide (0-35)`, width: 15 });
            cols.push({ header: `E1 (0-35)`, width: 15 });
            cols.push({ header: `E2 (0-35)`, width: 15 });
        }
        cols.push({ header: 'Total (100)', width: 13 });
        cols.push({ header: 'Grade', width: 10 });

        ws.columns = cols.map(c => ({ width: c.width }));

        const finalEvalLabel = evalType === 'mid-term' ? 'MID-TERM' : evalType === 'end-term' ? 'END-TERM' : 'FULL';
        const headerBlockRows = addCollegeAndPanelHeader(ws, panel, finalEvalLabel, cols.length, panelNumber);

        let excelRowNum = headerBlockRows + 1;

        const superLabels = ['', '', '', '', ''];
        if (includeMid) superLabels.push('MID-TERM EVALUATION', '', '');
        if (includeEnd) superLabels.push('END-TERM EVALUATION', '', '');
        superLabels.push('OVERALL', '');

        const sRow = ws.addRow(superLabels);
        sRow.font = { bold: true, color: { argb: 'FF000000' } };
        sRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        sRow.eachCell((cell, colNum) => {
            if (colNum <= 5) return;
            cell.border = border;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
        });

        if (includeMid && !includeEnd) {
            ws.mergeCells(excelRowNum, 6, excelRowNum, 8);
            ws.mergeCells(excelRowNum, 9, excelRowNum, 10);
        } else if (!includeMid && includeEnd) {
            ws.mergeCells(excelRowNum, 6, excelRowNum, 8);
            ws.mergeCells(excelRowNum, 9, excelRowNum, 10);
        } else if (includeMid && includeEnd) {
            ws.mergeCells(excelRowNum, 6, excelRowNum, 8);
            ws.mergeCells(excelRowNum, 9, excelRowNum, 11);
            ws.mergeCells(excelRowNum, 12, excelRowNum, 13);
        }
        excelRowNum++;

        const hRow = ws.addRow(cols.map(c => c.header));
        hRow.font = { bold: true };
        hRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        hRow.height = 45;
        hRow.eachCell((cell) => {
            cell.border = border;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
        });

        groups.forEach((g: any, gIdx: number) => {
            const members: any[] = g.members || [];
            const studentEvals: any[] = g.project?.studentEvaluations || [];
            const fillColor = gIdx % 2 === 0 ? 'FFFFFFFF' : 'FFEAEAEA';

            members.forEach((m: any, mIdx: number) => {
                const midSE = studentEvals.find((e: any) => String(e.student?._id || e.student) === String(m._id) && e.evalType === 'mid-term');
                const endSE = studentEvals.find((e: any) => String(e.student?._id || e.student) === String(m._id) && e.evalType === 'end-term');
                const primarySE = includeEnd ? endSE : midSE;

                const rowData: any[] = [
                    mIdx === 0 ? g.name : '',
                    mIdx === 0 ? g.project?.title || '' : '',
                    m.name || '',
                    m.rollNumber || '',
                    primarySE ? (primarySE.attendance === 'present' ? 'Present' : 'Absent') : '',
                ];

                let midTotal = 0;
                if (includeMid) {
                    let gSum = 0; midRubric.guide.forEach(f => gSum += midSE?.guide?.[f.key] || 0);
                    let p1Sum = 0; midRubric.panel.forEach(f => p1Sum += getP(midSE, 'panel1', f.key));
                    let p2Sum = 0; midRubric.panel.forEach(f => p2Sum += getP(midSE, 'panel2', f.key));

                    if (midSE) {
                        rowData.push(Number(gSum.toFixed(2)));
                        rowData.push(Number(p1Sum.toFixed(2)));
                        rowData.push(Number(p2Sum.toFixed(2)));
                    } else {
                        rowData.push('', '', '');
                    }

                    midTotal = gSum + (p2Sum > 0 ? (p1Sum + p2Sum) / 2 : p1Sum);
                    if (midSE) midTotal = Number(midSE.marks ?? midTotal) || midTotal;
                    midTotal = Math.round(midTotal * 100) / 100;
                }

                let endTotal = 0;
                if (includeEnd) {
                    let gSum = 0; endRubric.guide.forEach(f => gSum += endSE?.guide?.[f.key] || 0);
                    let p1Sum = 0; endRubric.panel.forEach(f => p1Sum += getP(endSE, 'panel1', f.key));
                    let p2Sum = 0; endRubric.panel.forEach(f => p2Sum += getP(endSE, 'panel2', f.key));

                    if (endSE) {
                        rowData.push(Number(gSum.toFixed(2)));
                        rowData.push(Number(p1Sum.toFixed(2)));
                        rowData.push(Number(p2Sum.toFixed(2)));
                    } else {
                        rowData.push('', '', '');
                    }

                    endTotal = gSum + (p2Sum > 0 ? (p1Sum + p2Sum) / 2 : p1Sum);
                    if (endSE) endTotal = Number(endSE.marks ?? endTotal) || endTotal;
                    endTotal = Math.round(endTotal * 100) / 100;
                }

                const grand = Math.round(((midSE ? midTotal : 0) + (endSE ? endTotal : 0)) * 100) / 100;
                rowData.push((midSE || endSE) ? grand : '');
                rowData.push((midSE || endSE) ? calculateGrade(grand) : '');

                const row = ws.addRow(rowData);
                row.eachCell((cell) => {
                    cell.border = border;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                });
            });
        });

        const panelFacultyNames = panel.faculty.map((f: any) => f.name).join('_');
        const buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename=final_sheet_panel_${panelFacultyNames}_${evalType}.xlsx`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error exporting final sheet', error: error.message });
    }
};

/**
 * Export existing panels in the exact re-importable format:
 *   Panel Number | Faculty Emails (comma separated) | Room Number (Optional)
 * Filters by batchYear. The output can be downloaded, edited, and re-uploaded
 * via the "Upload Excel" panel import flow.
 */
export const exportPanelsAsTemplate = async (req: any, res: Response) => {
    try {
        const { batchYear } = req.query;

        let query: any = { isArchived: { $ne: true } };
        if (batchYear && batchYear !== 'All') query.batchYear = Number(batchYear);

        const panels = await Panel.find(query)
            .populate('faculty', 'name email')
            .lean() as any[];

        // Sort panels by their numeric panel number / name
        panels.sort((a: any, b: any) => {
            const na = parseInt(a.name || a.panelNumber || '0') || 0;
            const nb = parseInt(b.name || b.panelNumber || '0') || 0;
            return na - nb;
        });

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Panel Template');

        ws.columns = [
            { header: 'Panel Number', key: 'panelNumber', width: 15 },
            { header: 'Faculty Emails (comma separated)', key: 'facultyEmails', width: 60 },
            { header: 'Room Number (Optional)', key: 'room', width: 20 },
        ];

        // Style header row
        const hdr = ws.getRow(1);
        hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hdr.height = 22;
        hdr.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // One row per panel with all faculty emails joined by ", "
        panels.forEach((panel: any, idx: number) => {
            const panelNum = panel.name || panel.panelNumber || String(idx + 1);
            const emails = (panel.faculty || []).map((f: any) => f.email || '').filter(Boolean).join(', ');
            const room = panel.room || '';
            const row = ws.addRow({ panelNumber: panelNum, facultyEmails: emails, room });
            row.height = 18;
            row.eachCell({ includeEmpty: true }, (cell, col) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left' };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const suffix = batchYear && batchYear !== 'All' ? `_Batch${batchYear}` : '';
        res.set('Content-Disposition', `attachment; filename="panels_reimport${suffix}.xlsx"`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error: any) {
        console.error('exportPanelsAsTemplate error:', error);
        res.status(500).json({ message: 'Error exporting panel template', error: error.message });
    }
};

export const downloadPanelTemplate = async (req: any, res: Response) => {
    try {
        const { batchYear } = req.query;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Panel Template');
        worksheet.columns = [
            { header: 'Panel Number', key: 'panelNumber', width: 15 },
            { header: 'Faculty Emails (comma separated)', key: 'facultyEmails', width: 50 },
            { header: 'Room Number (Optional)', key: 'room', width: 25 },
        ];
        worksheet.addRow({ panelNumber: '1', facultyEmails: 'faculty1@iiitnr.edu.in, faculty2@iiitnr.edu.in', room: '304' });
        worksheet.addRow({ panelNumber: '2', facultyEmails: 'faculty3@iiitnr.edu.in' });
        worksheet.getRow(1).font = { bold: true };
        const buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename=panel_import_template_${batchYear || 'All'}.xlsx`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error: any) {
        console.error('Error downloading panel template:', error);
        res.status(500).json({ message: 'Error downloading panel template' });
    }
};

export const previewPanelImport = async (req: any, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0];

        const panelsMap: Record<string, { id: string, room: string, emails: string[] }> = {};

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            let panelNo = row.getCell(1).text?.trim() || row.getCell(1).value?.toString().trim();
            const emailsRaw = row.getCell(2).text || row.getCell(2).value?.toString().trim() || "";
            let room = row.getCell(3).text?.trim() || row.getCell(3).value?.toString().trim() || "";
            if (panelNo) {
                if (!panelsMap[panelNo]) {
                    panelsMap[panelNo] = { id: `panel-imported-${panelNo}`, room, emails: [] };
                }
                const emails = emailsRaw.split(/[\s,;\n\r]+/).map((e: string) => e.trim()).filter((e: string) => e !== "");
                panelsMap[panelNo].emails.push(...emails);
                if (room && !panelsMap[panelNo].room) {
                    panelsMap[panelNo].room = room;
                }
            }
        });

        fs.unlinkSync(req.file.path);

        const allFaculty = await User.find({ role: 'Faculty' }).select('_id email name').lean();
        const facultyByEmail = new Map(allFaculty.map(f => [(f.email || '').toLowerCase(), f]));
        const draftPanels = [];

        const groups = await Group.find({ status: { $in: ['Approved', 'Pending'] }, isArchived: { $ne: true } })
            .populate('project', 'faculty')
            .populate('members', 'targetBatch rollNumber')
            .lean();

        const getGroupBatchYear = (g: any) => {
            if (g.targetBatch) return String(g.targetBatch);
            if (g.batchYear) return String(g.batchYear);
            if (g.members && g.members.length > 0) {
                const m = g.members[0];
                if (m.targetBatch) return String(m.targetBatch);
                if (m.rollNumber) return '20' + String(m.rollNumber).substring(0, 2);
            }
            return '';
        };

        const batchGroups = groups.filter((g: any) => getGroupBatchYear(g) === String(req.body.batchYear));

        const getGroupCount = (facId: string) => {
            return batchGroups.filter((g: any) => g.project && (String(g.project.faculty) === facId || (g.project.faculty && String(g.project.faculty._id) === facId))).length;
        };

        for (const [panelNo, panelData] of Object.entries(panelsMap)) {
            const faculties: any[] = [];
            for (const email of panelData.emails) {
                const fac = facultyByEmail.get(email.toLowerCase());
                if (fac) {
                    // Check if already added to this panel (handles duplicate emails in the same row)
                    if (!faculties.find(f => f._id === String(fac._id))) {
                        faculties.push({
                            _id: String(fac._id),
                            name: fac.name,
                            email: fac.email,
                            groupCount: getGroupCount(String(fac._id))
                        });
                    }
                }
            }
            if (faculties.length > 0) {
                draftPanels.push({
                    id: panelData.id,
                    faculties,
                    room: panelData.room
                });
            }
        }
        res.json({ draftPanels });
    } catch (error: any) {
        console.error('Error previewing panel import:', error);
        res.status(500).json({ message: 'Error parsing Excel file', error: error.message });
    }
};

/**
 * Export all groups in the EXACT official IIITNR format matching:
 * MINOR Project-II (IV Semester)_2025-2026.xlsx
 *
 * Reverse-engineered format:
 *  - Row 1  : Header | bg #A4C2F4 (cornflower blue) | bold | centered | wrap
 *  - Odd  group rows : no background fill (default white)
 *  - Even group rows : solid fill #999999 (grey)
 *  - Multi-member groups: columns E, F, G are merged vertically across all member rows
 *  - Column A (K): serial number on first member row only — NOT merged
 *  - Columns B, C, D: one row per member — NOT merged
 *  - Column widths: A=7.38, B=21.88, C=16.75, D≈8.43(default), E=25.88, F=21, G=23.38
 */
export const exportOfficialFormat = async (req: any, res: Response) => {
    try {
        const { batchYear } = req.query;

        if (!batchYear || batchYear === 'All') {
            return res.status(400).json({ message: 'Please specify a batch year.' });
        }

        const allGroups = await Group.find({ status: { $in: ['Approved', 'Pending'] }, isArchived: { $ne: true } })
            .populate('members', 'name rollNumber branch department')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name' }
            })
            .lean();

        // Filter by batch year
        const filteredGroups = allGroups.filter((g: any) => {
            const gBatch = g.targetBatch
                ? String(g.targetBatch)
                : (g.members && g.members.length > 0 && g.members[0].rollNumber
                    ? '20' + String(g.members[0].rollNumber).substring(0, 2)
                    : 'Unknown');
            return gBatch === String(batchYear);
        });

        // Sort by group name (numeric)
        filteredGroups.sort((a: any, b: any) => {
            const numA = parseInt(a.name) || 0;
            const numB = parseInt(b.name) || 0;
            return numA - numB;
        });

        if (filteredGroups.length === 0) {
            return res.status(204).end();
        }


        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Sheet1');

        // ── Column widths from reference file (bumped up ~20% for readability) ─
        // Col D has no custom width in source (uses Excel default ~8.43)
        ws.columns = [
            { width: 9 }, // A – K (serial)
            { width: 28 }, // B – Project Group Members Name
            { width: 20 }, // C – Roll No
            { width: 12 }, // D – Department
            { width: 34 }, // E – Title of the Minor Project
            { width: 27 }, // F – Area of Project
            { width: 30 }, // G – Name of the Supervisor
        ];

        // ── Exact header background: #A4C2F4 ─────────────────────────────────────
        const HEADER_BG = 'FFA4C2F4';  // exact color from reference file
        const GREY_BG = 'FF999999';  // even group rows
        // Odd groups have no fill (patternType: none) = default white

        const thinBorder: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
        };

        // ── Header row ────────────────────────────────────────────────────────────
        const headerRow = ws.addRow([
            'K',
            'Project Group Members Name',
            'Roll No',
            'Department',
            'Title of the Minor Project',
            'Area of Project',
            'Name of the  Supervisor',   // <-- double space as in the original
        ]);
        headerRow.height = 32;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
            cell.border = thinBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        // ── Data rows ─────────────────────────────────────────────────────────────
        let currentExcelRow = 2; // data starts at row 2 (header is row 1)

        filteredGroups.forEach((g: any, gIdx: number) => {
            const project = g.project;
            const members = (g.members || []) as any[];
            const title = project?.title || '';
            const area = (project?.tags || []).join(', ');
            const supervisor = project?.faculty?.name || '';
            const memberCount = members.length;

            // Even groups (gIdx 1, 3, 5... i.e. 2nd, 4th, 6th group) get grey bg
            // Odd groups (gIdx 0, 2, 4... i.e. 1st, 3rd, 5th) get no fill
            const isEvenGroup = (gIdx + 1) % 2 === 0; // gIdx is 0-based

            members.forEach((m: any, mIdx: number) => {
                const isFirst = mIdx === 0;
                const dept = m.branch || m.department || '';

                // For non-first members: E, F, G cells are empty (they'll be covered by merge)
                const rowData: any[] = [
                    isFirst ? (gIdx + 1) : '',   // A – serial only on first row
                    m.name || '',            // B – always filled
                    m.rollNumber || '',            // C – always filled
                    dept,                          // D – always filled
                    isFirst ? title : '',     // E – filled only on first row
                    isFirst ? area : '',     // F – filled only on first row
                    isFirst ? supervisor : '',     // G – filled only on first row
                ];

                const dataRow = ws.addRow(rowData);
                dataRow.height = 24;

                dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
                    cell.border = thinBorder;

                    // Vertical alignment for all, wrap text for Title/Area/Supervisor
                    cell.alignment = {
                        horizontal: colNum === 1 ? 'center' : 'left',
                        vertical: colNum >= 5 ? 'top' : 'middle',
                        wrapText: colNum >= 5,
                    };

                    // Apply fill: even groups get grey, odd get no fill (white default)
                    if (isEvenGroup) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } };
                    }
                    // Odd groups: no fill needed (default white)
                });

                currentExcelRow++;
            });

            // ── Vertical merges for multi-member groups ───────────────────────────
            // Columns E (5), F (6), G (7) are merged vertically across all member rows
            if (memberCount > 1) {
                const firstMemberRow = currentExcelRow - memberCount;
                const lastMemberRow = currentExcelRow - 1;

                // Merge E, F, G columns
                ['E', 'F', 'G'].forEach(col => {
                    ws.mergeCells(`${col}${firstMemberRow}:${col}${lastMemberRow}`);
                    // Re-apply styling to the merged cell (top-left cell holds the value)
                    const mergedCell = ws.getCell(`${col}${firstMemberRow}`);
                    mergedCell.border = thinBorder;
                    mergedCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
                    if (isEvenGroup) {
                        mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } };
                    }
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const acadEnd = Number(batchYear) + 4;
        const fileName = `MINOR_Project_Batch_${batchYear}-${acadEnd}.xlsx`;

        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error: any) {
        console.error('Official format export failed:', error);
        res.status(500).json({ message: 'Error exporting official format', error: error.message });
    }
};
