
import express from 'express';
import { getFaculty, getAllStudents, updateUser } from '../controllers/userController';
import { auth } from '../middleware/authMiddleware';

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
router.get('/students', getAllStudents);
router.put('/:id', updateUser);

export default router;
