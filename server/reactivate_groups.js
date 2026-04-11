/**
 * reactivate_groups.js
 *
 * Reactivates all archived groups and their projects.
 * Re-links faculty via archivedMentorName → User name lookup.
 * Run: node reactivate_groups.js
 */

const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

const UserSchema = new mongoose.Schema({ name: String, email: String, role: String }, { strict: false });
const ProjectSchema = new mongoose.Schema({
    isArchived: Boolean,
    archivedMentorName: String,
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: String
}, { strict: false });
const GroupSchema = new mongoose.Schema({
    isArchived: Boolean,
    status: String,
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }
}, { strict: false });

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Group = mongoose.model('Group', GroupSchema);

async function main() {
    await mongoose.connect(DB_URI);
    console.log('Connected to', DB_URI);

    // 1. Find all archived projects
    const archivedProjects = await Project.find({ isArchived: true });
    console.log(`Found ${archivedProjects.length} archived projects.`);

    let relinked = 0, notFound = 0, alreadyNull = 0;

    // 2. Build a name→_id map for all faculty
    const facultyUsers = await User.find({ role: 'Faculty' }).select('_id name');
    const nameMap = new Map();
    facultyUsers.forEach(f => nameMap.set(f.name.trim().toLowerCase(), f._id));
    console.log(`Faculty in DB: ${facultyUsers.length}`);

    // 3. Re-link faculty on each archived project
    for (const proj of archivedProjects) {
        const mentorName = proj.archivedMentorName;
        if (!mentorName) {
            alreadyNull++;
            await Project.findByIdAndUpdate(proj._id, { $set: { isArchived: false } });
            continue;
        }
        const facultyId = nameMap.get(mentorName.trim().toLowerCase());
        if (facultyId) {
            await Project.findByIdAndUpdate(proj._id, {
                $set: { isArchived: false, faculty: facultyId }
            });
            relinked++;
        } else {
            console.warn(`  ⚠ Faculty not found for name: "${mentorName}" (project: ${proj._id})`);
            await Project.findByIdAndUpdate(proj._id, { $set: { isArchived: false } });
            notFound++;
        }
    }

    // 4. Reactivate all archived groups
    const groupResult = await Group.updateMany(
        { isArchived: true },
        { $set: { isArchived: false, status: 'Approved' } }
    );

    console.log('\n=== Results ===');
    console.log(`Projects restored:     ${archivedProjects.length}`);
    console.log(`  Faculty re-linked:   ${relinked}`);
    console.log(`  Faculty not found:   ${notFound}`);
    console.log(`  No mentor name:      ${alreadyNull}`);
    console.log(`Groups reactivated:    ${groupResult.modifiedCount}`);

    await mongoose.disconnect();
    console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
