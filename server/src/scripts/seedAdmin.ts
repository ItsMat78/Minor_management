import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedAdmin = async () => {
    const provided = process.env.ADMIN_SETUP_SECRET;
    const expected = process.env.ADMIN_SETUP_SECRET_VALUE;

    if (!provided || !expected || provided !== expected) {
        console.error('❌ ADMIN_SETUP_SECRET is missing or incorrect. Aborting.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor-management');

    const email = process.env.ADMIN_EMAIL || 'admin@iiitnr.edu.in';
    const password = process.env.ADMIN_PASSWORD || 'changeme';

    const exists = await User.findOne({ email });
    if (exists) {
        console.error(`❌ A user with email ${email} already exists. Aborting.`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({
        name: 'Administrator',
        email,
        password: hashed,
        role: 'Admin',
        isVerified: true,
        isActive: true,
        mustChangePassword: true,
    });

    console.log(`✓ Admin created — email: ${email}  password: ${password}`);
    console.log('  ⚠ Delete this script now that it has been used.');
    await mongoose.disconnect();
    process.exit(0);
};

seedAdmin().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
