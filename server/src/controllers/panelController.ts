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
    const romanSems = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
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
            { width: 3 }, // Spacer
            { width: 10 }, // Group No.
            { width: 25 }, // Student's name
            { width: 15 }, // Roll no.
            { width: 15 }, // Department
            { width: 40 }, // Title of the Project
            { width: 25 }, // Supervisor Name
            { width: 10 }, { width: 10 }, { width: 10 }, { width: 20 }, // Mid term (E1, E2, Guide, Avg)
            { width: 10 }, { width: 10 }, { width: 10 }, { width: 20 }, // End term (E1, E2, Guide, Avg)
            { width: 10 }, // Total
            { width: 10 }  // Grade
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
            headerRow2Data.push('E1 (35)', 'E2 (35)', 'Guide (35)', '', '', '');
        }

        const headerRow1 = pSheet.addRow(headerRow1Data);
        const headerRow2 = pSheet.addRow(headerRow2Data);

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

        [headerRow1, headerRow2].forEach(row => {
            row.font = { bold: true };
            row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            row.eachCell((cell, colNumber) => {
                if (colNumber > 1) {
                    cell.border = borderStyle;
                    let bgColor = 'FFED7D31'; // Default Orange
                    if (colNumber === 11 || colNumber === 15) bgColor = 'FFFFF2CC'; // Pale yellow
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
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

            members.forEach((m: any, mIdx: number) => {
                const midSE = studentEvals.find((e: any) => String(e.student?._id || e.student) === String(m._id) && e.evalType === 'mid-term');
                const endSE = studentEvals.find((e: any) => String(e.student?._id || e.student) === String(m._id) && e.evalType === 'end-term');

                let midE1 = '', midE2 = '', midGuide = '', midAvg = '';
                if (midSE) {
                    midGuide = String(Object.values(midSE.guide || {}).reduce((s: number, v: any) => s + Number(v || 0), 0));
                    const midPanel = Object.values(midSE.panel || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    midE1 = String(midPanel);
                    midAvg = String(midSE.marks ?? (Number(midGuide) + midPanel));
                }

                let endE1 = '', endE2 = '', endGuide = '', endAvg = '';
                if (endSE && evalType === 'full') {
                    endGuide = String(Object.values(endSE.guide || {}).reduce((s: number, v: any) => s + Number(v || 0), 0));
                    const endPanel = Object.values(endSE.panel || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);
                    endE1 = String(endPanel);
                    endAvg = String(endSE.marks ?? (Number(endGuide) + endPanel));
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
                
                // Color logic: Alternate background for each GROUP (not each row)
                const fillColor = gIdx % 2 === 0 ? 'FFFFFFFF' : 'FFEAEAEA'; // White vs Light Grey (Darker than before)

                row.eachCell((cell, colNum) => {
                    if (colNum > 1) {
                        cell.border = borderStyle;
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: fillColor }
                        };
                    }
                });
            });
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
        if (batchYear && batchYear !== 'All') {
            query.batchYear = Number(batchYear);
        }
        if (includeArchived !== 'true') query.isArchived = { $ne: true };

        const panels = await Panel.find(query).populate('faculty', 'name email photoUrl').lean();

        // Get groups similarly, but cache groups
        const groups = await Group.find({ status: { $in: ['Approved', 'Pending'] }, isArchived: { $ne: true } })
            .populate('members', 'name rollNumber photoUrl')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email photoUrl _id' }
            })
            .lean();

        // Setup ExcelJS Workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Panels');

        // Prepare groups per panel
        const panelGroupsArray: any[][] = [];
        panels.forEach((panel: any) => {
            const panelFacultyIds = panel.faculty.map((f: any) => f._id.toString());
            const pGroups = groups.filter((g: any) => {
                if (!g.project) return false;
                let projFacId = null;
                if (typeof g.project.faculty === 'string') {
                    projFacId = g.project.faculty;
                } else if (g.project.faculty && g.project.faculty._id) {
                    projFacId = g.project.faculty._id.toString();
                }
                if (!projFacId) return false;
                if (!panelFacultyIds.includes(projFacId)) return false;

                const gBatch = g.targetBatch ? String(g.targetBatch) : (g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + String(g.members[0].rollNumber).substring(0, 2) : 'Unknown');
                if (gBatch !== String(panel.batchYear)) return false;

                return true;
            });
            panelGroupsArray.push(pGroups);
        });

        // Setup Columns
        const columns = [
            { key: 'label', width: 15 },
            ...panels.map((p: any, i: number) => ({
                key: `panel_${i}`,
                width: 30
            }))
        ];
        worksheet.columns = columns;

        // Base Styling constants
        const borderStyle: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        const centerAlignment: Partial<ExcelJS.Alignment> = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
        };

        const refBatchYear = panels.length > 0 ? panels[0].batchYear : (batchYear !== 'All' ? Number(batchYear) : new Date().getFullYear());
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const yearDiff = currentYear - refBatchYear;
        let semCount = yearDiff * 2;
        if (currentMonth >= 6) semCount += 1;
        if (semCount < 1) semCount = 1;
        const romanSems = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const summarySemStr = romanSems[semCount - 1] || `${semCount}th`;

        // Add 1-4 Headers
        worksheet.addRow({ label: 'Dr. SPM International Institute of Information Technology, Naya Raipur' });
        worksheet.addRow({ label: '(A Joint Initiative of Govt. of Chhattisgarh and NTPC)' });
        worksheet.addRow({ label: 'Email: iiitnr@iiitnr.ac.in, Tel: (0771) 2474040, Web: www.iiitnr.ac.in' });
        worksheet.addRow({ label: `MINOR PROJECT EVALUATION- B.Tech. ${summarySemStr} SEM` });
        worksheet.addRow({}); // Empty row 5

        for (let i = 1; i <= 4; i++) {
            if (panels.length > 0) worksheet.mergeCells(i, 1, i, panels.length + 1);
            const cell = worksheet.getCell(i, 1);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (i === 1) cell.font = { bold: true, size: 14, color: { argb: 'FF0070C0' } };
            else if (i === 4) cell.font = { bold: true, size: 12, underline: true };
            else cell.font = { size: 11 };
        }

        // Format Header Row (Row 6)
        const headerRowValues: any = { label: '' };
        panels.forEach((p: any, i: number) => { headerRowValues[`panel_${i}`] = `Panel-${i + 1}`; });
        const headerRow = worksheet.addRow(headerRowValues);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text on headers is cleaner
        headerRow.alignment = centerAlignment;
        headerRow.eachCell((cell, colNumber) => {
            cell.border = borderStyle;
            if (colNumber > 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF0070C0' } // Blue headers for panels
                };
            }
        });

        // Add Faculty Row (Row 7)
        const facultyRowValues: any = { label: '' };
        panels.forEach((p: any, i: number) => {
            const pGroups = panelGroupsArray[i] || [];
            const facultyWithCounts = p.faculty.map((f: any) => {
                const count = pGroups.filter((g: any) => {
                    const projFacId = typeof g.project?.faculty === 'string' ? g.project.faculty : (g.project?.faculty?._id?.toString() || null);
                    return projFacId === f._id.toString();
                }).length;
                return { ...f, groupCount: count };
            });

            let chairId = null;
            if (facultyWithCounts.length > 0) {
                const maxLoad = Math.max(...facultyWithCounts.map((f: any) => f.groupCount));
                chairId = facultyWithCounts.find((f: any) => f.groupCount === maxLoad)?._id.toString();
            }

            facultyRowValues[`panel_${i}`] = p.faculty.map((f: any) => {
                return f._id.toString() === chairId ? `${f.name} (Chair)` : f.name;
            }).join(', ');
        });
        const facultyRow = worksheet.addRow(facultyRowValues);
        facultyRow.font = { bold: true };
        facultyRow.alignment = centerAlignment;
        facultyRow.eachCell((cell) => {
            cell.border = borderStyle;
        });

        // Find max groups in any panel to know how many rows to create
        let maxGroups = 0;
        if (panelGroupsArray.length > 0) {
            maxGroups = Math.max(...panelGroupsArray.map((pg) => pg.length));
        }

        // Add Group Rows
        let groupNosCellMerged = false;
        const groupStartRow = worksheet.rowCount + 1;

        for (let i = 0; i < maxGroups; i++) {
            const groupRowValues: any = { label: i === 0 ? 'Group Nos.' : '' };

            panels.forEach((p: any, panelIndex: number) => {
                const pGroups = panelGroupsArray[panelIndex];
                if (pGroups && pGroups[i]) {
                    groupRowValues[`panel_${panelIndex}`] = pGroups[i].name || '';
                } else {
                    groupRowValues[`panel_${panelIndex}`] = '';
                }
            });

            const row = worksheet.addRow(groupRowValues);
            row.alignment = centerAlignment;
            row.eachCell((cell, colNumber) => {
                if (colNumber > 1) { // Only set border and color for actual panel cells
                    // In image, group numbers are often red text
                    cell.font = { color: { argb: 'FFFF0000' } };
                }
            });
        }

        // Merge 'Group Nos.' label vertically
        if (maxGroups > 1) {
            worksheet.mergeCells(`A${groupStartRow}:A${worksheet.rowCount}`);
            const mergedGroupCell = worksheet.getCell(`A${groupStartRow}`);
            mergedGroupCell.alignment = centerAlignment;
            mergedGroupCell.font = { bold: true };
            mergedGroupCell.border = borderStyle;
        } else if (maxGroups === 1) {
            const cell = worksheet.getCell(`A${groupStartRow}`);
            cell.alignment = centerAlignment;
            cell.font = { bold: true };
            cell.border = borderStyle;
        }

        // Apply borders to all the group number cells (outline of the entire block per column)
        for (let col = 2; col <= panels.length + 1; col++) {
            for (let r = groupStartRow; r < groupStartRow + maxGroups; r++) {
                // The image shows inner borders are typically absent or very light between numbers.
                // We apply borders on the outside of the columns
                const cell = worksheet.getCell(r, col);
                cell.border = {
                    left: { style: 'thin' },
                    right: { style: 'thin' },
                    // Add bottom border only to the last row of groups
                    ...(r === groupStartRow + maxGroups - 1 ? { bottom: { style: 'thin' } } : {})
                };
            }
        }

        // Add venue row at the end mimicking the picture
        if (maxGroups > 0) {
            const venueRowValues: any = { label: 'Venue' };
            panels.forEach((p: any, i: number) => {
                venueRowValues[`panel_${i}`] = p.room || `Room no. 30${i + 4}`;
            });
            const venueRow = worksheet.addRow(venueRowValues);
            venueRow.font = { bold: true, color: { argb: 'FF0000FF' } }; // Blue text for venue rooms
            venueRow.alignment = centerAlignment;

            // Customize Label 'Venue' color to red if needed
            venueRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' } };

            venueRow.eachCell((cell) => {
                cell.border = borderStyle;
            });
        }

        // --- NEW: Add individual panel sheets ---
        panels.forEach((p: any, pIndex: number) => {
            const pSheet = workbook.addWorksheet(`Panel ${pIndex + 1}`);
            const pGroups = panelGroupsArray[pIndex] || [];

            const facultyWithCounts = p.faculty.map((f: any) => {
                const count = pGroups.filter((g: any) => {
                    const projFacId = typeof g.project?.faculty === 'string' ? g.project.faculty : (g.project?.faculty?._id?.toString() || null);
                    return projFacId === f._id.toString();
                }).length;
                return { ...f, groupCount: count };
            });

            let chairId = null;
            if (facultyWithCounts.length > 0) {
                const maxLoad = Math.max(...facultyWithCounts.map((f: any) => f.groupCount));
                chairId = facultyWithCounts.find((f: any) => f.groupCount === maxLoad)?._id.toString();
            }

            p.faculty.forEach((f: any) => {
                f.isChair = f._id.toString() === chairId;
            });

            const panelMembersString = `Panel Members -: ` + p.faculty.map((f: any) => f.isChair ? `${f.name} (Chair)` : f.name).join(', ');

            // Setup Columns for individual panel sheet
            pSheet.columns = [
                { width: 3 }, // Spacer
                { width: 10 }, // Group No.
                { width: 25 }, // Student's name
                { width: 15 }, // Roll no.
                { width: 15 }, // Department
                { width: 40 }, // Title of the Project
                { width: 25 }, // Supervisor Name
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 20 }, // Mid term
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 20 }, // End term
                { width: 10 }, // Total
                { width: 10 }  // Grade
            ];

            // Rows 1-4: Title and Institute Info
            pSheet.addRow([
                null,
                'Dr. SPM International Institute of Information Technology, Naya Raipur',
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
            ]);
            pSheet.addRow([
                null,
                '(A Joint Initiative of Govt. of Chhattisgarh and NTPC)',
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
            ]);
            pSheet.addRow([
                null,
                'Email: iiitnr@iiitnr.ac.in, Tel: (0771) 2474040, Web: www.iiitnr.ac.in',
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
            ]);

            // Calculate semester based on batch year and current date
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth(); // 0 is Jan, 11 is Dec
            const yearDiff = currentYear - p.batchYear;
            let semCount = yearDiff * 2;
            // If current month is July or later, they have started the next academic year
            if (currentMonth >= 6) semCount += 1;
            if (semCount < 1) semCount = 1;

            const romanSems = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
            const semStr = romanSems[semCount - 1] || `${semCount}th`;

            pSheet.addRow([
                null,
                `MINOR PROJECT EVALUATION- B.Tech. ${semStr} SEM`,
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
            ]);

            // Merge and stylize headers
            for (let i = 1; i <= 4; i++) {
                pSheet.mergeCells(`B${i}:Q${i}`);
                const cell = pSheet.getCell(`B${i}`);
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (i === 1) cell.font = { bold: true, size: 14, color: { argb: 'FF0070C0' } };
                else if (i === 4) cell.font = { bold: true, size: 12, underline: true };
                else cell.font = { size: 11 };
            }

            pSheet.addRow([]);

            // Row 6: Panel No & Members
            pSheet.addRow([
                null,
                `Panel No.- ${pIndex + 1}`, '', '',
                panelMembersString, '', '', '', '', '', '', '', '', '', '', '', ''
            ]);
            pSheet.mergeCells('B6:D6');
            pSheet.mergeCells('E6:Q6');

            for (let col = 2; col <= 17; col++) {
                const cell = pSheet.getCell(6, col);
                cell.font = { bold: true, color: { argb: 'FF000000' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF9BC2E6' } // Light blue
                };
                cell.border = borderStyle;
            }

            // Row 7 & 8: Headers
            const headerRow1 = pSheet.addRow([
                null,
                'Group No.', 'Student\'s name', 'Roll no.', 'Department', 'Title of the Project', 'Supervisor Name',
                'MID-TERM (15+15)', '', '', 'Average Marks (30) Guide+(E1 +E2)/2',
                'END-TERM (35+35)', '', '', 'Average Marks (70) Guide+(E1 +E2)/2',
                'Total (100)', 'Grade'
            ]);

            const headerRow2 = pSheet.addRow([
                null,
                '', '', '', '', '', '',
                'E1 (15)', 'E2 (15)', 'Guide (15)', '',
                'E1 (35)', 'E2 (35)', 'Guide (35)', '',
                '', ''
            ]);

            // Merge header rows
            const commonFields = ['B', 'C', 'D', 'E', 'F', 'G', 'K', 'O', 'P', 'Q'];
            commonFields.forEach(col => pSheet.mergeCells(`${col}7:${col}8`));
            pSheet.mergeCells('H7:J7'); // Mid-Term
            pSheet.mergeCells('L7:N7'); // End-Term

            // Style headers
            [headerRow1, headerRow2].forEach(row => {
                row.font = { bold: true };
                row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                row.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
                        cell.border = borderStyle;

                        let bgColor = 'FFED7D31'; // Default Orange pattern
                        // Column 11 is K (Average 30) Column 15 is O (Average 70)
                        if (colNumber === 11 || colNumber === 15) {
                            bgColor = 'FFFFF2CC'; // Pale yellow for averages
                        }

                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: bgColor }
                        };
                    }
                });
            });

            // Data Rows
            pGroups.forEach((g: any) => {
                const members = g.members || [];
                const projTitle = g.project?.title || 'TBD';
                const facName = typeof g.project?.faculty === 'string' ? 'Unknown' : g.project?.faculty?.name || 'Unknown';
                const groupNo = g.name || '';

                if (members.length === 0) {
                    const row = pSheet.addRow([null, groupNo, '', '', '', projTitle, facName, '', '', '', '', '', '', '', '', '', '']);
                    row.eachCell((cell, colNum) => { if (colNum > 1) cell.border = borderStyle; });
                    return;
                }

                members.forEach((m: any, mIdx: number) => {
                    const getBranchFromRollNo = (rollNo: any) => {
                        if (!rollNo) return '';
                        const rollStr = String(rollNo);
                        if (rollStr.length >= 5) {
                            const code = rollStr.charAt(4);
                            if (code === '0') return 'CSE';
                            if (code === '1') return 'ECE';
                            if (code === '2') return 'DSAI';
                        }
                        return '';
                    };

                    const row = pSheet.addRow([
                        null,
                        mIdx === 0 ? groupNo : '',
                        m.name || '',
                        m.rollNumber || '',
                        m.branch || m.department || getBranchFromRollNo(m.rollNumber) || '',
                        mIdx === 0 ? projTitle : '',
                        mIdx === 0 ? facName : '',
                        '', '', '', '', '', '', '', '', '', ''
                    ]);

                    row.eachCell((cell, colNum) => {
                        if (colNum > 1) cell.border = borderStyle;
                    });
                });
            });

            pSheet.addRow([]);

            // Signatures
            pSheet.addRow([]); // margin

            const sigHeaderRow = pSheet.addRow([
                null,
                'Evaluation Board Member', '', 'Signature', '',
                '', '', '', '', '', '', '', '', '', '', '', ''
            ]);
            pSheet.mergeCells(`B${sigHeaderRow.number}:C${sigHeaderRow.number}`);
            pSheet.mergeCells(`D${sigHeaderRow.number}:E${sigHeaderRow.number}`);
            sigHeaderRow.font = { bold: true, size: 11 };
            sigHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
            ['B', 'C', 'D', 'E'].forEach(col => {
                const cell = pSheet.getCell(`${col}${sigHeaderRow.number}`);
                cell.border = borderStyle;
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9E1F2' }
                };
            });

            p.faculty.forEach((fac: any) => {
                const sigRow = pSheet.addRow([
                    null,
                    fac.isChair ? `${fac.name} (Chair)` : fac.name, '', '', '',
                    '', '', '', '', '', '', '', '', '', '', '', ''
                ]);
                pSheet.mergeCells(`B${sigRow.number}:C${sigRow.number}`);
                pSheet.mergeCells(`D${sigRow.number}:E${sigRow.number}`);

                sigRow.height = 30; // giving space for physical signature
                sigRow.alignment = { vertical: 'middle' };

                ['B', 'C', 'D', 'E'].forEach(col => {
                    const cell = pSheet.getCell(`${col}${sigRow.number}`);
                    cell.border = borderStyle;
                });
            });
        });
        // --- END NEW ---

        const buffer = await workbook.xlsx.writeBuffer();

        res.set('Content-Disposition', `attachment; filename=panels_export_${batchYear || 'All'}.xlsx`);
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
        mid.guide.forEach(f => cols.push({ ...f, section: 'guide',  evalT: 'mid-term', headerLabel: `[${pMid}Guide] ${f.label} (0-${f.max})`, bgArgb: 'FFD6E4F7' }));
        mid.panel.forEach(f => cols.push({ ...f, section: 'panel1', evalT: 'mid-term', headerLabel: `[${pMid}E1] ${f.label} (0-${f.max})`,    bgArgb: 'FFD6F5D6' }));
        mid.panel.forEach(f => cols.push({ ...f, section: 'panel2', evalT: 'mid-term', headerLabel: `[${pMid}E2] ${f.label} (0-${f.max})`,    bgArgb: 'FFFCE4D6' }));
        if (evalType === 'end-term') {
            end.guide.forEach(f => cols.push({ ...f, section: 'guide',  evalT: 'end-term', headerLabel: `[End-Guide] ${f.label} (0-${f.max})`, bgArgb: 'FFBDD7EE' }));
            end.panel.forEach(f => cols.push({ ...f, section: 'panel1', evalT: 'end-term', headerLabel: `[End-E1] ${f.label} (0-${f.max})`,    bgArgb: 'FFB8F2B8' }));
            end.panel.forEach(f => cols.push({ ...f, section: 'panel2', evalT: 'end-term', headerLabel: `[End-E2] ${f.label} (0-${f.max})`,    bgArgb: 'FFFACDB0' }));
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
            const superLabels = [ '', '', '', '', '', '', '', '' ];
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

        const superLabels = [ '', '', '', '', '' ];
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
                }

                const grand = (midSE ? midTotal : 0) + (endSE ? endTotal : 0);
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

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Sheet1');

        // ── Column widths from reference file (bumped up ~20% for readability) ─
        // Col D has no custom width in source (uses Excel default ~8.43)
        ws.columns = [
            { width: 9    }, // A – K (serial)
            { width: 28   }, // B – Project Group Members Name
            { width: 20   }, // C – Roll No
            { width: 12   }, // D – Department
            { width: 34   }, // E – Title of the Minor Project
            { width: 27   }, // F – Area of Project
            { width: 30   }, // G – Name of the Supervisor
        ];

        // ── Exact header background: #A4C2F4 ─────────────────────────────────────
        const HEADER_BG   = 'FFA4C2F4';  // exact color from reference file
        const GREY_BG     = 'FF999999';  // even group rows
        // Odd groups have no fill (patternType: none) = default white

        const thinBorder: Partial<ExcelJS.Borders> = {
            top:    { style: 'thin' },
            left:   { style: 'thin' },
            bottom: { style: 'thin' },
            right:  { style: 'thin' },
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
            cell.font      = { bold: true, size: 11 };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
            cell.border    = thinBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        // ── Data rows ─────────────────────────────────────────────────────────────
        let currentExcelRow = 2; // data starts at row 2 (header is row 1)

        filteredGroups.forEach((g: any, gIdx: number) => {
            const project    = g.project;
            const members    = (g.members || []) as any[];
            const title      = project?.title || '';
            const area       = (project?.tags || []).join(', ');
            const supervisor = project?.faculty?.name || '';
            const memberCount = members.length;

            // Even groups (gIdx 1, 3, 5... i.e. 2nd, 4th, 6th group) get grey bg
            // Odd groups (gIdx 0, 2, 4... i.e. 1st, 3rd, 5th) get no fill
            const isEvenGroup = (gIdx + 1) % 2 === 0; // gIdx is 0-based

            members.forEach((m: any, mIdx: number) => {
                const isFirst = mIdx === 0;
                const dept    = m.branch || m.department || '';

                // For non-first members: E, F, G cells are empty (they'll be covered by merge)
                const rowData: any[] = [
                    isFirst ? (gIdx + 1) : '',   // A – serial only on first row
                    m.name       || '',            // B – always filled
                    m.rollNumber || '',            // C – always filled
                    dept,                          // D – always filled
                    isFirst ? title      : '',     // E – filled only on first row
                    isFirst ? area       : '',     // F – filled only on first row
                    isFirst ? supervisor : '',     // G – filled only on first row
                ];

                const dataRow = ws.addRow(rowData);
                dataRow.height = 24;

                dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
                    cell.border = thinBorder;

                    // Vertical alignment for all, wrap text for Title/Area/Supervisor
                    cell.alignment = {
                        horizontal: colNum === 1 ? 'center' : 'left',
                        vertical:   colNum >= 5  ? 'top'   : 'middle',
                        wrapText:   colNum >= 5,
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
                const lastMemberRow  = currentExcelRow - 1;

                // Merge E, F, G columns
                ['E', 'F', 'G'].forEach(col => {
                    ws.mergeCells(`${col}${firstMemberRow}:${col}${lastMemberRow}`);
                    // Re-apply styling to the merged cell (top-left cell holds the value)
                    const mergedCell = ws.getCell(`${col}${firstMemberRow}`);
                    mergedCell.border    = thinBorder;
                    mergedCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
                    if (isEvenGroup) {
                        mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } };
                    }
                });
            }
        });

        const buffer   = await workbook.xlsx.writeBuffer();
        const acadEnd  = Number(batchYear) + 4;
        const fileName = `MINOR_Project_Batch_${batchYear}-${acadEnd}.xlsx`;

        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error: any) {
        console.error('Official format export failed:', error);
        res.status(500).json({ message: 'Error exporting official format', error: error.message });
    }
};
