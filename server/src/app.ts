import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import projectRoutes from './routes/projectRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import panelRoutes from './routes/panelRoutes';
import eventRoutes from './routes/eventRoutes';
import importRoutes from './routes/importRoutes';

const app = express();

const allowedOrigins = [
    'https://minor-management.vercel.app',
    'http://localhost:5173',
    'http://minor-project.iiitnr.ac.in',
    'https://minor-project.iiitnr.ac.in',
];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

const uploadsPath = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : 'uploads';
app.use('/uploads', express.static(uploadsPath));

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/panels', panelRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/import', importRoutes);

app.get('/', (_req, res) => {
    res.send('IIITNR Minor Project Portal API is running!');
});

export default app;
