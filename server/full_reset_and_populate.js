
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';
const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.xlsx');

// --- Schemas (Matching Application) ---

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
}, { strict: false, timestamps: true });

const GroupSchema = new mongoose.Schema({
    name: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    status: { type: String, enum: ['Forming', 'ProposalPending', 'Approved', 'Dissolved'], default: 'Approved' },
    inviteCode: { type: String }
}, { strict: false, timestamps: true });

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [{ type: String }],
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    semester: { type: Number },
    status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected', 'Archived'], default: 'Approved' },
    attachments: [{ type: String }],
    feedback: { type: String }
}, { strict: false, timestamps: true });

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Project = mongoose.model('Project', ProjectSchema);

// --- Helpers ---

const getEmail = (name, role = 'Student', roll = '') => {
    if (role === 'Student') return roll + '@iiitnr.edu.in';
    return name.toLowerCase().replace(/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)\s*/i, '').replace(/\s+/g, '.') + '@iiitnr.edu.in';
};

const findKey = (row, keywords) => Object.keys(row).find(k => keywords.some(kw => k.toLowerCase() === kw.toLowerCase() || k.toLowerCase().includes(kw.toLowerCase())));
const specificKey = (row, exact) => Object.keys(row).find(k => k === exact);

const generateGroupName = (domain, id) => {
    const d = (domain || '').toLowerCase();
    const num = parseInt(id) || Math.floor(Math.random() * 100);
    const idx = num % 5;
    let prefix = 'Tech', suffix = 'Innovators';

    if (d.includes('web') || d.includes('full stack')) {
        prefix = ['Pixel', 'Web', 'Cyber', 'Stack', 'Code'][idx];
        suffix = ['Crafters', 'Wizards', 'Flow', 'Smiths', 'Forge'][idx];
    } else if (d.includes('ai') || d.includes('ml') || d.includes('data')) {
        prefix = ['Neural', 'Deep', 'Smart', 'Data', 'Intel'][idx];
        suffix = ['Minds', 'Vision', 'Nexus', 'Nodes', 'Logic'][idx];
    } else if (d.includes('iot')) {
        prefix = ['Circuit', 'Sensor', 'Edge', 'Smart', 'Wire'][idx];
        suffix = ['Grid', 'Mesh', 'Connect', 'Net', 'Sync'][idx];
    } else if (d.includes('cloud')) {
        prefix = ['Cloud', 'Sky', 'Net', 'Serve', 'Host'][idx];
        suffix = ['Base', 'Hub', 'Ops', 'Scale', 'Deck'][idx];
    } else if (d.includes('block')) {
        prefix = ['Block', 'Crypto', 'Chain', 'Hash', 'Token'][idx];
        suffix = ['Guard', 'Vault', 'Link', 'Ledger', 'Mint'][idx];
    } else {
        prefix = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'][idx];
        suffix = ['Squad', 'Team', 'Vanguard', 'Force', 'Unit'][idx];
    }
    return `${prefix} ${suffix} ${id}`;
};

const generateProjectTitle = (domain) => {
    const d = (domain || 'General').toLowerCase();
    const topics = {
        web: ['E-Commerce Platform', 'Real-time Chat App', 'Portfolio Generator', 'Task Management System', 'Social Media Dashboard'],
        ai: ['Traffic Sign Recognition', 'Sentiment Analysis Tool', 'Fake News Detector', 'Disease Prediction Model', 'Voice Assistant'],
        ml: ['Stock Price Predictor', 'Customer Churn Model', 'Recommendation Engine', 'Image Classifier', 'Fraud Detection System'],
        iot: ['Smart Home Automation', 'Weather Monitoring Station', 'Smart Irrigation System', 'Health Monitoring Device', 'RFID Attendance System'],
        blockchain: ['Decentralized Voting App', 'Crypto Wallet', 'Supply Chain Tracker', 'NFT Marketplace', 'Smart Contract Auditor'],
        cloud: ['Serverless File Sharing', 'Cloud Resource Monitor', 'Distributed Cache', 'Load Balancer Sim', 'Container Orchestrator'],
        general: ['Library Management System', 'Hospital Management System', 'Inventory Tracker', 'Event Planner App', 'Alumni Portal']
    };

    let key = 'general';
    if (d.includes('web')) key = 'web';
    else if (d.includes('ai')) key = 'ai';
    else if (d.includes('ml')) key = 'ml';
    else if (d.includes('iot')) key = 'iot';
    else if (d.includes('block')) key = 'blockchain';
    else if (d.includes('cloud')) key = 'cloud';

    const list = topics[key];
    return list[Math.floor(Math.random() * list.length)];
};

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(DB_URI);
        console.log('Connected.');

        // 1. CLEAR DATABASE
        console.log('Clearing Database...');
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
        console.log('Database cleared.');

        // 2. CREATE ADMIN & HOD
        console.log('Creating Admin & Default Faculty...');
        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('adminpassword', salt);
        const defaultHash = await bcrypt.hash('password123', salt);

        await User.create({
            name: 'System Administrator',
            email: 'admin@iiitnr.edu.in',
            password: adminHash,
            role: 'Admin',
            isVerified: true,
            department: 'Administration'
        });



        // 3. READ EXCEL & GROUP
        console.log('Reading Excel...');
        const workbook = xlsx.readFile(FILE_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = xlsx.utils.sheet_to_json(sheet, { defval: null });

        // Group Logic
        let currentGroupId = null;
        let currentMentorName = null;
        let currentProjectTitle = null;
        let currentProjectDomain = null;

        const groupsMap = new Map();

        for (let i = 0; i < records.length; i++) {
            const row = records[i];

            // Detect Keys
            let keyGroup = specificKey(row, 'K') || findKey(row, ['s. no', 's.no']);
            let keyName = findKey(row, ['name', 'member']);
            let keyRoll = findKey(row, ['roll']);
            let keyBranch = findKey(row, ['department', 'branch']);
            let keyTitle = findKey(row, ['title', 'project']);
            let keyDomain = findKey(row, ['area', 'domain']);
            let keyMentor = findKey(row, ['supervisor', 'mentor']);

            // Update Context
            if (keyGroup && row[keyGroup] !== null) {
                currentGroupId = row[keyGroup];
                if (keyMentor && row[keyMentor]) currentMentorName = row[keyMentor];
                if (keyTitle && row[keyTitle]) currentProjectTitle = row[keyTitle];
                if (keyDomain && row[keyDomain]) currentProjectDomain = row[keyDomain];
            }

            // Add Student
            if (currentGroupId && keyName && row[keyName] && keyRoll && row[keyRoll]) {
                const student = {
                    name: row[keyName],
                    roll: String(row[keyRoll]).trim(),
                    branch: (keyBranch && row[keyBranch]) ? row[keyBranch] : 'CSE'
                };

                if (!groupsMap.has(currentGroupId)) {
                    groupsMap.set(currentGroupId, {
                        id: currentGroupId,
                        members: [],
                        mentorName: currentMentorName || 'Unknown Faculty',
                        projectTitle: currentProjectTitle,
                        domain: currentProjectDomain || 'CSE'
                    });
                }
                groupsMap.get(currentGroupId).members.push(student);
            }
        }

        console.log(`Identified ${groupsMap.size} groups. Processing...`);

        // 4. POPULATE
        const facultyCache = new Map(); // Name -> User

        for (const [gId, gData] of groupsMap) {
            // A. Resolve Mentor
            let mentor = await User.findOne({ email: 'admin@iiitnr.edu.in' });
            let mName = gData.mentorName;

            if (mName && mName !== 'Unknown Faculty' && mName !== 'TBD') {
                mName = mName.trim();
                // Normalize "Dr. Name" -> "Name" for fuzzy matching if needed, but exact is safer if consistent.
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
                            password: defaultHash,
                            role: 'Faculty',
                            department: 'CSE', // Default
                            isVerified: true
                        });
                        console.log(`Created Faculty: ${mName}`);
                    }
                    facultyCache.set(mName, f);
                    mentor = f;
                }
            }

            // B. Resolve Students
            const studentIds = [];
            const studentNames = [];

            for (const s of gData.members) {
                const email = getEmail(s.name, 'Student', s.roll);
                let student = await User.findOne({ email });

                if (!student) {
                    student = await User.create({
                        name: s.name,
                        email: email,
                        password: defaultHash,
                        role: 'Student',
                        rollNumber: s.roll,
                        branch: s.branch,
                        semester: 4,
                        isVerified: true
                    });
                }
                studentIds.push(student._id);
                studentNames.push(s.name.trim());
            }

            // C. Create Group
            // Use Cool Name Generator
            const groupName = generateGroupName(gData.domain, gId);

            const group = await Group.create({
                name: groupName,
                members: studentIds,
                // project: will be set after project creation
                status: 'Approved'
            });

            // D. Create Project
            let pTitle = gData.projectTitle;
            const projectKeywords = ['system', 'app', 'application', 'based', 'using', 'design', 'implementation', 'study', 'analysis', 'tool', 'platform', 'detection', 'recognition', 'prediction', 'classifier', 'network', 'bot', 'website', 'portal', 'engine', 'machine', 'learning', 'automation', 'smart', 'monitor', 'management', 'tracker', 'virtual', 'reality', 'augmented', 'security', 'crypto', 'chain', 'cloud', 'data'];

            let looksLikeProject = false;
            if (pTitle && typeof pTitle === 'string') {
                looksLikeProject = projectKeywords.some(kw => pTitle.toLowerCase().includes(kw));
            }

            // If it doesn't look like a project title (or is explicitly bad), generate a new one
            if (!pTitle || pTitle === 'TBD' || pTitle === 'null' || !looksLikeProject) {
                pTitle = generateProjectTitle(gData.domain);
            }

            // Handle duplicate titles (append Group ID)
            const existingProj = await Project.findOne({ title: pTitle });
            if (existingProj) {
                pTitle = `${pTitle} (${gId})`;
            }

            const project = await Project.create({
                title: pTitle,
                description: `Minor Project for Group ${gId} (${groupName}) in domain of ${gData.domain || 'CSE'}.`,
                tags: [gData.domain || 'CSE', 'Minor Project'],
                faculty: mentor._id,
                group: group._id, // LINK TO GROUP
                semester: 4,
                status: 'Approved'
            });

            // E. Link Project back to Group
            group.project = project._id;
            await group.save();
        }

        console.log('SUCCESS: Full Reset and Population Complete!');

    } catch (error) {
        console.error('FATAL ERROR:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main();
