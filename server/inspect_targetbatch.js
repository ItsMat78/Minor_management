const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/minor_management').then(async () => {
    const db = mongoose.connection.db;
    const groups = await db.collection('groups').find({ targetBatch: { $exists: true } }).toArray();
    console.log(JSON.stringify(groups, null, 2));
    process.exit(0);
});
