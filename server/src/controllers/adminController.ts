import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import bcrypt from 'bcryptjs';

export const getStats = async (req: Request, res: Response) => {
    try {
        const totalStudents = await User.countDocuments({ role: UserRole.STUDENT });
        const totalFaculty = await User.countDocuments({ role: UserRole.FACULTY });
        const totalGroups = await Group.countDocuments({ isArchived: { $ne: true } });
        const totalProjects = await Project.countDocuments({ isArchived: { $ne: true } });
        
        // 1. Number of ungrouped students
        const groupedStudentIds = await Group.distinct('members', { isArchived: { $ne: true } });
        const ungroupedStudents = await User.countDocuments({ 
            role: UserRole.STUDENT, 
            _id: { $nin: groupedStudentIds } 
        });

        // 2. Number of unactivated/activated accounts (verification status)
        const unactivatedAccounts = await User.countDocuments({ isVerified: false });
        const activatedAccounts = await User.countDocuments({ isVerified: true });

        // Group status breakdown
        const [forming, proposalPending, approved, assigned] = await Promise.all([
            Group.countDocuments({ status: 'Forming', isArchived: { $ne: true } }),
            Group.countDocuments({ status: 'ProposalPending', isArchived: { $ne: true } }),
            Group.countDocuments({ status: 'Approved', isArchived: { $ne: true } }),
            Group.countDocuments({ status: 'Assigned', isArchived: { $ne: true } }),
        ]);

        res.json({
            students: totalStudents,
            faculty: totalFaculty,
            groups: totalGroups,
            projects: totalProjects,
            ungroupedStudents,
            unactivatedAccounts,
            activatedAccounts,
            groupsByStatus: {
                Forming: forming,
                ProposalPending: proposalPending,
                Approved: approved,
                Assigned: assigned,
            },
            // legacy shape preserved
            breakdown: { forming, approved }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const { name, email, role, rollNumber, branch, semester, department, expertise } = req.body;
        if (!name || !email || !role) {
            return res.status(400).json({ message: 'name, email, and role are required.' });
        }
        if (!['Student', 'Faculty'].includes(role)) {
            return res.status(400).json({ message: 'role must be Student or Faculty.' });
        }
        if (role === 'Student' && !rollNumber) {
            return res.status(400).json({ message: 'rollNumber is required for students.' });
        }

        const existing = await User.findOne({ $or: [{ email }, ...(rollNumber ? [{ rollNumber }] : [])] });
        if (existing) {
            return res.status(400).json({ message: 'A user with that email or roll number already exists.' });
        }

        const defaultPassword = await bcrypt.hash('changeme', 10);

        const newUser = new User({
            name,
            email,
            password: defaultPassword,
            role,
            rollNumber:  role === 'Student' ? rollNumber : undefined,
            branch:      role === 'Student' ? (branch || 'CSE') : undefined,
            semester:    role === 'Student' ? (Number(semester) || undefined) : undefined,
            department:  role === 'Faculty' ? (department || 'CSE') : undefined,
            expertise:   role === 'Faculty' ? expertise : undefined,
            isVerified:  role === 'Faculty',   // faculty active immediately
            isActive:    role === 'Faculty',
        });

        await newUser.save();

        const userObj = newUser.toObject() as any;
        delete userObj.password;
        res.status(201).json({ message: 'Account created successfully', user: userObj });
    } catch (error: any) {
        const reason = error.code === 11000 ? 'Duplicate email or roll number.' : (error.message || 'Server error');
        res.status(500).json({ message: reason });
    }
};

export const createAdmin = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAdmin = new User({
            name,
            email,
            password: hashedPassword,
            role: UserRole.ADMIN,
            isVerified: true, // Admins auto-verified
        });

        await newAdmin.save();

        const adminObj = newAdmin.toObject() as any;
        delete adminObj.password;

        res.status(201).json({ message: 'Admin account created successfully', admin: adminObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

/**
 * One-time migration: mark all student accounts as inactive (isActive=false).
 * POST /api/admin/mark-students-inactive
 * Auth: admin only
 */
export const markStudentsInactive = async (req: Request, res: Response) => {
    try {
        const result = await User.updateMany(
            { role: UserRole.STUDENT },
            { $set: { isActive: false } }
        );
        res.json({
            message: `Marked ${result.modifiedCount} of ${result.matchedCount} students as inactive.`,
            matched: result.matchedCount,
            modified: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
