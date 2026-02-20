const mongoose = require('mongoose');

async function fix() {
    await mongoose.connect('mongodb://127.0.0.1:27017/minor_management');

    const db = mongoose.connection.db;

    // 1. Update Projects: rename createdBy to faculty, set semester to 6, status to 'Approved'
    const projResult = await db.collection('projects').updateMany(
        { tags: 'UG Research' },
        [
            {
                $set: {
                    faculty: '$createdBy',
                    semester: 6,
                    status: 'Approved'
                }
            }
        ]
    );
    console.log(`Updated ${projResult.modifiedCount} projects.`);

    // 2. Link Group to Project (Project.group)
    const groups = await db.collection('groups').find({ name: /UG Research/ }).toArray();
    let linkedProjects = 0;

    // Also we need to make sure faculty has currentGroups count updated maybe?
    for (const g of groups) {
        if (g.project) {
            await db.collection('projects').updateOne(
                { _id: g.project },
                { $set: { group: g._id } }
            );
            linkedProjects++;
        }
    }
    console.log(`Linked ${linkedProjects} projects to their groups.`);

    // 3. Current groups of faculty might need recalculation if it's stored on user.
    // The previous app has `projectController.ts` or `groupController.ts` which uses these references.

    process.exit(0);
}

fix().catch(console.error);
