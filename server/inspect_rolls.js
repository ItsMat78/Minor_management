const mongoose = require('mongoose');
const Group = require('./dist/models/Group').default;
const User = require('./dist/models/User').default;

const MONGO_URI = 'mongodb://127.0.0.1:27017/minor_management';

async function checkRolls() {
    try {
        await mongoose.connect(MONGO_URI);
        const groups = await Group.find({ targetBatch: { $exists: true, $ne: null } }).populate('members');
        console.log(`Found ${groups.length} groups with targetBatch.`);
        groups.forEach(g => {
            const roll = g.members && g.members.length > 0 ? g.members[0].rollNumber : 'None';
            const original = roll !== 'None' ? '20' + String(roll).substring(0, 2) : 'Unknown';
            const redCondition = g.targetBatch && g.targetBatch !== original;
            console.log(`Group: ${g.name}, Roll: ${roll}, Calculated Original: ${original}, targetBatch: ${g.targetBatch}, Red: ${redCondition}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkRolls();
