import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, getMe, verifyOtp, resendOtp, changePassword, forgotPassword, verifyForgotPasswordOtp } from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { message: 'Too many attempts, please try again after 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', authLimiter, login);
router.get('/me', auth, getMe);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/resend-otp', authLimiter, resendOtp);
router.post('/change-password', auth, changePassword);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-forgot-password-otp', authLimiter, verifyForgotPasswordOtp);

export default router;
