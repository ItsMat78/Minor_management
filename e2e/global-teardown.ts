import mongoose from 'mongoose';

const E2E_MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://localhost:27017/minor_management_e2e';

export default async function globalTeardown() {
    await mongoose.connect(E2E_MONGO_URI);
    await mongoose.connection.db!.dropDatabase();
    await mongoose.disconnect();
    console.log('[E2E] Test database dropped.');
}
