
import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// List of faculty to auto-register
const FacultyList = [
    { name: 'Dr. Srinivasa K G', email: 'srinivasa@iiitnr.edu.in', department: 'DSAI', role: 'Faculty' },
    { name: 'Dr. Vijaya J', email: 'vijaya@iiitnr.edu.in', department: 'DSAI', role: 'Faculty' },
    { name: 'Dr. Vinay Kumar', email: 'vinay@iiitnr.edu.in', department: 'CSE', role: 'Faculty' },
    { name: 'Dr. Sresha Yadav', email: 'sresha@iiitnr.edu.in', department: 'Full Stack', role: 'Faculty' }, // Updated department based on context or leave generic
    { name: 'Dr. Abhishek Sharma', email: 'abhishek@iiitnr.edu.in', department: 'ECE', role: 'Faculty' },
    { name: 'Dr. Amit Kumar Agrawal', email: 'amit@iiitnr.edu.in', department: 'Management', role: 'Faculty' },
    { name: 'Dr. Anurag Singh', email: 'anurag@iiitnr.edu.in', department: 'ECE', role: 'Faculty' },
    { name: 'Dr. Kavita Jaiswal', email: 'kavita@iiitnr.edu.in', department: 'CSE', role: 'Faculty' },
    { name: 'Dr. Lakhindar Murmu', email: 'lakhindar@iiitnr.edu.in', department: 'ECE', role: 'Faculty' },
    { name: 'Dr. Manoj Kumar Majumder', email: 'manoj@iiitnr.edu.in', department: 'ECE', role: 'Faculty' },
    { name: 'Ms. Shashi Tiwari', email: 'shashi@iiitnr.edu.in', department: 'ECE', role: 'Faculty' },
    { name: 'Dr. Sachchida Nand Mishra', email: 'sachchida@iiitnr.edu.in', department: 'DSAI', role: 'Faculty' }
];

const seedFaculty = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management');
        console.log('MongoDB Connected');

        for (const faculty of FacultyList) {
            const existingUser = await User.findOne({ email: faculty.email });
            if (existingUser) {
                console.log(`Faculty ${faculty.name} already exists.`);
                continue;
            }

            const hashedPassword = await bcrypt.hash('faculty123', 10); // Default password

            const newFaculty = new User({
                name: faculty.name,
                email: faculty.email,
                password: hashedPassword,
                role: UserRole.FACULTY,
                department: faculty.department,
                isVerified: true,
                expertise: [] // Can be filled later
            });

            await newFaculty.save();
            console.log(`Registered ${faculty.name}`);
        }

        console.log('Faculty seeding completed.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding faculty:', error);
        process.exit(1);
    }
};

seedFaculty();
