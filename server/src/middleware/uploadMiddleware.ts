import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Base uploads directory — override via UPLOAD_DIR env for NAS mounts
const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Sub-bucket derived from the route path: /projects/:id/updates → "updates"
const bucketFor = (req: Request) => {
    const p = req.originalUrl || req.url || '';
    if (p.includes('/submissions')) return 'submissions';
    if (p.includes('/updates')) return 'updates';
    if (p.includes('/profile-photo')) return 'avatars';
    if (p.includes('/proposals') || p.includes('/projects')) return 'proposals';
    if (p.includes('/import')) return 'imports';
    return 'misc';
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const bucket = bucketFor(req as Request);
        const dest = path.join(uploadDir, bucket);
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Build a public URL for an uploaded file — honours UPLOAD_BASE_URL when set
export const publicUrlFor = (req: Request, file: Express.Multer.File): string => {
    const base = process.env.UPLOAD_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const bucket = bucketFor(req);
    return `${base.replace(/\/$/, '')}/uploads/${bucket}/${file.filename}`;
};

const fileFilter = (req: any, file: any, cb: any) => {
    // Accept images, docs, pdfs, ppts, zips, spreadsheets
    if (file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/vnd.ms-powerpoint' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.mimetype === 'text/plain' ||
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

export const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
});

/**
 * Delete a file from disk given its public URL.
 * Silently no-ops if the URL is empty, external, or the file is already gone.
 */
export const deleteFileByUrl = (url: string | null | undefined): void => {
    if (!url) return;
    try {
        const localBase = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.join(__dirname, '../../uploads');
        const match = url.match(/\/uploads\/(.+)$/);
        if (!match) return;
        const filePath = path.join(localBase, match[1]);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Storage] Deleted: ${filePath}`);
        }
    } catch (err) {
        console.error(`[Storage] Failed to delete ${url}:`, err);
    }
};
