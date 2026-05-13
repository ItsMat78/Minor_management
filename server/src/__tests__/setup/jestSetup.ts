import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Set before test file imports so authMiddleware/authController read the right secret at module-load time
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';

let mongod: MongoMemoryServer;

// 60s timeout: first run downloads the MongoDB binary (~70MB); cached runs are fast
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
}, 60000);

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
});

// Wipe all collections between tests so state never leaks across test cases
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
