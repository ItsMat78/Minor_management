
import express from 'express';
import { getFaculty, getAllStudents, updateUser, exportStudents, previewImport, commitImport } from '../controllers/userController';
import { auth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

console.log('--- USER ROUTES FILE LOADED ---');

// Ping (No Auth)
router.get('/ping', (req, res) => {
    console.log('--- PING HIT ---');
    res.json({ message: 'User routes working' });
});

// Logging middleware
router.use((req, res, next) => {
    console.log(`User Route Middleware: ${req.method} ${req.url}`);
    next();
});

// Auth
router.use(auth);

router.get('/faculty', getFaculty);
router.get('/students/export', exportStudents);
router.get('/students', getAllStudents);
router.put('/:id', updateUser);

// Import Routes
router.post('/import-preview', upload.single('file'), previewImport);
router.post('/import-commit', commitImport);

export default router;
