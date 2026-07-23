/**
 * Diagnose broken profile photos.
 *
 * For every user with a photoUrl, reports whether the file actually exists on disk and
 * whether the URL's host/scheme matches what this deployment serves. Read-only — it
 * changes nothing unless you pass --fix-host.
 *
 *   node dist/scripts/checkProfilePhotos.js
 *   node dist/scripts/checkProfilePhotos.js --fix-host     # rewrite stale hosts to UPLOAD_BASE_URL
 *
 * Typical findings:
 *   MISSING FILE  the row points at a file that is no longer on disk (deleted, or the photo
 *                 was uploaded on a different machine / before a UPLOAD_DIR change)
 *   STALE HOST    the URL names a host other than UPLOAD_BASE_URL — unreachable for anyone
 *                 not on that network. The client resolves around this, but --fix-host
 *                 cleans the data up properly.
 *   UNPLAYABLE    the browser cannot decode this format (HEIC/HEIF from an iPhone). The
 *                 upload filter accepts any image/*, but only Safari renders HEIC.
 */
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import User from '../models/User';

const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../uploads');

const BASE = (process.env.UPLOAD_BASE_URL || '').replace(/\/$/, '');
const UNRENDERABLE = ['.heic', '.heif', '.tif', '.tiff'];

const relPathFromUrl = (url: string): string | null => {
    const idx = url.indexOf('/uploads/');
    return idx === -1 ? null : url.slice(idx + '/uploads/'.length);
};

async function main() {
    const fixHost = process.argv.includes('--fix-host');
    if (fixHost && !BASE) {
        console.error('--fix-host needs UPLOAD_BASE_URL set in .env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI!);
    console.log(`Uploads dir : ${uploadDir}`);
    console.log(`Base URL    : ${BASE || '(unset — URLs carry the upload-time host)'}\n`);

    const users = await User.find(
        { photoUrl: { $exists: true, $nin: [null, ''] } },
        'name email role photoUrl'
    ).lean();

    console.log(`${users.length} user(s) have a profile photo.\n`);

    let broken = 0;
    let fixed = 0;

    for (const u of users as any[]) {
        const problems: string[] = [];
        const rel = relPathFromUrl(u.photoUrl);

        if (!rel) {
            problems.push('NOT AN UPLOAD URL');
        } else {
            if (!fs.existsSync(path.join(uploadDir, rel))) problems.push('MISSING FILE');
            if (UNRENDERABLE.includes(path.extname(rel).toLowerCase())) problems.push('UNRENDERABLE FORMAT');
        }

        if (BASE && !u.photoUrl.startsWith(BASE + '/')) problems.push('STALE HOST');

        if (problems.length === 0) continue;

        broken++;
        console.log(`${problems.join(', ')}`);
        console.log(`   ${u.role.padEnd(7)} ${u.name} <${u.email}>`);
        console.log(`   ${u.photoUrl}`);

        if (fixHost && rel && problems.includes('STALE HOST')) {
            const next = `${BASE}/uploads/${rel}`;
            await User.updateOne({ _id: u._id }, { $set: { photoUrl: next } });
            console.log(`   → rewritten to ${next}`);
            fixed++;
        }
        console.log('');
    }

    console.log(`${broken} problem(s) found across ${users.length} photo(s).`);
    if (fixHost) console.log(`${fixed} URL(s) rewritten.`);
    if (broken > 0 && !fixHost) {
        console.log('\nMISSING FILE rows need the photo re-uploaded — the bytes are gone.');
        console.log('STALE HOST rows can be repaired with --fix-host.');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
