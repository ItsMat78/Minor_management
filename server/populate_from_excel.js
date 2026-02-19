
const xlsx = require('xlsx');
const path = require('path');
const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';
const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.xlsx');

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
    status: { type: String, default: 'Pending' } // Pending, Formed, Approved
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

function processExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    // Expected Columns: S. No., Name, Roll No, Branch, Title of the Minor Project, Area of Project, Name of the Supervisor
    const data = xlsx.utils.sheet_to_json(sheet);
    return data;
}

// Generate email
const getEmail = (name, role = 'Student', roll = '') => {
    if (role === 'Student') return roll + '@iiitnr.edu.in';
    return name.toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.)\s*/, '').replace(/\s+/g, '.') + '@iiitnr.edu.in';
};

async function main() {
    await connectDB();

    try {
        const records = processExcel(FILE_PATH);
        console.log(`Read ${records.length} records from Excel.`);

        // Determine Columns (keys might vary slightly)
        // Let's inspect first record key names
        if (records.length > 0) {
            console.log('Columns detected:', Object.keys(records[0]));
        }

        const facultyMap = new Map(); // Name -> User Object
        const studentMap = new Map(); // Roll -> User Object

        // Key Mapping Helpers (flexible)
        const findKey = (row, keywords) => Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));

        const KEY_NAME = 'Name';
        const KEY_ROLL = 'Roll No';
        const KEY_BRANCH = 'Department'; // Or Branch
        const KEY_TITLE = 'Title';
        const KEY_Mentor = 'Supervisor';
        const KEY_Group = 'S. No.'; // Assuming S. No. groups students

        // First Pass: Create Faculty & Students
        for (const row of records) {
            // Identify Keys dynamically
            const keyName = findKey(row, ['name']);
            const keyRoll = findKey(row, ['roll']);
            const keyBranch = findKey(row, ['department', 'branch']);
            const keyTitle = findKey(row, ['title', 'project']);
            const keyMentor = findKey(row, ['supervisor', 'mentor', 'guide']);
            const keyGroup = findKey(row, ['s. no', 's.no', 'group']);

            const name = row[keyName];
            const roll = row[keyRoll];
            const branch = row[keyBranch] || 'CSE';
            let mentorName = row[keyMentor];
            const projectTitle = row[keyTitle] || 'Minor Project';
            const groupId = row[keyGroup];

            if (!name || !roll) continue;

            // 1. Student
            const studentEmail = getEmail(name, 'Student', roll);
            let student = await User.findOne({ email: studentEmail });
            if (!student) {
                student = await User.create({
                    name,
                    email: studentEmail,
                    password: 'password123',
                    role: 'Student',
                    rollNumber: String(roll),
                    branch: branch,
                    semester: 4,
                    isVerified: true
                });
            }
            studentMap.set(String(roll), student);

            // 2. Faculty
            if (mentorName && mentorName !== 'TBD' && mentorName.length > 3) {
                mentorName = mentorName.trim();
                if (!facultyMap.has(mentorName)) {
                    const facultyEmail = getEmail(mentorName, 'Faculty');
                    let faculty = await User.findOne({ email: facultyEmail });
                    if (!faculty) {
                        // Check by name
                        faculty = await User.findOne({ name: mentorName, role: 'Faculty' });
                    }
                    if (!faculty) {
                        console.log(`Creating Faculty: ${mentorName}`);
                        faculty = await User.create({
                            name: mentorName,
                            email: facultyEmail,
                            password: 'password123',
                            role: 'Faculty',
                            department: 'CSE', // Default
                            isVerified: true
                        });
                    }
                    facultyMap.set(mentorName, faculty);
                }
            }
        }

        // Ensure Default Admin/Faculty Fallback
        let defaultFaculty = await User.findOne({ email: 'admin@iiitnr.edu.in' });
        if (!defaultFaculty) {
            // Should exist from create_admin.js or full_reset, but create if needed
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

        console.log('Users created. Creating Projects & Groups...');

        // Second Pass: Grouping
        // Group students by 'S. No.' or similar
        const groups = {}; // GroupID -> { members: [], mentorName, projectTitle }

        for (const row of records) {
            const keyGroup = findKey(row, ['s. no', 's.no', 'group']);
            const keyMentor = findKey(row, ['supervisor', 'mentor', 'guide']);
            const keyTitle = findKey(row, ['title', 'project']);
            const keyRoll = findKey(row, ['roll']);

            const groupId = row[keyGroup];
            const roll = String(row[keyRoll]);

            if (!groupId) continue;

            if (!groups[groupId]) {
                groups[groupId] = {
                    members: [],
                    mentorName: row[keyMentor],
                    projectTitle: row[keyTitle]
                };
            }

            // Add student if exists
            if (studentMap.has(roll)) {
                groups[groupId].members.push(studentMap.get(roll)._id);
            }

            // Update project/mentor info if found (sometimes only on first row of group)
            if (row[keyMentor] && row[keyMentor] !== 'TBD') groups[groupId].mentorName = row[keyMentor];
            if (row[keyTitle] && row[keyTitle] !== 'TBD') groups[groupId].projectTitle = row[keyTitle];
        }

        // Create Groups & Projects
        for (const gId of Object.keys(groups)) {
            const gData = groups[gId];
            if (gData.members.length === 0) continue;

            const mentor = facultyMap.get(gData.mentorName) || defaultFaculty;

            // Create Project
            let projectTitle = gData.projectTitle;
            if (!projectTitle || projectTitle === 'TBD') projectTitle = `Minor Project Group ${gId}`;

            let project = await Project.findOne({ title: projectTitle, createdBy: mentor._id });
            if (!project) {
                project = await Project.create({
                    title: projectTitle,
                    description: `Project for Group ${gId}`,
                    domain: 'CSE', // Default
                    createdBy: mentor._id,
                    status: 'Assigned', // Since it has a group
                    tags: ['Minor Project']
                });
            }

            // Create Group
            const groupName = `Group ${gId}`;
            await Group.create({
                name: groupName,
                members: gData.members,
                project: project._id,
                mentor: mentor._id,
                status: 'Approved'
            });

            // Update Students
            // (Optional: Link group back to student user model if schema supports it, usually via reference or just query)
        }

        console.log('Database populated successfully from Excel!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
