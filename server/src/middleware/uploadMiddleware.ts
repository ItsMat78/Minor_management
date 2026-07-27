import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Base uploads directory — override via UPLOAD_DIR env for NAS mounts.
//
// Exported because app.ts must serve exactly this directory over /uploads. It used to pass the
// bare string 'uploads' to express.static, which resolves against process.cwd() rather than the
// file location, so writes and reads only agreed when the process happened to be started from
// server/. That holds for `npm run dev` and breaks under pm2 started from anywhere else: files
// upload fine and then every /uploads request 404s. Derive it once, use it everywhere.
export const UPLOAD_ROOT = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
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
        const dest = path.join(UPLOAD_ROOT, bucket);
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Build a public URL for an uploaded file — honours UPLOAD_BASE_URL when set.
//
// Set UPLOAD_BASE_URL in every deployment. The request-derived fallback bakes whatever host the
// upload happened to arrive on into the database row forever, so a photo uploaded via
// localhost:5000 or a LAN IP is unreachable for every other viewer. The scheme is read from
// X-Forwarded-Proto first because behind a TLS-terminating proxy req.protocol is 'http' unless
// TRUST_PROXY is set, and an http:// image on an https:// page is blocked as mixed content.
// The client also re-points stored /uploads/... URLs at its own API origin (client/src/utils/
// uploadUrl.ts), which heals rows already written with a bad host.
export const publicUrlFor = (req: Request, file: Express.Multer.File): string => {
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const base = process.env.UPLOAD_BASE_URL
        || `${forwardedProto || req.protocol}://${req.get('host')}`;
    const bucket = bucketFor(req);
    return `${base.replace(/\/$/, '')}/uploads/${bucket}/${file.filename}`;
};

// Accept docs, pdfs, ppts, zips, spreadsheets (any image/* passes separately).
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Second chance by extension. Plain-text formats often have no registered type on the uploader's
// machine, so the browser sends '' or application/octet-stream for them — a mimetype-only
// allowlist rejects an ordinary .md readme, which is both surprising and hard to diagnose.
const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.csv']);

const ALLOWED_DESCRIPTION =
    'Allowed: images, PDF, Word, PowerPoint, Excel, CSV, text, Markdown and ZIP files.';

/** Thrown by the file filter so the error handler can answer 400 with a usable reason. */
export class UnsupportedFileTypeError extends Error {
    constructor(fileName: string) {
        super(`"${fileName}" is not a supported file type. ${ALLOWED_DESCRIPTION}`);
        this.name = 'UnsupportedFileTypeError';
    }
}

const fileFilter = (req: any, file: any, cb: any) => {
    const mimetype = String(file.mimetype || '');
    const ext = path.extname(String(file.originalname || '')).toLowerCase();

    if (mimetype.startsWith('image/') || ALLOWED_MIME_TYPES.has(mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
        cb(null, true);
    } else {
        cb(new UnsupportedFileTypeError(file.originalname || 'That file'), false);
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
        const match = url.match(/\/uploads\/(.+)$/);
        if (!match) return;
        const filePath = path.join(UPLOAD_ROOT, match[1]);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Storage] Deleted: ${filePath}`);
        }
    } catch (err) {
        console.error(`[Storage] Failed to delete ${url}:`, err);
    }
};
