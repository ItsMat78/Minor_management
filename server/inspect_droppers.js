const mongoose = require('mongoose');
const Group = require('./dist/models/Group').default;
const User = require('./dist/models/User').default;

const MONGO_URI = 'mongodb://127.0.0.1:27017/minor_management';

async function checkRed() {
    try {
        await mongoose.connect(MONGO_URI);
        const groups = await Group.find({ targetBatch: { $exists: true, $ne: null } }).populate('members');
        groups.forEach(g => {
            const original = g.members && g.members.length > 0 && g.members[0].rollNumber ? '20' + g.members[0].rollNumber.toString().substring(0, 2) : 'Unknown';
            console.log(`Group: ${g.name}, Target: ${g.targetBatch}, Original: ${original}, Red: ${g.targetBatch !== original}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkRed();
