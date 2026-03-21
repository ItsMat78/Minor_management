import express from 'express';
import { signup, login, getMe, verifyOtp } from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/verify-otp', verifyOtp);

export default router;
