const mongoose = require('mongoose');

async function debugProjectStatus() {
    await mongoose.connect('mongodb://localhost:27017/minor_db');

    // Minimal models
    const Project = mongoose.model('Project', new mongoose.Schema({
        status: String,
        faculty: mongoose.Schema.Types.ObjectId,
        group: mongoose.Schema.Types.ObjectId
    }));

    const Group = mongoose.model('Group', new mongoose.Schema({
        status: String,
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }));

    const User = mongoose.model('User', new mongoose.Schema({
        role: String,
        maxStudents: Number,
        maxGroups: Number,
        batchConfigs: [{
            batchYear: Number,
            maxStudents: Number,
            maxGroups: Number
        }]
    }));

    const pendingProjects = await Project.find({ status: 'Pending' }).lean();
    console.log(`Found ${pendingProjects.length} pending projects`);

    for (const project of pendingProjects) {
        console.log(`\nAnalyzing project: ${project._id}`);
        console.log(`Faculty ID: ${project.faculty}`);
        console.log(`Group ID: ${project.group}`);

        if (project.faculty) {
            const facultyUser = await User.findById(project.faculty).lean();
            if (!facultyUser) {
                console.log(`  ERROR: Faculty user not found for ID: ${project.faculty}`);
                continue;
            }

            const group = await Group.findById(project.group).lean();
            if (!group) {
                console.log(`  ERROR: Group not found for ID: ${project.group}`);
                continue;
            }
            console.log(`  Group members count: ${group.members?.length || 0}`);

            if (group.members && group.members.length > 0) {
                // Determine batch year from first member (mock User schema lacking rollNumber but we can check if it exists in DB)
                const firstMemberDetails = await User.findById(group.members[0]).lean();
                if (firstMemberDetails && firstMemberDetails.rollNumber) {
                    const batchYearPrefix = firstMemberDetails.rollNumber.substring(0, 2);
                    const batchYear = parseInt('20' + batchYearPrefix);
                    console.log(`  Batch year: ${batchYear}`);

                    let maxStudents = facultyUser.maxStudents || 21;
                    let maxGroups = facultyUser.maxGroups || 7;

                    const batchConfig = (facultyUser.batchConfigs || []).find(c => c.batchYear === batchYear);
                    if (batchConfig) {
                        maxStudents = batchConfig.maxStudents;
                        maxGroups = batchConfig.maxGroups;
                    }

                    console.log(`  Limits: maxGroups=${maxGroups}, maxStudents=${maxStudents}`);

                    // Calculate workload
                    const approvedProjects = await Project.find({
                        faculty: project.faculty,
                        status: 'Approved',
                        _id: { $ne: project._id }
                    }).lean();

                    let currentGroupsCount = 0;
                    let currentStudentsCount = 0;

                    for (const p of approvedProjects) {
                        const g = await Group.findById(p.group).lean();
                        if (g && g.members && g.members.length > 0) {
                            const fm = await User.findById(g.members[0]).lean();
                            if (fm && fm.rollNumber && fm.rollNumber.startsWith(batchYearPrefix)) {
                                currentGroupsCount++;
                                currentStudentsCount += g.members.length;
                            }
                        }
                    }

                    console.log(`  Current Load: ${currentGroupsCount} groups, ${currentStudentsCount} students`);

                    if (currentGroupsCount + 1 > maxGroups) {
                        console.log(`  WILL FAIL: Group limit reached! (${currentGroupsCount + 1} > ${maxGroups})`);
                    } else if (currentStudentsCount + group.members.length > maxStudents) {
                        console.log(`  WILL FAIL: Student limit reached! (${currentStudentsCount + group.members.length} > ${maxStudents})`);
                    } else {
                        console.log(`  CAN BE APPROVED successfully.`);
                    }
                } else {
                    console.log(`  Cannot determine batch year (no rollNumber on first member).`);
                }
            }
        } else {
            console.log(`  ERROR: Project has no faculty assigned.`);
        }
    }
    process.exit(0);
}

debugProjectStatus().catch(console.error);
