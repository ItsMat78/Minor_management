import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { allowedOrigins } from './config/cors';
import { UnsupportedFileTypeError, UPLOAD_ROOT } from './middleware/uploadMiddleware';

import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import projectRoutes from './routes/projectRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import panelRoutes from './routes/panelRoutes';
import eventRoutes from './routes/eventRoutes';
import importRoutes from './routes/importRoutes';

const app = express();

// Behind a reverse proxy, set TRUST_PROXY (e.g. =1 for a single proxy hop) so req.ip reflects
// the real client IP for rate limiting. Left off by default — enabling it blindly would let
// clients spoof X-Forwarded-For when there is no trusted proxy in front.
if (process.env.TRUST_PROXY) {
    const tp = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp);
}

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// UPLOAD_ROOT, not a cwd-relative string: this must be the exact directory multer writes into.
app.use('/uploads', express.static(UPLOAD_ROOT));

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

// Upload failures reach here as thrown errors from multer, which runs as route middleware and so
// never gets to the controller's try/catch. Without this they fall through to Express's default
// handler and come back as a 500 HTML page, leaving the client to say "upload failed" while the
// user never learns their file was the wrong type or over the size limit.
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof UnsupportedFileTypeError) {
        return res.status(400).json({ message: err.message });
    }
    if (err instanceof multer.MulterError) {
        const reasons: Record<string, string> = {
            LIMIT_FILE_SIZE: 'That file is larger than the 10MB upload limit.',
            LIMIT_FILE_COUNT: 'Too many files in one upload.',
            LIMIT_UNEXPECTED_FILE: 'Too many files for this form, or a file arrived in an unexpected field.',
        };
        return res.status(400).json({ message: reasons[err.code] || `Upload failed: ${err.message}` });
    }
    return next(err);
});

export default app;
