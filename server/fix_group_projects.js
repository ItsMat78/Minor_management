const mongoose = require('mongoose');
const Group = require('./dist/models/Group').default;
const Project = require('./dist/models/Project').default;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

async function fixGroupProjects() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find();
        console.log(`Found ${groups.length} groups to check.`);

        for (const group of groups) {
            // Find an approved project for this group
            const approvedProject = await Project.findOne({ group: group._id, status: 'Approved' });
            
            if (approvedProject) {
                if (!group.project || group.project.toString() !== approvedProject._id.toString()) {
                    console.log(`Fixing Group ${group.name}: Setting project to ${approvedProject._id} (Approved)`);
                    group.project = approvedProject._id;
                    group.status = 'Approved';
                    await group.save();
                }
            } else {
                // Check for pending projects if No approved one exists
                const pendingProject = await Project.findOne({ group: group._id, status: 'Pending' }).sort({ updatedAt: -1 });
                if (pendingProject) {
                    if (!group.project || group.project.toString() !== pendingProject._id.toString()) {
                        console.log(`Fixing Group ${group.name}: Setting project to ${pendingProject._id} (Pending)`);
                        group.project = pendingProject._id;
                        group.status = 'ProposalPending';
                        await group.save();
                    }
                }
            }
        }

        console.log('Fix complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing groups:', error);
        process.exit(1);
    }
}

fixGroupProjects();
