const xlsx = require('xlsx');
const path = require('path');
const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';
const FILE_PATH = path.resolve(__dirname, '../UG Research Work-I (VI Semester)_2025-2026.xlsx');

// Mongoose Models
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Student' },
    branch: { type: String },
    rollNumber: { type: String },
    semester: { type: Number },
    isVerified: { type: Boolean, default: false },
    department: { type: String },
    expertise: [{ type: String }]
}, { timestamps: true, strict: false });

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    domain: { type: String, required: true },
    type: { type: String, enum: ['Research', 'Development', 'Hybrid'], default: 'Development' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Open', 'Assigned', 'Completed', 'Closed'], default: 'Open' },
    tags: [{ type: String }],
    requiredSkills: [{ type: String }],
    isArchived: { type: Boolean, default: false }
}, { timestamps: true, strict: false });

const GroupSchema = new mongoose.Schema({
    name: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'Pending' }
}, { timestamps: true, strict: false });

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Group = mongoose.model('Group', GroupSchema);

async function connectDB() {
    try {
        await mongoose.connect(DB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
}

// Generate email helper
const getEmail = (name, role = 'Student', roll = '') => {
    if (role === 'Student' && roll) return String(roll).trim() + '@iiitnr.edu.in';
    const cleanName = (name || 'anonymous').toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.)\s*/, '').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    if (role === 'Student') {
        // use random string for students without roll number
        return `${cleanName}.tmp${Math.floor(Math.random() * 10000)}@iiitnr.edu.in`;
    }
    return cleanName + '@iiitnr.edu.in';
};

async function main() {
    await connectDB();

    try {
        // Delete all old 2023 data first
        console.log('Cleaning up old 2023 data...');
        const users = await User.find({ role: 'Student', $or: [{ semester: 6 }, { rollNumber: { $regex: /^23/ } }] });
        const userIds = users.map(u => u._id);
        const groupsToDelete = await Group.find({ $or: [{ members: { $in: userIds } }, { name: { $regex: /^UG/ } }] });
        const groupIds = groupsToDelete.map(g => g._id);
        const projectsToDelete = await Project.find({ $or: [{ tags: 'VI Semester' }, { _id: { $in: groupsToDelete.map(g => g.project).filter(Boolean) } }] });

        if (userIds.length > 0) await User.deleteMany({ _id: { $in: userIds } });
        if (groupIds.length > 0) await Group.deleteMany({ _id: { $in: groupIds } });
        if (projectsToDelete.length > 0) await Project.deleteMany({ _id: { $in: projectsToDelete.map(p => p._id) } });

        console.log(`Cleaned up ${userIds.length} users, ${groupIds.length} groups, ${projectsToDelete.length} projects.`);

        // Read Excel completely raw to avoid missing any weird rows
        const workbook = xlsx.readFile(FILE_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = xlsx.utils.decode_range(sheet['!ref']);

        let currentGroupId = null;
        let currentMentorName = null;
        let currentProjectTitle = null;
        let currentProjectDomain = null;

        const groups = new Map();

        // Process row by row manually (from row 1, skipping header at 0)
        let totalStudentsFound = 0;
        for (let R = 1; R <= range.e.r; ++R) {
            let colA = sheet[xlsx.utils.encode_cell({ r: R, c: 0 })]; // Group NO (or F)
            let colB = sheet[xlsx.utils.encode_cell({ r: R, c: 1 })]; // Name
            let colC = sheet[xlsx.utils.encode_cell({ r: R, c: 2 })]; // Roll
            let colD = sheet[xlsx.utils.encode_cell({ r: R, c: 3 })]; // Branch
            let colE = sheet[xlsx.utils.encode_cell({ r: R, c: 4 })]; // Title
            let colF = sheet[xlsx.utils.encode_cell({ r: R, c: 5 })]; // Area
            let colG = sheet[xlsx.utils.encode_cell({ r: R, c: 6 })]; // Supervisor

            // Check if A has a group number
            if (colA && colA.v && String(colA.v).trim() !== '' && !String(colA.v).includes('S. No') && !String(colA.v).includes('F')) {
                currentGroupId = String(colA.v).trim();

                if (colG && colG.v) currentMentorName = String(colG.v).trim();
                if (colE && colE.v) currentProjectTitle = String(colE.v).trim();
                if (colF && colF.v) currentProjectDomain = String(colF.v).trim();
            }

            // Student name
            if (colB && colB.v && String(colB.v).trim() !== '' && !String(colB.v).includes('Members Name')) {
                const sName = String(colB.v).trim();
                const sRoll = (colC && colC.v) ? String(colC.v).trim() : null;
                const sBranch = (colD && colD.v) ? String(colD.v).trim() : 'CSE';

                if (!currentGroupId) currentGroupId = 'UNKNOWN'; // Fallback if missing group

                const student = {
                    name: sName,
                    roll: sRoll,
                    branch: sBranch
                };

                if (!groups.has(currentGroupId)) {
                    groups.set(currentGroupId, {
                        id: currentGroupId,
                        members: [],
                        mentorName: currentMentorName || 'Unknown Faculty',
                        projectTitle: currentProjectTitle || 'UG Research Work-I',
                        domain: currentProjectDomain || 'CSE'
                    });
                }

                groups.get(currentGroupId).members.push(student);
                totalStudentsFound++;
            }
        }

        console.log(`Identified ${groups.size} unique groups.`);
        console.log(`Identified ${totalStudentsFound} students.`);

        let defaultFaculty = await User.findOne({ email: 'admin@iiitnr.edu.in' });
        if (!defaultFaculty) {
            const salt = await require('bcryptjs').genSalt(10);
            const adminHash = await require('bcryptjs').hash('adminpassword', salt);
            defaultFaculty = await User.create({
                name: 'System Administrator',
                email: 'admin@iiitnr.edu.in',
                password: adminHash,
                role: 'Admin',
                department: 'Administration',
                isVerified: true
            });
        }

        const facultyCache = new Map();

        for (const [gId, gData] of groups) {
            let mentor = defaultFaculty;
            const mName = gData.mentorName;

            if (mName && mName !== 'Unknown Faculty' && mName !== 'TBD') {
                if (facultyCache.has(mName)) {
                    mentor = facultyCache.get(mName);
                } else {
                    const email = getEmail(mName, 'Faculty');
                    let f = await User.findOne({ email });
                    if (!f) f = await User.findOne({ name: mName, role: 'Faculty' });

                    if (!f) {
                        f = await User.create({
                            name: mName,
                            email: email,
                            password: 'password123',
                            role: 'Faculty',
                            department: 'CSE',
                            isVerified: true
                        });
                        console.log(`Created Faculty: ${mName}`);
                    }
                    facultyCache.set(mName, f);
                    mentor = f;
                }
            }

            let pTitle = gData.projectTitle;
            if (!pTitle || pTitle === 'TBD' || pTitle === 'null') pTitle = `UG Research Group ${gId}`;

            let project = await Project.findOne({ title: pTitle, createdBy: mentor._id });
            if (!project) {
                project = await Project.create({
                    title: pTitle,
                    description: `Project work for Group ${gId} under guidance of ${mentor.name}`,
                    domain: gData.domain || 'CSE',
                    createdBy: mentor._id,
                    status: 'Assigned',
                    tags: ['UG Research', 'VI Semester']
                });
            }

            const memberIds = [];
            for (const s of gData.members) {
                const email = getEmail(s.name, 'Student', s.roll);
                let student = null;
                if (s.roll) {
                    student = await User.findOne({ rollNumber: s.roll });
                }
                if (!student) student = await User.findOne({ email });

                if (!student) {
                    student = await User.create({
                        name: s.name,
                        email: email,
                        password: 'password123',
                        role: 'Student',
                        rollNumber: s.roll || `TEMP_${Math.floor(Math.random() * 100000)}`,
                        branch: s.branch,
                        semester: 6,
                        isVerified: true
                    });
                }
                memberIds.push(student._id);
            }

            await Group.create({
                name: `UG Research Group ${gId}`,
                members: memberIds,
                project: project._id,
                mentor: mentor._id,
                status: 'Approved'
            });
        }

        console.log(`Database population complete! Created ${groups.size} groups with ${totalStudentsFound} members.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
