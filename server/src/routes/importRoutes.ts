import express from 'express';
import {
    previewExcelImport,
    commitExcelImport,
    exportSnapshot,
    previewSnapshotImport,
    commitSnapshotImport
} from '../controllers/importController';
import { auth } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/permissions';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

router.use(auth);

// Excel (IIITNR format) — full import: students + faculty + groups + projects
router.post('/excel/preview', requirePermission('users'), upload.single('file'), previewExcelImport);
router.post('/excel/commit',  requirePermission('users'), commitExcelImport);

// JSON snapshot
router.get('/snapshot/export',          requirePermission('snapshot'), exportSnapshot);
router.post('/snapshot/preview',        requirePermission('snapshot'), previewSnapshotImport);
router.post('/snapshot/commit',         requirePermission('snapshot'), commitSnapshotImport);

export default router;
