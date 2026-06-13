import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/minor_management';
    await mongoose.connect(uri);

    const events = mongoose.connection.collection('events');
    const users = mongoose.connection.collection('users');

    const now = new Date();
    const gf = await events.findOne({
        type: 'group_formation_project_proposal',
        isActive: true,
    });

    console.log('=== Active GF event branch config ===');
    if (!gf) {
        console.log('No active group_formation_project_proposal event found.');
    } else {
        console.log('branchRestricted        :', (gf as any).branchRestricted);
        console.log('branchRestrictedBatches :', (gf as any).branchRestrictedBatches);
        console.log('branchRestrictionGroups :', JSON.stringify((gf as any).branchRestrictionGroups, null, 2));
        console.log('participatingBatches    :', (gf as any).participatingBatches);
        console.log('endDate / extensionDate :', (gf as any).endDate, '/', (gf as any).extensionDate);
    }

    const faculties = await users.find({ role: 'Faculty' }).project({ name: 1, branch: 1 }).toArray();
    const dist: Record<string, number> = {};
    for (const f of faculties) dist[String(f.branch ?? '∅')] = (dist[String(f.branch ?? '∅')] || 0) + 1;
    console.log('\n=== Faculty branch values (distinct -> count) ===');
    console.log(dist);

    // Simulate the client filter for each possible student branch.
    const groups = Array.isArray((gf as any)?.branchRestrictionGroups) ? (gf as any).branchRestrictionGroups : [];
    const simulate = (myBranch: string, batch: string) => {
        const entry = groups.find((g: any) => String(g.batch) === String(batch));
        const clusters: string[][] = entry && Array.isArray(entry.clusters)
            ? entry.clusters.map((c: string) => String(c).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)).filter((c: string[]) => c.length > 0)
            : [];
        const myCluster = clusters.find(c => c.includes(myBranch));
        const allowed = myCluster && myCluster.length ? myCluster : [myBranch];
        const visible = faculties.filter(f => {
            const bs = String(f.branch || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            if (bs.length === 0) return true;
            return bs.some(b => allowed.includes(b));
        });
        console.log(`\nstudent branch=${myBranch} batch=${batch} -> allowed=${JSON.stringify(allowed)} visible=${visible.length}/${faculties.length}`);
    };

    const batches: string[] = (gf as any)?.branchRestrictedBatches?.length ? (gf as any).branchRestrictedBatches.map(String) : ['2023'];
    console.log('\n=== Simulated visibility (using batch ' + batches[0] + ') ===');
    for (const b of ['CSE', 'DSAI', 'ECE']) simulate(b, batches[0]);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
