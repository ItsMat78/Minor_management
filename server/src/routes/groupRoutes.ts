import express from 'express';
import { createGroup, getMyGroup } from '../controllers/groupController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// All group routes require authentication
router.use(auth);

router.post('/', createGroup);
router.get('/my', getMyGroup);

export default router;
