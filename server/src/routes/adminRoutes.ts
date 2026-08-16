import express from 'express';
import { getStats, createAdmin, createUser, getArchive, semesterRollover, getDefaultFacultyLimits, setDefaultFacultyLimits, getExportSessions, getAuditLog, verifyAuditChain } from '../controllers/adminController';
import { auth } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';

const router = express.Router();

const adminAuth = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === UserRole.ADMIN) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

router.use(auth);
router.use(adminAuth);

router.get('/stats', getStats);
router.get('/archive', getArchive);
router.get('/export-sessions', getExportSessions);
router.post('/create', createAdmin);
router.post('/create-user', createUser);
router.post('/semester-rollover', semesterRollover);
router.get('/default-faculty-limits', getDefaultFacultyLimits);
router.put('/default-faculty-limits', setDefaultFacultyLimits);

// Audit trail (admin only, like the rest of this router). /verify must be declared before any
// future '/audit/:id' so it isn't swallowed as an id.
router.get('/audit', getAuditLog);
router.get('/audit/verify', verifyAuditChain);

export default router;
