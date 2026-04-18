import express from 'express';
import { getStats, createAdmin, createUser } from '../controllers/adminController';
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
router.post('/create', createAdmin);
router.post('/create-user', createUser);

export default router;
