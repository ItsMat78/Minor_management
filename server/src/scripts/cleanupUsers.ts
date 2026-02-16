import mongoose from 'mongoose';
import User from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const cleanup = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const namesToDelete = ['test auth user', 'Tel:-'];

        // Find them first to confirm
        const users = await User.find({
            $or: [
                { name: 'test auth user' },
                { name: { $regex: 'Tel:-', $options: 'i' } }
            ]
        });

        console.log('Found users to delete:', users.map(u => ({ id: u._id, name: u.name, email: u.email })));

        if (users.length > 0) {
            const res = await User.deleteMany({
                _id: { $in: users.map(u => u._id) }
            });
            console.log(`Deleted ${res.deletedCount} users.`);
        } else {
            console.log('No users found matching criteria.');
        }

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
    }
};

cleanup();
