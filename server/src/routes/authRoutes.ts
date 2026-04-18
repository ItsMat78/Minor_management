import express from 'express';
import { login, getMe, verifyOtp, resendOtp, changePassword } from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/change-password', auth, changePassword);

export default router;
