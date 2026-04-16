import express from 'express';
import {
    previewExcelImport,
    commitExcelImport,
    exportSnapshot,
    previewSnapshotImport,
    commitSnapshotImport
} from '../controllers/importController';
import { auth, adminAuth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

router.use(auth, adminAuth);

// Excel (IIITNR format) — full import: students + faculty + groups + projects
router.post('/excel/preview', upload.single('file'), previewExcelImport);
router.post('/excel/commit',  commitExcelImport);

// JSON snapshot
router.get('/snapshot/export',          exportSnapshot);
router.post('/snapshot/preview',        previewSnapshotImport);
router.post('/snapshot/commit',         commitSnapshotImport);

export default router;
