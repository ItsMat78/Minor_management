import express from 'express';
import { signup, login, getMe } from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, getMe);

export default router;
