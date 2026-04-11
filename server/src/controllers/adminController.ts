import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import bcrypt from 'bcryptjs';

export const getStats = async (req: Request, res: Response) => {
    try {
        const totalStudents = await User.countDocuments({ role: UserRole.STUDENT });
        const totalFaculty = await User.countDocuments({ role: UserRole.FACULTY });
        const totalGroups = await Group.countDocuments();
        const totalProjects = await Project.countDocuments();
        
        // 1. Number of ungrouped students
        const groupedStudentIds = await Group.distinct('members');
        const ungroupedStudents = await User.countDocuments({ 
            role: UserRole.STUDENT, 
            _id: { $nin: groupedStudentIds } 
        });

        // 2. Number of unactivated/activated accounts (verification status)
        const unactivatedAccounts = await User.countDocuments({ isVerified: false });
        const activatedAccounts = await User.countDocuments({ isVerified: true });

        // Group status breakdown
        const groupsForming = await Group.countDocuments({ status: 'Forming' });
        const groupsApproved = await Group.countDocuments({ status: 'Approved' });

        res.json({
            students: totalStudents,
            faculty: totalFaculty,
            groups: totalGroups,
            projects: totalProjects,
            ungroupedStudents,
            unactivatedAccounts,
            activatedAccounts,
            breakdown: {
                forming: groupsForming,
                approved: groupsApproved
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
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
