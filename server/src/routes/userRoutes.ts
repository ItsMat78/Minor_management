
import express from 'express';
import { getFaculty, getAllStudents, updateUser, exportStudents, exportFaculty, uploadProfilePhoto, previewImport, commitImport } from '../controllers/userController';
import { auth, adminAuth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

// Ping (No Auth)
router.get('/ping', (req, res) => {
    res.json({ message: 'User routes working' });
});

// Auth
router.use(auth);

router.get('/faculty', getFaculty);
router.get('/students/export', exportStudents);
router.get('/faculty/export', adminAuth, exportFaculty);
router.get('/students', getAllStudents);
router.put('/:id', adminAuth, updateUser);
router.post('/profile-photo', upload.single('photo'), uploadProfilePhoto);

// Import Routes (admin only)
router.post('/import-preview', adminAuth, upload.single('file'), previewImport);
router.post('/import-commit', adminAuth, commitImport);

export default router;
