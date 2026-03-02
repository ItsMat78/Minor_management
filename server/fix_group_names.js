const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/minor_management').then(async () => {
    const db = mongoose.connection.db;
    const groups = await db.collection('groups').find({ name: /UG Research Group / }).toArray();
    for (const g of groups) {
        const newName = g.name.replace('UG Research Group ', '');
        await db.collection('groups').updateOne({ _id: g._id }, { $set: { name: newName } });
    }
    console.log(`Updated ${groups.length} groups`);
    process.exit(0);
});
