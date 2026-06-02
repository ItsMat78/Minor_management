import express, { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { login, getMe, verifyOtp, resendOtp, changePassword, forgotPassword, verifyForgotPasswordOtp } from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

const tooMany = (msg: string) => ({ message: msg });

// Per-account key: the email in the request body, falling back to the (IPv6-safe) client IP
// when there's no email. Keying by account means a shared campus NAT (many students behind
// one public IP) doesn't get collectively throttled for brute-force protection.
const emailKey = (req: Request): string => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return email || ipKeyGenerator(req.ip ?? '');
};

// Coarse per-IP backstop on every auth route. Generous so a campus NAT isn't throttled,
// while still capping a single source from flooding the auth endpoints.
// NOTE: behind a reverse proxy this keys on the proxy IP unless `trust proxy` is configured
// (see app.ts / TRUST_PROXY) — the per-account limiters below are the real brute-force guard.
const ipLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    message: tooMany('Too many requests from this network, please try again in a minute.'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Per-account brute-force guard for password login. Only FAILED attempts count
// (skipSuccessfulRequests), so a user who types the right password is never blocked.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: emailKey,
    message: tooMany('Too many failed login attempts for this account. Wait 15 minutes or use "Forgot password".'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Per-account brute-force guard for OTP verification. Separate budget from login so a locked
// login still leaves the OTP/forgot-password path usable. Only failed attempts count.
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: emailKey,
    message: tooMany('Too many incorrect codes for this account. Please wait 15 minutes and request a new code.'),
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', ipLimiter, loginLimiter, login);
router.get('/me', auth, getMe);
router.post('/verify-otp', ipLimiter, otpVerifyLimiter, verifyOtp);
router.post('/resend-otp', ipLimiter, resendOtp); // controller enforces a 60s per-account cooldown
router.post('/change-password', auth, changePassword);
router.post('/forgot-password', ipLimiter, forgotPassword); // controller enforces a 60s per-account cooldown
router.post('/verify-forgot-password-otp', ipLimiter, otpVerifyLimiter, verifyForgotPasswordOtp);

export default router;
