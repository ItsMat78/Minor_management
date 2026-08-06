import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Set before test file imports so authMiddleware/authController read the right secret at module-load time
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';

// Same reason: uploadMiddleware resolves UPLOAD_ROOT once, at module load. Without this every
// test that posts a file writes into the developer's real server/uploads tree and leaves it
// there — the database is wiped between tests, but the files on disk never were.
const TEST_UPLOAD_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'minor-portal-uploads-'));
process.env.UPLOAD_DIR = TEST_UPLOAD_ROOT;

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
    fs.rmSync(TEST_UPLOAD_ROOT, { recursive: true, force: true });
});

// Wipe all collections between tests so state never leaks across test cases
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
