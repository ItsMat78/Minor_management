const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

const UserSchema = new mongoose.Schema({ rollNumber: { type: String } }, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: { type: String }, domain: { type: String } }, { strict: false });
const GroupSchema = new mongoose.Schema({ members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' } }, { strict: false });

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Group = mongoose.model('Group', GroupSchema);

const files = [
    '../MINOR Project-II (IV Semester)_2025-2026.xlsx',
    '../UG Research Work-I (VI Semester)_2025-2026.xlsx'
];

// Reverting to the simpler auto-capitalize which preserves existing uppercase letters (useful for acronyms like AI, RL)
// It will only change the first character of each word to uppercase.
function autoCapitalize(str) {
    if (!str || typeof str !== 'string') return str;
    // Split on whitespace to handle words properly, then capitalize first letter, keep rest as is
    return str.replace(/\b\w/g, char => char.toUpperCase()).replace(/\s+/g, ' ').trim();
}

async function start() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(DB_URI);
        console.log('Connected to MongoDB.');

        const updatedProjects = new Set();
        let notFoundUsers = 0;
        let notFoundGroups = 0;
        let notFoundProjects = 0;

        for (const file of files) {
            console.log(`Processing file: ${file}`);
            const filePath = path.resolve(__dirname, file);
            let wb;
            try {
                wb = xlsx.readFile(filePath);
            } catch (err) {
                console.error(`Failed to read ${file}:`, err.message);
                continue;
            }

            const sheet = wb.Sheets[wb.SheetNames[0]];
            const records = xlsx.utils.sheet_to_json(sheet, { defval: null });

            for (const row of records) {
                const rollNo = row['Roll No'] || row['Roll no'] || row['roll no'];
                let title = row['Title of the Minor Project'] || row['title'] || row['Title'];
                let domain = row['Area of Project'] || row['Area'] || row['domain'] || row['Area of interest'];

                if (!rollNo || (!title && !domain)) continue;

                const stringRoll = String(rollNo).trim();
                const formattedTitle = autoCapitalize(title);
                const formattedDomain = autoCapitalize(domain);

                const user = await User.findOne({ rollNumber: stringRoll });
                if (!user) {
                    notFoundUsers++;
                    continue;
                }

                const group = await Group.findOne({ members: user._id });
                if (!group) {
                    notFoundGroups++;
                    continue;
                }

                if (!group.project) {
                    notFoundProjects++;
                    continue;
                }

                const projIdStr = group.project.toString();
                if (updatedProjects.has(projIdStr)) {
                    continue;
                }

                const updatePayload = {};
                // Overwrite the previous run correctly
                if (formattedTitle) updatePayload.title = formattedTitle;
                if (formattedDomain) updatePayload.domain = formattedDomain;

                await Project.findByIdAndUpdate(group.project, { $set: updatePayload });
                console.log(`Updated Project ${projIdStr} (Roll: ${stringRoll}): Title="${formattedTitle}" | Domain="${formattedDomain}"`);
                updatedProjects.add(projIdStr);
            }
        }

        console.log(`\nFinished! Updated ${updatedProjects.size} unique projects.`);
        console.log(`Stats (skipped rows due to missing DB associations): Users: ${notFoundUsers}, Groups: ${notFoundGroups}, Projects: ${notFoundProjects}`);
    } catch (e) {
        console.error('Error during update:', e);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

start();
