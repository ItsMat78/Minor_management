import { Request, Response } from 'express';
import Panel, { IPanel } from '../models/Panel';
import Group from '../models/Group';
import Project from '../models/Project';
import User from '../models/User';
import ExcelJS from 'exceljs';
import { sendPanelAssignmentEmail } from '../utils/emailService';
export const exportEvaluations = async (req: any, res: Response) => {
    try {
        const { batchYear, evalType } = req.query; // evalType: 'midterm' or 'full'

        // Get all groups and filter by batch
        const allGroups = await Group.find({ status: { $in: ['Approved', 'Assigned', 'Pending'] }, isArchived: { $ne: true } })
            .populate('members', 'name rollNumber branch department')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email _id' }
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

        // Data Population
        filteredGroups.forEach((g: any, gIdx: number) => {
            const project = g.project;
            const members = g.members || [];
            const midEval = project?.midTermEvaluation;
            const endEval = project?.endTermEvaluation;

            // Extract Mid-term marks
            // The data model stores a single panel score (not per-evaluator).
            // E1 holds that score; E2 is left blank to avoid duplicating the same value.
            let midE1 = '', midE2 = '', midGuide = '', midAvg = '';
            if (midEval) {
                midGuide = String((midEval.guide?.dataElicitation || 0) + (midEval.guide?.problemDefinition || 0) + (midEval.guide?.planning || 0));
                const midPanelSum = (midEval.panel?.literatureSurvey || 0) + (midEval.panel?.presentationSkills || 0) + (midEval.panel?.technicalUnderstanding || 0);
                midE1 = String(midPanelSum);
                midE2 = '';
                midAvg = String(Number(midGuide) + midPanelSum);
            }

            // Extract End-term marks
            let endE1 = '', endE2 = '', endGuide = '', endAvg = '';
            if (endEval && evalType === 'full') {
                endGuide = String((endEval.guide?.requirementSpecification || 0) + (endEval.guide?.systemDesign || 0) + (endEval.guide?.implementation || 0) + (endEval.guide?.projectManagement || 0) + (endEval.guide?.planningVsExecution || 0));
                const endPanelSum = (endEval.panel?.testingAndResults || 0) + (endEval.panel?.innovationAndRelevance || 0) + (endEval.panel?.presentationAndViva || 0) + (endEval.panel?.conceptualDepth || 0);
                endE1 = String(endPanelSum);
                endE2 = '';
                endAvg = String(Number(endGuide) + endPanelSum);
            }

            const total = evalType === 'full' ? (Number(midAvg || 0) + Number(endAvg || 0)) : 0;
            const grade = (evalType === 'full' && (midEval || endEval)) ? calculateGrade(total) : '';

            members.forEach((m: any, mIdx: number) => {
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
        const { faculty, batchYear } = req.body;
        if (!faculty || !batchYear) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const newPanel = new Panel({ faculty, batchYear });
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
        const { faculty, batchYear } = req.body;

        if (!faculty || !batchYear) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const updatedPanel = await Panel.findByIdAndUpdate(
            panelId,
            { faculty, batchYear },
            { new: true }
        ).populate('faculty', 'name email department maxGroups currentGroups');

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
        const { batchYear } = req.query;
        let query: any = {};
        if (batchYear && batchYear !== 'All') query.batchYear = Number(batchYear);
        const panels = await Panel.find(query).populate('faculty', 'name email department maxGroups currentGroups').lean();

        // Populate groups for each panel based on faculty
        const panelsWithGroups = await Promise.all(panels.map(async (panel: any) => {
            const panelFacultyIds = panel.faculty.map((f: any) => f._id.toString());
            const groups = await Group.find({ status: { $in: ['Approved', 'Assigned', 'Forming', 'Pending'] }, isArchived: { $ne: true } })
                .populate('members', 'name rollNumber email branch')
                .populate({ path: 'project', populate: { path: 'faculty', select: 'name email' } })
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

        let panelQuery: any = { faculty: facultyId };
        if (batchYear && batchYear !== 'All') panelQuery.batchYear = Number(batchYear);

        const panels = await Panel.find(panelQuery).populate('faculty', 'name email');

        const result = [];
        for (const panel of panels) {
            const panelFacultyIds = panel.faculty.map(f => f._id.toString());

            // Get all groups allocated to these faculty members, specifically those with approved projects
            const groups = await Group.find({
                status: { $in: ['Approved', 'Assigned', 'Forming', 'Pending'] },
                isArchived: { $ne: true }
            }).populate('members', 'name rollNumber email branch')
                .populate({
                    path: 'project',
                    populate: { path: 'faculty', select: 'name email' }
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

            result.push({
                panel,
                groups: panelGroups
            });
        }
        res.status(200).json(result);

    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching panel groups', error: error.message });
    }
};

export const exportPanels = async (req: any, res: Response) => {
    try {
        const { batchYear } = req.query;

        let query: any = {};
        if (batchYear && batchYear !== 'All') {
            query.batchYear = Number(batchYear);
        }

        const panels = await Panel.find(query).populate('faculty', 'name email').lean();

        // Get groups similarly, but cache groups
        const groups = await Group.find({ status: { $in: ['Approved', 'Assigned', 'Pending'] }, isArchived: { $ne: true } })
            .populate('members', 'name rollNumber')
            .populate({
                path: 'project',
                populate: { path: 'faculty', select: 'name email _id' }
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
                venueRowValues[`panel_${i}`] = `Room no. 30${i + 4}`; // Placeholder slightly varied
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
