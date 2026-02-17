
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse-fork');
const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';
const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.pdf');

// Mongoose Models (Simplified for script)
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

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);

async function connectDB() {
    try {
        await mongoose.connect(DB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
}

async function main() {
    await connectDB();

    try {
        // 1. Read PDF
        const dataBuffer = fs.readFileSync(FILE_PATH);
        const data = await pdf(dataBuffer);

        // Flatten text to handle "vertical slice" / weird newline issues
        const rawText = data.text.replace(/\n/g, ' ');

        // 2. Extract Students & Mentors via Regex
        // Regex: (Optional SNo) (Name) (Roll - 9 digits) (Branch - CSE/DSAI/ECE)
        const studentRegex = /(\d+)?\s*([A-Za-z\s.]+?)(\d{9})(CSE|DSAI|ECE)/g;

        let match;
        const students = [];
        const matches = [];

        while ((match = studentRegex.exec(rawText)) !== null) {
            matches.push({
                index: match.index,
                fullMatch: match[0],
                groupNo: match[1], // SNo if present
                name: match[2].trim(),
                roll: match[3],
                branch: match[4]
            });
        }

        console.log(`Found ${matches.length} students/matches in text.`);

        // 3. Extract Context (Project/Mentor) between students
        // Iterate through matches to find text *between* them
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];

            // Text to search for mentor/project: from end of current match to start of next match
            // If last student, search until end of string (or reasonable limit)
            const startSearch = current.index + current.fullMatch.length;
            const endSearch = next ? next.index : Math.min(startSearch + 500, rawText.length);

            const contextText = rawText.substring(startSearch, endSearch);

            // Heuristic to find Mentor
            // Look for "Dr. X" or "Prof. X"
            const mentorMatch = contextText.match(/(Dr\.|Prof\.|Mr\.|Ms\.)\s+([A-Za-z\s]+?)(?=$|[A-Z])/);
            let mentorName = 'Unknown Faculty';
            let projectTitle = 'Minor Project'; // Default

            if (mentorMatch) {
                mentorName = mentorMatch[0].trim();

                // If mentor found, text *before* mentor is likely Project Title
                const preMentor = contextText.substring(0, mentorMatch.index).trim();

                // Clean potential garbage
                if (preMentor.length > 3 && preMentor.length < 100) {
                    // Check common placeholders
                    if (!preMentor.toUpperCase().includes('TBD')) {
                        projectTitle = preMentor.replace(/[^A-Za-z0-9\s\-_]/g, ''); // Basic clean
                    }
                }
            } else {
                // Sometimes mentor is earlier in the group logic?
                // Example: Group 1 starts, Mentor listed, then Student 2, Student 3.
                // Student 2 and 3 usually have empty context or just "CSE".
                // We should propagate logic: check Previous Student context if current context is empty?
                // OR: If current.groupNo is undefined, inherit from previous?
            }

            students.push({
                ...current,
                mentorName,
                projectTitle,
                contextText // Debug
            });
        }

        // 4. Propagate Group/Mentor Info
        // If a student doesn't have a Mentor/Project found in their direct context,
        // they likely belong to the group of the *previous* student (or the one before).
        // Since the PDF structure seems to be [Student 1] [Project/Mentor] [Student 2] ...
        // Student 1's context contains the info. Student 2 follows immediately.

        let lastGroupId = 0;
        let lastMentor = 'Unknown Faculty';
        let lastProject = 'Minor Project';

        const finalStudents = students.map((s, idx) => {
            // New Group detected?
            if (s.groupNo) {
                lastGroupId = s.groupNo;

                // If this student has mentor in context, update lastMentor
                // But wait, the context is *after* the student. 
                // Line 7: "1Aakansha... (Project Info) ... Abhay"
                // So Aakansha's context has the info.

                if (s.mentorName !== 'Unknown Faculty') {
                    lastMentor = s.mentorName;
                    lastProject = s.projectTitle;
                }
            } else {
                // Member of previous group
                // Use inherited info IF current context didn't provide new info
                if (s.mentorName === 'Unknown Faculty') {
                    s.mentorName = lastMentor;
                    s.projectTitle = lastProject;
                } else {
                    // Sometimes info is interspersed?
                    // Let's trust local find if valid, else inherit.
                    // Actually, usually "Project/Mentor" appears only once per group.
                }
            }

            return {
                name: s.name,
                roll: s.roll,
                branch: s.branch,
                mentorName: s.mentorName !== 'Unknown Faculty' ? s.mentorName : lastMentor,
                projectTitle: s.projectTitle !== 'Minor Project' ? s.projectTitle : lastProject
            };
        });

        console.log(`Processed ${finalStudents.length} students with group logic.`);

        // 5. Populate DB

        // Create Default Faculty
        const defaultFaculty = await User.findOneAndUpdate(
            { email: 'hod@iiitnr.edu.in' },
            {
                name: 'HOD',
                password: 'password123',
                role: 'Faculty',
                department: 'CSE',
                isVerified: true
            },
            { upsert: true, new: true }
        );

        const mentorMap = new Map(); // Name -> User

        // Create Faculty (Mentors)
        const uniqueMentors = [...new Set(finalStudents.map(s => s.mentorName))];

        for (const mName of uniqueMentors) {
            if (mName === 'Unknown Faculty') continue;

            const email = mName.toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.)\s*/, '').replace(/\s+/g, '.') + '@iiitnr.edu.in';

            let faculty = await User.findOne({ email });
            if (!faculty) {
                faculty = await User.findOne({ name: mName, role: 'Faculty' });
            }

            if (!faculty) {
                console.log(`Creating Faculty: ${mName}`);
                faculty = await User.create({
                    name: mName,
                    email: email,
                    password: 'password123',
                    role: 'Faculty',
                    department: 'CSE',
                    isVerified: true
                });
            }
            mentorMap.set(mName, faculty);
        }

        // Create Projects & Students
        for (const s of finalStudents) {
            // Create Student
            const email = s.roll + '@iiitnr.edu.in';
            let student = await User.findOne({ email });

            if (!student) {
                student = await User.create({
                    name: s.name,
                    email: email,
                    password: 'password123',
                    role: 'Student',
                    rollNumber: s.roll,
                    branch: s.branch,
                    semester: 4,
                    isVerified: true
                });
            }

            // Create Project
            const mentor = mentorMap.get(s.mentorName) || defaultFaculty;

            // Check if project title exists for this mentor
            let project = await Project.findOne({ title: s.projectTitle, createdBy: mentor._id });

            if (!project) {
                project = await Project.create({
                    title: s.projectTitle,
                    description: `Automated Project Entry for ${s.branch}`,
                    domain: s.branch,
                    createdBy: mentor._id,
                    status: 'Open',
                    tags: ['Minor Project', s.branch]
                });
            }

            // Note: We are not forming Groups (Group Model) in this script as I don't have the Group schema fully handy/complex.
            // But we have users and projects.
        }

        console.log('Database Population Complete!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main();
