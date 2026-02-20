
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
    expertise: [{ type: String }],
    maxStudents: { type: Number, default: 21 },
    maxGroups: { type: Number, default: 7 },
    currentStudents: { type: Number, default: 0 },
    currentGroups: { type: Number, default: 0 }
}, { timestamps: true });

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
}, { timestamps: true });

const GroupSchema = new mongoose.Schema({
    name: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'Pending' }
}, { timestamps: true });

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
    if (role === 'Student') return roll + '@iiitnr.edu.in';
    return name.toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.)\s*/, '').replace(/\s+/g, '.') + '@iiitnr.edu.in';
};

async function main() {
    await connectDB();

    try {
        const workbook = xlsx.readFile(FILE_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = xlsx.utils.sheet_to_json(sheet, { defval: null });

        console.log(`Read ${records.length} records from Excel.`);

        // Key Finders (Fuzzy)
        const findKey = (row, keywords) => Object.keys(row).find(k => keywords.some(kw => k.toLowerCase() === kw.toLowerCase() || k.toLowerCase().includes(kw.toLowerCase())));
        const specificKey = (row, exact) => Object.keys(row).find(k => k === exact);

        // State for Forward Fill
        let currentGroupId = null;
        let currentMentorName = null;
        let currentProjectTitle = null;
        let currentProjectDomain = null;

        const groups = new Map(); // GroupID -> { id, members: [], mentorName, projectTitle, domain }

        // First Pass: Grouping Logic
        for (let i = 0; i < records.length; i++) {
            const row = records[i];

            // Detect Keys
            // "F" is the S.No key in the new schema
            let keyGroup = specificKey(row, 'F') || findKey(row, ['s. no', 's.no']);
            let keyName = findKey(row, ['name', 'member']);
            let keyRoll = findKey(row, ['roll']);
            let keyBranch = findKey(row, ['department', 'branch']); // Department seems correct
            let keyTitle = findKey(row, ['title', 'project']);
            let keyDomain = findKey(row, ['area', 'domain']);
            let keyMentor = findKey(row, ['supervisor', 'mentor']);

            // Update Context if New Group ID found
            if (keyGroup && row[keyGroup] !== null) {
                currentGroupId = row[keyGroup];

                // Reset/Update Mentor/Project only if explicitly present in this new group row
                // Usually first row has these details
                if (keyMentor && row[keyMentor]) currentMentorName = row[keyMentor];
                if (keyTitle && row[keyTitle]) currentProjectTitle = row[keyTitle];
                if (keyDomain && row[keyDomain]) currentProjectDomain = row[keyDomain];
            }

            // Student Data
            if (currentGroupId && keyName && row[keyName] && keyRoll && row[keyRoll]) {
                const student = {
                    name: row[keyName],
                    roll: String(row[keyRoll]).trim(),
                    branch: (keyBranch && row[keyBranch]) ? row[keyBranch] : 'CSE'
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
            }
        }

        console.log(`Identified ${groups.size} unique groups.`);

        // Second Pass: Database Population

        // Ensure Default Faculty
        // Ensure Default Admin/Faculty Fallback
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

        const facultyCache = new Map(); // Name -> User

        for (const [gId, gData] of groups) {
            // 1. Process Mentor
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

            // 2. Process Project
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

            // 3. Process Students & Create Group
            const memberIds = [];
            for (const s of gData.members) {
                const email = getEmail(s.name, 'Student', s.roll);
                let student = await User.findOne({ email });

                if (!student) {
                    student = await User.create({
                        name: s.name,
                        email: email,
                        password: 'password123',
                        role: 'Student',
                        rollNumber: s.roll,
                        branch: s.branch,
                        semester: 6,
                        isVerified: true
                    });
                }
                memberIds.push(student._id);
            }

            // 4. Create Group Document
            await Group.create({
                name: `UG Research Group ${gId}`,
                members: memberIds,
                project: project._id,
                mentor: mentor._id,
                status: 'Approved'
            });
        }

        console.log('Database population complete!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
