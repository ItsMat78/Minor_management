import express from 'express';
import { createPanel, getPanels, getMyStudentPanel, deletePanel, getMyPanelEvaluationGroups, getAllPanelEvaluationGroups, exportPanels, updatePanel, setPanelChair, exportEvaluations, downloadEvaluationTemplate, importEvaluationTemplate, exportPanelFinalSheet, downloadPanelTemplate, previewPanelImport, exportOfficialFormat, exportPanelsAsTemplate, downloadBatchEvaluationTemplate, importBatchEvaluationTemplate, exportBatchFinalSheet } from '../controllers/panelController';
import { auth } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';
import { requirePermission, hasPermission } from '../utils/permissions';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

// Panel members (faculty) and staff allowed to handle evaluations.
const facultyAuth = (req: any, res: any, next: any) => {
    if (req.user && (req.user.role === UserRole.FACULTY || hasPermission(req.user.role, 'evaluations'))) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Faculty or Admin only.' });
    }
};

router.post('/', auth, requirePermission('panels'), createPanel);
router.get('/', auth, requirePermission('panels'), getPanels);
router.get('/export', auth, requirePermission('panels'), exportPanels);
router.get('/export-evaluations', auth, requirePermission('evaluations'), exportEvaluations);
router.get('/export-official', auth, requirePermission('evaluations'), exportOfficialFormat);
router.get('/upload/template', auth, requirePermission('panels'), downloadPanelTemplate);
router.get('/export-template', auth, requirePermission('panels'), exportPanelsAsTemplate);
router.post('/upload/preview', auth, requirePermission('panels'), upload.single('file'), previewPanelImport);
router.get('/my-student-panel', auth, getMyStudentPanel);
router.get('/my-panels', auth, facultyAuth, getMyPanelEvaluationGroups);
router.get('/admin-eval-panels', auth, requirePermission('evaluations'), getAllPanelEvaluationGroups);
router.get('/admin-eval-batch-template', auth, requirePermission('evaluations'), downloadBatchEvaluationTemplate);
router.post('/admin-eval-batch-import', auth, requirePermission('evaluations'), upload.single('file'), importBatchEvaluationTemplate);
router.get('/admin-eval-batch-final', auth, requirePermission('evaluations'), exportBatchFinalSheet);
router.delete('/:id', auth, requirePermission('panels'), deletePanel);
router.put('/:id', auth, requirePermission('panels'), updatePanel);
router.put('/:id/chair', auth, requirePermission('panels'), setPanelChair);
router.get('/:panelId/evaluation-template', auth, facultyAuth, downloadEvaluationTemplate);
router.post('/:panelId/evaluation-import', auth, facultyAuth, upload.single('file'), importEvaluationTemplate);
router.get('/:panelId/export-final', auth, facultyAuth, exportPanelFinalSheet);

export default router;
