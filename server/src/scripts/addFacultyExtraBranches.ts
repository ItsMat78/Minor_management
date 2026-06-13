import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Canonical order/casing so the stored value matches what the import flow produces
// and what the branch-restriction splitter (split(',').map(trim/upper)) picks up.
const BRANCHES = ['CSE', 'ECE', 'DSAI'];
const EXTRA_PROB = 0.4; // chance to add each branch the faculty doesn't already have

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

    let multiCount = 0;
    const sizeDist: Record<number, number> = {};

    for (const f of faculties) {
        // Start from whatever branches they already have (single or already multi).
        const current = new Set(
            String(f.branch || '')
                .split(',')
                .map((b: string) => b.trim().toUpperCase())
                .filter(Boolean)
        );
        if (current.size === 0) current.add('CSE');

        for (const b of BRANCHES) {
            if (!current.has(b) && Math.random() < EXTRA_PROB) current.add(b);
        }

        // Re-emit in canonical order: CSE, ECE, DSAI — comma-joined, no spaces.
        const value = BRANCHES.filter(b => current.has(b)).join(',');

        sizeDist[current.size] = (sizeDist[current.size] || 0) + 1;
        if (current.size > 1) multiCount++;

        await users.updateOne({ _id: f._id }, { $set: { branch: value } });
        console.log(`${String(f.branch || '—').padEnd(9)} -> ${value.padEnd(13)}  ${f.name} <${f.email}>`);
    }

    console.log(`\nUpdated ${faculties.length} faculty user(s); ${multiCount} now mentor multiple branches.`);
    console.log('Branches-per-faculty distribution:', sizeDist);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Failed to add faculty extra branches:', err);
    process.exit(1);
});
