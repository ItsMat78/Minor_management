import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { initSocket } from './socket';

import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import projectRoutes from './routes/projectRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import panelRoutes from './routes/panelRoutes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = initSocket(httpServer);

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Database Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management';
mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
// app.use('/*', (req, res, next) => { console.log('Global middleware', req.method, req.url); next(); });
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/panels', panelRoutes);

app.get('/', (req, res) => {
    res.send('IIITNR Minor Project Portal API is running!');
});

httpServer.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
