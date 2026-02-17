
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

// Minimal User Schema for insertion
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Student' },
    isVerified: { type: Boolean, default: false }
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
    try {
        await mongoose.connect(DB_URI);
        console.log('Connected to MongoDB');

        const adminEmail = 'admin@iiitnr.edu.in';
        const plainPassword = 'adminpassword';

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        const adminData = {
            name: 'System Administrator',
            email: adminEmail,
            password: hashedPassword,
            role: 'Admin',
            isVerified: true,
            department: 'Administration'
        };

        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('Admin account already exists. Updating password...');
            existingAdmin.password = hashedPassword;
            await existingAdmin.save();
            console.log('Admin password updated to: ' + plainPassword);
        } else {
            console.log('Creating new Admin account...');
            await User.create(adminData);
            console.log('Admin account created.');
            console.log(`Email: ${adminEmail}`);
            console.log(`Password: ${plainPassword}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

createAdmin();
