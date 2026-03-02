const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

// Mongoose Models
const ProjectSchema = new mongoose.Schema({
    title: { type: String },
    description: { type: String },
    domain: { type: String },
    tags: [{ type: String }],
});

const GroupSchema = new mongoose.Schema({
    name: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
});

const UserSchema = new mongoose.Schema({
    name: { type: String },
    rollNumber: { type: String },
});

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Group = mongoose.model('Group', GroupSchema);

async function main() {
    await mongoose.connect(DB_URI);
    try {
        const groups = await Group.find().populate('members').populate('project').limit(5);
        console.log(JSON.stringify(groups, null, 2));
    } finally {
        await mongoose.disconnect();
    }
}

main();
