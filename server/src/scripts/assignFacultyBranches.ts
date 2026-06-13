import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BRANCHES = ['CSE', 'ECE', 'DSAI'];

// Fisher–Yates shuffle (in place).
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function run() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';
    await mongoose.connect(uri);
    console.log(`Connected to: ${uri}\n`);

    const users = mongoose.connection.collection('users');
    const faculties = await users
        .find({ role: 'Faculty' })
        .project({ name: 1, email: 1, branch: 1 })
        .toArray();

    if (faculties.length === 0) {
        console.log('No faculty users found — nothing to do.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // Random but even spread: shuffle the faculties, then deal branches round-robin
    // from a shuffled branch order so all three are represented as evenly as possible.
    shuffle(faculties);
    const branchOrder = shuffle([...BRANCHES]);

    const counts: Record<string, number> = {};
    for (let i = 0; i < faculties.length; i++) {
        const f = faculties[i];
        const branch = branchOrder[i % branchOrder.length];
        counts[branch] = (counts[branch] || 0) + 1;
        await users.updateOne({ _id: f._id }, { $set: { branch } });
        console.log(`${(f.branch || '—').padEnd(5)} -> ${branch.padEnd(5)}  ${f.name} <${f.email}>`);
    }

    console.log(`\nAssigned branches to ${faculties.length} faculty user(s).`);
    console.log('Distribution:', counts);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Failed to assign faculty branches:', err);
    process.exit(1);
});
