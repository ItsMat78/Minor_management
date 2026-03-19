const mongoose = require('mongoose');
const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

const ProjectSchema = new mongoose.Schema({
    title: { type: String },
    midTermEvaluation: { type: mongoose.Schema.Types.Mixed },
    endTermEvaluation: { type: mongoose.Schema.Types.Mixed },
    finalReportEvaluation: { type: mongoose.Schema.Types.Mixed }
});

const Project = mongoose.model('Project', ProjectSchema);

async function main() {
    await mongoose.connect(DB_URI);
    try {
        const projectsWithEvaluations = await Project.find({ 
            $or: [
                { midTermEvaluation: { $exists: true } },
                { endTermEvaluation: { $exists: true } },
                { finalReportEvaluation: { $exists: true } }
            ]
        }).limit(5).lean();
        console.log("Projects with evaluations:", JSON.stringify(projectsWithEvaluations, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
