
import express from 'express';
import { getFaculty, getAllStudents, updateUser, updateMyProfile, deleteUser, exportStudents, exportFaculty, uploadProfilePhoto, previewImport, commitImport, downloadImportTemplate } from '../controllers/userController';
import { auth, adminAuth } from '../middleware/authMiddleware';
import { upload, avatarUpload } from '../middleware/uploadMiddleware';

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
// Self-service profile update (any authenticated user; controller scopes editable
// fields by role). Declared before '/:id' so it is not captured by the param route.
router.put('/me', updateMyProfile);
router.put('/:id', adminAuth, updateUser);
router.delete('/:id', adminAuth, deleteUser);
// Stricter than `upload`: only formats every browser renders, and a 2MB cap. See avatarUpload.
router.post('/profile-photo', avatarUpload.single('photo'), uploadProfilePhoto);

// Import Routes (admin only)
router.get('/import-template', adminAuth, downloadImportTemplate);
router.post('/import-preview', adminAuth, upload.single('file'), previewImport);
router.post('/import-commit', adminAuth, commitImport);

export default router;
