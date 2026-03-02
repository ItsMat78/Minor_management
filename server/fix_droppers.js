const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/minor_management').then(async () => {
    const db = mongoose.connection.db;

    // fix Akash Sahu -> 2023
    const akash = await db.collection('users').findOne({ name: { $regex: /akash sahu/i } });
    if (akash) {
        const akashGroup = await db.collection('groups').findOne({ members: akash._id });
        if (akashGroup) {
            await db.collection('groups').updateOne({ _id: akashGroup._id }, { $set: { targetBatch: '2023' } });
            console.log('Fixed Akash Sahu -> targetBatch: 2023');
        } else {
            console.log('Akash Sahu group not found');
        }
    } else {
        console.log('Akash Sahu not found');
    }

    // fix Tanmay Chauhn -> 2024
    const tanmay = await db.collection('users').findOne({ name: { $regex: /tanmay/i } });
    if (tanmay) {
        const tanmayGroup = await db.collection('groups').findOne({ members: tanmay._id });
        if (tanmayGroup) {
            await db.collection('groups').updateOne({ _id: tanmayGroup._id }, { $set: { targetBatch: '2024' } });
            console.log('Fixed Tanmay Chauhn -> targetBatch: 2024');
        } else {
            console.log('Tanmay Chauhn group not found');
        }
    } else {
        console.log('Tanmay Chauhn not found');
    }

    process.exit(0);
}).catch(console.error);
