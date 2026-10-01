import express from 'express';
import { getEvents, getActiveEvents, createEvent, updateEvent, toggleEvent, deleteEvent, getParticipatingBatchesHandler } from '../controllers/eventController';
import { auth } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/permissions';

const router = express.Router();

// Public (authenticated) routes
router.get('/active', auth, getActiveEvents);
router.get('/participating-batches', auth, getParticipatingBatchesHandler);

// Staff routes (admin + coordinator; deleting stays with the admin)
router.use(auth);
router.get('/', requirePermission('events'), getEvents);
router.post('/', requirePermission('events'), createEvent);
router.put('/:id', requirePermission('events'), updateEvent);
router.put('/:id/toggle', requirePermission('events'), toggleEvent);
router.delete('/:id', requirePermission('events.delete'), deleteEvent);

export default router;
