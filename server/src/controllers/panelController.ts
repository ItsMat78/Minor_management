import { Request, Response } from 'express';
import Panel from '../models/Panel';
import Group from '../models/Group';
import Project from '../models/Project';
import ExcelJS from 'exceljs';
export const createPanel = async (req: any, res: Response) => {
    try {
        const { faculty, batchYear } = req.body;
        if (!faculty || !batchYear) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const newPanel = new Panel({ faculty, batchYear });
        await newPanel.save();
        res.status(201).json(newPanel);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating panel', error: error.message });
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
            const groups = await Group.find({ status: 'Approved' })
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

                const gBatch = g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + g.members[0].rollNumber.substring(0, 2) : 'Unknown';
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
                status: 'Approved'
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

                const gBatch = g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + g.members[0].rollNumber.substring(0, 2) : 'Unknown';
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
        const groups = await Group.find({ status: { $in: ['Approved', 'Assigned', 'Pending'] } })
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

                const gBatch = g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + String(g.members[0].rollNumber).substring(0, 2) : 'Unknown';
                if (gBatch !== String(panel.batchYear)) return false;

                return true;
            });
            panelGroupsArray.push(pGroups);
        });

        // Setup Columns
        const columns = [
            { header: '', key: 'label', width: 15 },
            ...panels.map((p: any, i: number) => ({
                header: `Panel-${i + 1}`,
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

        // Format Header Row (Row 1)
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = centerAlignment;
        headerRow.eachCell((cell) => {
            cell.border = borderStyle;
        });

        // Add Faculty Row (Row 2)
        const facultyRowValues: any = { label: '' };
        panels.forEach((p: any, i: number) => {
            facultyRowValues[`panel_${i}`] = p.faculty.map((f: any) => {
                // Formatting name to roughly mimic Prof. (Dr.) etc if needed, or just append (Chair) optionally.
                return f.name; // Can add logic for Chair later if property exists
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

        const buffer = await workbook.xlsx.writeBuffer();

        res.set('Content-Disposition', `attachment; filename=panels_export_${batchYear || 'All'}.xlsx`);
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error exporting panels', error: error.message });
    }
};
