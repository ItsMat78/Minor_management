import express from 'express';
import { getEvents, getActiveEvents, createEvent, updateEvent, toggleEvent, deleteEvent, getParticipatingBatchesHandler, getProjectDetailsLock, setProjectDetailsLock } from '../controllers/eventController';
import { auth } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/permissions';

const router = express.Router();

// Public (authenticated) routes
router.get('/active', auth, getActiveEvents);
router.get('/participating-batches', auth, getParticipatingBatchesHandler);

// Staff routes (admin + coordinator; deleting stays with the admin)
router.use(auth);
router.get('/', requirePermission('events'), getEvents);
// Declared before '/:id' so PUT doesn't read 'project-details-lock' as an event id.
router.get('/project-details-lock', requirePermission('events'), getProjectDetailsLock);
router.put('/project-details-lock', requirePermission('events'), setProjectDetailsLock);
router.post('/', requirePermission('events'), createEvent);
router.put('/:id', requirePermission('events'), updateEvent);
router.put('/:id/toggle', requirePermission('events'), toggleEvent);
router.delete('/:id', requirePermission('events.delete'), deleteEvent);

export default router;
