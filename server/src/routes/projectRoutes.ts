import express from 'express';
import { createProject, getProjects, getArchivedProjects, getFacultyProjects, updateProjectStatus, addUpdate, markUpdatesRead, deleteProject, updateProject, submitEvaluation, uploadSubmissions, addFeedback, setStudentFeedback, saveStudentEvaluations } from '../controllers/projectController';
import { auth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

router.use(auth);

router.post('/', createProject);
router.get('/archived', getArchivedProjects);
router.get('/faculty', getFacultyProjects);
router.put('/:id/status', updateProjectStatus);
router.post('/:id/updates', upload.array('files', 5), addUpdate);
router.put('/:id/updates/read', markUpdatesRead);
router.delete('/:id', deleteProject);
router.put('/:id', upload.array('files', 5), updateProject);
router.put('/:id/evaluation', submitEvaluation); // Add evaluation route
router.put('/:id/submissions', upload.fields([{ name: 'report', maxCount: 1 }, { name: 'ppt', maxCount: 1 }, { name: 'plagiarismReport', maxCount: 1 }]), uploadSubmissions);
router.put('/:id/feedback', addFeedback);
router.put('/:id/student-feedback', setStudentFeedback);
router.put('/:id/student-evaluations', saveStudentEvaluations);
router.get('/', getProjects);

export default router;
