import express from 'express';
import { createPanel, getPanels, deletePanel, getMyPanelEvaluationGroups } from '../controllers/panelController';
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

const facultyAuth = (req: any, res: any, next: any) => {
    if (req.user && (req.user.role === UserRole.FACULTY || req.user.role === UserRole.ADMIN)) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Faculty or Admin only.' });
    }
};

router.post('/', auth, adminAuth, createPanel);
router.get('/', auth, adminAuth, getPanels);
router.delete('/:id', auth, adminAuth, deletePanel);
router.get('/my-panels', auth, facultyAuth, getMyPanelEvaluationGroups);

export default router;
