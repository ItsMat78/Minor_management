import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { UserRole } from '../models/User';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/minor_management';

const markStudentsInactive = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await User.updateMany(
            { role: UserRole.STUDENT },
            { $set: { isActive: false } }
        );

        console.log(`Successfully marked ${result.modifiedCount} students as inactive out of ${result.matchedCount} found.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

markStudentsInactive();
