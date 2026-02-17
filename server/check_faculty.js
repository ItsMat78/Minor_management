
const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

async function checkFaculty() {
    await mongoose.connect(DB_URI);

    // Find all faculty
    const faculty = await mongoose.connection.db.collection('users').find({ role: 'Faculty' }).toArray();

    console.log(`Found ${faculty.length} faculty members.`);

    const names = {};
    const emails = {};
    const duplicates = [];

    faculty.forEach(f => {
        // Check Name
        if (names[f.name]) {
            duplicates.push({ type: 'Name', value: f.name, ids: [names[f.name]._id, f._id] });
        } else {
            names[f.name] = f;
        }

        // Check Email
        if (emails[f.email]) {
            duplicates.push({ type: 'Email', value: f.email, ids: [emails[f.email]._id, f._id] });
        } else {
            emails[f.email] = f;
        }
    });

    if (duplicates.length > 0) {
        console.log('Duplicates Found:', JSON.stringify(duplicates, null, 2));
    } else {
        console.log('No exact duplicates found.');
        // List specific names to see if distinct variations exist
        console.log('Faculty: ', faculty.map(f => f.name).sort());
    }

    await mongoose.disconnect();
}

checkFaculty();
