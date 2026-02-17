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

        // Get current user to check role and semester
        const currentUserId = (req as any).user.id;
        const currentUser = await User.findById(currentUserId);

        let query: any = { role: UserRole.STUDENT };

        // 1. Filter by Same Year (Semester) if user is a student
        if (currentUser && currentUser.role === UserRole.STUDENT) {
            if (currentUser.semester) {
                query.semester = currentUser.semester;
            }
        }

        // 2. Filter by Branch
        const { branch, status } = req.query;
        if (branch && branch !== 'all') {
            query.branch = branch;
        }

        // Fetch students
        const students = await User.find(query)
            .select('name email rollNumber branch semester _id')
            .sort({ rollNumber: 1 });

        console.log(`Found ${students.length} students matching criteria.`);

        // Find which students are in groups
        const groups = await Group.find({}, 'members');
        const groupedStudentIds = new Set();
        groups.forEach(g => {
            g.members.forEach(m => groupedStudentIds.add(m.toString()));
        });

        let studentsWithStatus = students.map(s => ({
            ...s.toObject(),
            isGrouped: groupedStudentIds.has(s._id.toString())
        }));

        // 3. Filter by Status (Grouped / Available)
        if (status === 'grouped') {
            studentsWithStatus = studentsWithStatus.filter(s => s.isGrouped);
        } else if (status === 'available') {
            studentsWithStatus = studentsWithStatus.filter(s => !s.isGrouped);
        }

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
