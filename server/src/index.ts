import dotenv from 'dotenv';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { initSocket } from './socket';
import app from './app';

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
    process.exit(1);
}

const httpServer = createServer(app);
initSocket(httpServer);

const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management';

mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

httpServer.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
