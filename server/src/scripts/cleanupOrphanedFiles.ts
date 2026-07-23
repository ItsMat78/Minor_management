import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import Project from '../models/Project';
import User from '../models/User';

// Must match uploadMiddleware's fallback (server/uploads) — from dist/scripts or src/scripts
// that is two levels up, not three. Three pointed at the repo root, where the walk found no
// files and the script silently cleaned nothing.
const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../uploads');

// Extract the relative path within uploadDir from a stored URL.
// "http://host/uploads/submissions/abc.pdf" → "submissions/abc.pdf"
function relPathFromUrl(url: string): string | null {
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
}

async function collectReferencedPaths(): Promise<Set<string>> {
    const referenced = new Set<string>();

    const users = await User.find({ photoUrl: { $exists: true, $ne: null } }, 'photoUrl').lean();
    for (const u of users) {
        if (u.photoUrl) {
            const rel = relPathFromUrl(u.photoUrl);
            if (rel) referenced.add(rel);
        }
    }

    const projects = await Project.find({}, 'attachments updates submissions').lean();
    for (const p of projects) {
        for (const url of p.attachments || []) {
            const rel = relPathFromUrl(url);
            if (rel) referenced.add(rel);
        }
        for (const update of p.updates || []) {
            for (const url of update.attachments || []) {
                const rel = relPathFromUrl(url);
                if (rel) referenced.add(rel);
            }
        }
        const subs = p.submissions as Record<string, string> | undefined;
        if (subs) {
            for (const url of Object.values(subs)) {
                if (typeof url === 'string') {
                    const rel = relPathFromUrl(url);
                    if (rel) referenced.add(rel);
                }
            }
        }
    }

    return referenced;
}

function walkDir(dir: string, base: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = path.posix.join(base, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full, rel));
        } else {
            results.push(rel);
        }
    }
    return results;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    if (dryRun) console.log('[Cleanup] DRY RUN — no files will be deleted');

    await mongoose.connect(process.env.MONGO_URI!);
    console.log('[Cleanup] Connected to MongoDB');

    const referenced = await collectReferencedPaths();
    console.log(`[Cleanup] ${referenced.size} files referenced in DB`);

    const onDisk = walkDir(uploadDir, '');
    console.log(`[Cleanup] ${onDisk.length} files on disk`);

    // Skip files newer than 7 days — they may belong to an in-progress upload flow
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let skipped = 0;

    for (const rel of onDisk) {
        if (referenced.has(rel)) continue;
        const full = path.join(uploadDir, rel);
        const stat = fs.statSync(full);
        if (stat.mtimeMs > cutoff) {
            skipped++;
            continue;
        }
        if (dryRun) {
            console.log(`[Cleanup] Would delete: ${rel}`);
        } else {
            fs.unlinkSync(full);
            console.log(`[Cleanup] Deleted: ${rel}`);
        }
        deleted++;
    }

    console.log(`[Cleanup] Done. ${dryRun ? 'Would delete' : 'Deleted'} ${deleted} file(s), skipped ${skipped} (< 7 days old).`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('[Cleanup] Fatal:', err);
    process.exit(1);
});
