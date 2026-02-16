import mongoose from 'mongoose';
import User from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor-project-portal');
        console.log('Connected to MongoDB');

        const totalUsers = await User.countDocuments();
        console.log(`Total users: ${totalUsers}`);

        const faculty = await User.find({ role: 'Faculty' }).limit(5);
        console.log('Sample Faculty:');
        faculty.forEach(f => console.log(`${f.email} - ${f.name}`));

        const students = await User.find({ role: 'Student' }).limit(5);
        console.log('Sample Students:');
        students.forEach(s => console.log(`${s.email} - ${s.name}`));

        mongoose.connection.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkUsers();
