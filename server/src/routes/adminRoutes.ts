import express from 'express';
import { getStats, createAdmin, createUser, getArchive, semesterRollover, getDefaultFacultyLimits, setDefaultFacultyLimits, getExportSessions, getAuditLog, verifyAuditChain, listCoordinators, createCoordinator, updateCoordinator } from '../controllers/adminController';
import { auth } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/permissions';

const router = express.Router();

router.use(auth);

router.get('/stats', requirePermission('stats'), getStats);
router.get('/archive', requirePermission('archive'), getArchive);
router.get('/export-sessions', requirePermission('exports'), getExportSessions);
router.post('/create', requirePermission('accounts'), createAdmin);
router.get('/coordinators', requirePermission('accounts'), listCoordinators);
router.post('/coordinators', requirePermission('accounts'), createCoordinator);
router.put('/coordinators/:id', requirePermission('accounts'), updateCoordinator);
router.post('/create-user', requirePermission('users'), createUser);
router.post('/semester-rollover', requirePermission('rollover'), semesterRollover);
router.get('/default-faculty-limits', requirePermission('stats'), getDefaultFacultyLimits);
router.put('/default-faculty-limits', requirePermission('settings'), setDefaultFacultyLimits);

// Audit trail (admin only). /verify must be declared before any
// future '/audit/:id' so it isn't swallowed as an id.
router.get('/audit', requirePermission('audit'), getAuditLog);
router.get('/audit/verify', requirePermission('audit'), verifyAuditChain);

export default router;
