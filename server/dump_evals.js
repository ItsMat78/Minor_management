const mongoose = require('mongoose');
const fs = require('fs');

const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';

const ProjectSchema = new mongoose.Schema({
    title: { type: String },
    midTermEvaluation: { type: mongoose.Schema.Types.Mixed },
    endTermEvaluation: { type: mongoose.Schema.Types.Mixed }
});

const Project = mongoose.model('Project', ProjectSchema);

async function main() {
    try {
        await mongoose.connect(DB_URI);
        const projects = await Project.find({
            $or: [
                { midTermEvaluation: { $exists: true } },
                { endTermEvaluation: { $exists: true } }
            ]
        }).lean();
        fs.writeFileSync('e:\\Projects\\Minor_management\\server\\eval_dump.json', JSON.stringify(projects, null, 2));
        console.log("Written to eval_dump.json");
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
