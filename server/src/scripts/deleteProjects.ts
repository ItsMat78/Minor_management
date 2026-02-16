import mongoose from 'mongoose';
import Project from '../models/Project';
import Group from '../models/Group';
import User from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const deleteProjects = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor-project-portal');
        console.log('Connected to MongoDB');

        console.log('Deleting all projects...');
        const projectResult = await Project.deleteMany({});
        console.log(`Deleted ${projectResult.deletedCount} projects.`);

        console.log('Updating groups...');
        const groupResult = await Group.updateMany({}, { $unset: { project: "" }, $set: { status: 'Forming' } });
        console.log(`Updated ${groupResult.modifiedCount} groups.`);

        console.log('Resetting faculty stats...');
        const userResult = await User.updateMany({ role: 'Faculty' }, { $set: { currentStudents: 0, currentGroups: 0 } });
        console.log(`Updated ${userResult.modifiedCount} faculty records.`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error deleting projects:', error);
        process.exit(1);
    }
};

deleteProjects();
