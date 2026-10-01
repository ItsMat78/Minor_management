
import express from 'express';
import { getFaculty, getAllStudents, updateUser, updateMyProfile, deleteUser, exportStudents, exportFaculty, uploadProfilePhoto, removeProfilePhoto, previewImport, commitImport, downloadImportTemplate } from '../controllers/userController';
import { auth } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/permissions';
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
router.get('/faculty/export', requirePermission('exports'), exportFaculty);
router.get('/students', getAllStudents);
// Self-service profile update (any authenticated user; controller scopes editable
// fields by role). Declared before '/:id' so it is not captured by the param route.
router.put('/me', updateMyProfile);
router.put('/:id', requirePermission('users'), updateUser);
// Own-photo routes sit above '/:id' so the DELETE is not swallowed by the admin-only
// delete-a-user route, which would both reject the caller and read 'profile-photo' as an id.
// Stricter than `upload`: only formats every browser renders, and a 2MB cap. See avatarUpload.
router.post('/profile-photo', avatarUpload.single('photo'), uploadProfilePhoto);
router.delete('/profile-photo', removeProfilePhoto);
router.delete('/:id', requirePermission('users'), deleteUser);

// Import Routes (account management — admin only)
router.get('/import-template', requirePermission('users'), downloadImportTemplate);
router.post('/import-preview', requirePermission('users'), upload.single('file'), previewImport);
router.post('/import-commit', requirePermission('users'), commitImport);

export default router;
