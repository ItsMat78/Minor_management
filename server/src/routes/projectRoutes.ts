import express from 'express';
import { createProject, getProjects, getFacultyProjects, updateProjectStatus, addUpdate, markUpdatesRead, deleteProject, updateProject } from '../controllers/projectController';
import { auth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

router.use(auth);

router.post('/', createProject);
router.get('/faculty', getFacultyProjects);
router.put('/:id/status', updateProjectStatus);
router.post('/:id/updates', upload.array('files', 5), addUpdate);
router.put('/:id/updates/read', markUpdatesRead);
router.delete('/:id', deleteProject);
router.put('/:id', upload.array('files', 5), updateProject);
router.get('/', getProjects);

export default router;
