import express from 'express';
import { getEvents, getActiveEvents, createEvent, updateEvent, toggleEvent, deleteEvent } from '../controllers/eventController';
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

// Public (authenticated) routes
router.get('/active', auth, getActiveEvents);

// Admin-only routes
router.use(auth);
router.get('/', adminAuth, getEvents);
router.post('/', adminAuth, createEvent);
router.put('/:id', adminAuth, updateEvent);
router.put('/:id/toggle', adminAuth, toggleEvent);
router.delete('/:id', adminAuth, deleteEvent);

export default router;
