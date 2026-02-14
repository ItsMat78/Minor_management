import express from 'express';
import { createProject, getProjects } from '../controllers/projectController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

router.use(auth);

router.post('/', createProject);
router.get('/', getProjects);

export default router;
