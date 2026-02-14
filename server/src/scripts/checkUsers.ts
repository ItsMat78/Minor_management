
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management';

const checkStudents = async () => {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const students = await User.find({ role: 'Student' });
        console.log(`Found ${students.length} students:`);
        students.forEach(s => console.log(`- ${s.name} (${s.email}) Role: ${s.role}`));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkStudents();
