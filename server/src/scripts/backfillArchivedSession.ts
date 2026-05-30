import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import Project from '../models/Project';
import Group from '../models/Group';
import Panel from '../models/Panel';
import { sessionLabelFor } from '../utils/session';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// One-time backfill of `archivedSession` on archived records that predate the
// session feature. Idempotent — only touches docs where the field is missing/empty.
// The session is frozen from each record's archival timestamp (updatedAt) so it can
// no longer drift if the record is edited later. Run once after deploying the feature:
//   npx ts-node src/scripts/backfillArchivedSession.ts
async function backfillModel(model: any, label: string): Promise<number> {
    const docs = await model.find({
        isArchived: true,
        $or: [
            { archivedSession: { $exists: false } },
            { archivedSession: null },
            { archivedSession: '' }
        ]
    }).select('_id updatedAt createdAt').lean();

    if (docs.length === 0) {
        console.log(`${label}: nothing to backfill.`);
        return 0;
    }

    const ops = docs.map((d: any) => ({
        updateOne: {
            filter: { _id: d._id },
            update: { $set: { archivedSession: sessionLabelFor(new Date(d.updatedAt || d.createdAt || Date.now())) } }
        }
    }));
    const res = await model.bulkWrite(ops);
    console.log(`${label}: backfilled ${res.modifiedCount}/${docs.length}.`);
    return res.modifiedCount;
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management');

    let total = 0;
    total += await backfillModel(Project, 'Projects');
    total += await backfillModel(Group, 'Groups');
    total += await backfillModel(Panel, 'Panels');

    console.log(`\nDone. ${total} record(s) stamped with archivedSession.`);
    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
