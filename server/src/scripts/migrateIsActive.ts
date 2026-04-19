import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor-management');
    const users = mongoose.connection.collection('users');

    const before = await users.countDocuments({});
    const withIsActive = await users.countDocuments({ isActive: { $exists: true } });
    console.log(`Users total: ${before}, with legacy isActive field: ${withIsActive}`);

    const result = await users.updateMany(
        { isActive: { $exists: true } },
        [
            { $set: { isParticipating: '$isActive' } },
            { $unset: 'isActive' }
        ] as any
    );
    console.log(`Migrated ${result.modifiedCount} user docs.`);

    const leftover = await users.countDocuments({ isActive: { $exists: true } });
    const participating = await users.countDocuments({ isParticipating: true });
    console.log(`Remaining with isActive: ${leftover}`);
    console.log(`Users with isParticipating=true: ${participating}`);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
