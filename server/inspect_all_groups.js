const mongoose = require('mongoose');
const Group = require('./dist/models/Group').default;
const User = require('./dist/models/User').default;

const MONGO_URI = 'mongodb://127.0.0.1:27017/minor_management';

async function checkAll() {
    try {
        await mongoose.connect(MONGO_URI);
        const groups = await Group.find().populate('members').limit(20);
        groups.forEach(g => {
            console.log(`Group: ${g.name}, targetBatch: ${g.targetBatch} (${typeof g.targetBatch})`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkAll();
