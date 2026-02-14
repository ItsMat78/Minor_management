
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { UserRole } from '../models/User';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management';

const promoteUserToAdmin = async (email: string) => {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email ${email} not found.`);
            process.exit(1);
        }

        user.role = UserRole.ADMIN;
        await user.save();

        console.log(`Success! User ${user.name} (${user.email}) is now an ADMIN.`);
    } catch (error) {
        console.error('Error updating user role:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

const email = process.argv[2];

if (!email) {
    console.error('Please provide an email address as an argument.');
    console.error('Usage: npx ts-node src/scripts/promoteToAdmin.ts <email>');
    process.exit(1);
}

promoteUserToAdmin(email);
