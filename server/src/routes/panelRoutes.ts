import express from 'express';
import { createPanel, getPanels, deletePanel, getMyPanelEvaluationGroups, exportPanels, updatePanel, exportEvaluations, downloadEvaluationTemplate, importEvaluationTemplate, exportPanelFinalSheet, downloadPanelTemplate, previewPanelImport } from '../controllers/panelController';
import { auth } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

const adminAuth = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === UserRole.ADMIN) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

const facultyAuth = (req: any, res: any, next: any) => {
    if (req.user && (req.user.role === UserRole.FACULTY || req.user.role === UserRole.ADMIN)) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Faculty or Admin only.' });
    }
};

router.post('/', auth, adminAuth, createPanel);
router.get('/', auth, adminAuth, getPanels);
router.get('/export', auth, adminAuth, exportPanels);
router.get('/export-evaluations', auth, adminAuth, exportEvaluations);
router.get('/upload/template', auth, adminAuth, downloadPanelTemplate);
router.post('/upload/preview', auth, adminAuth, upload.single('file'), previewPanelImport);
router.get('/my-panels', auth, facultyAuth, getMyPanelEvaluationGroups);
router.delete('/:id', auth, adminAuth, deletePanel);
router.put('/:id', auth, adminAuth, updatePanel);
router.get('/:panelId/evaluation-template', auth, facultyAuth, downloadEvaluationTemplate);
router.post('/:panelId/evaluation-import', auth, facultyAuth, upload.single('file'), importEvaluationTemplate);
router.get('/:panelId/export-final', auth, facultyAuth, exportPanelFinalSheet);

export default router;
