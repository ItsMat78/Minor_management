import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import Group from '../models/Group';

export const getFaculty = async (req: Request, res: Response) => {
    try {
        const faculty = await User.find({ role: UserRole.FACULTY })
            .select('name email department expertise currentStudents currentGroups maxStudents maxGroups');
        res.json(faculty);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getAllStudents = async (req: Request, res: Response) => {
    try {
        console.log("Fetching all students...");
        // Fetch all students
        const students = await User.find({ role: UserRole.STUDENT })
            .select('name email rollNumber branch semester _id')
            .sort({ rollNumber: 1 });

        console.log(`Found ${students.length} students.`);

        // Find which students are in groups
        const groups = await Group.find({}, 'members');
        const groupedStudentIds = new Set();
        groups.forEach(g => {
            g.members.forEach(m => groupedStudentIds.add(m.toString()));
        });

        const studentsWithStatus = students.map(s => ({
            ...s.toObject(),
            isGrouped: groupedStudentIds.has(s._id.toString())
        }));

        res.json(studentsWithStatus);
    } catch (error) {
        console.error("Error in getAllStudents:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json(user);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};
