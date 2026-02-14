import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';

export const getStats = async (req: Request, res: Response) => {
    try {
        const totalStudents = await User.countDocuments({ role: UserRole.STUDENT });
        const totalFaculty = await User.countDocuments({ role: UserRole.FACULTY });
        const totalGroups = await Group.countDocuments();
        const totalProjects = await Project.countDocuments();

        // Group status breakdown
        const groupsForming = await Group.countDocuments({ status: 'Forming' });
        const groupsApproved = await Group.countDocuments({ status: 'Approved' });

        res.json({
            students: totalStudents,
            faculty: totalFaculty,
            groups: totalGroups,
            projects: totalProjects,
            breakdown: {
                forming: groupsForming,
                approved: groupsApproved
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
