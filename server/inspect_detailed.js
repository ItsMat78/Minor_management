const mongoose = require('mongoose');
const Group = require('./dist/models/Group').default;

const MONGO_URI = 'mongodb://127.0.0.1:27017/minor_management';

async function checkDetailed() {
    try {
        await mongoose.connect(MONGO_URI);
        const groups = await Group.find({ targetBatch: { $exists: true, $ne: null } }).lean();
        console.log(`Detailed check for ${groups.length} groups.`);
        groups.forEach(g => {
            console.log(`Group: ${g.name}, targetBatch: "${g.targetBatch}" (Type: ${typeof g.targetBatch})`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDetailed();
