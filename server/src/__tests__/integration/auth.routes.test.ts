/**
 * Integration tests for /api/auth routes.
 * Fires real HTTP requests against the Express app using an in-memory MongoDB.
 */
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import { createTestUser, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

// All email functions must return a Promise so .catch() in controllers doesn't throw.
// Auto-mocking returns undefined which breaks controller code like sendEmail(...).catch(...)
jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCompleteEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('POST /api/auth/login', () => {
    it('returns 400 for a non-existent email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@iiitnr.ac.in', password: 'anything' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns 400 for a wrong password', async () => {
        await createTestUser({ email: 'user@iiitnr.ac.in', password: 'correctpass' });
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@iiitnr.ac.in', password: 'wrongpass' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns a JWT token and strips password on success', async () => {
        await createTestUser({ email: 'ok@iiitnr.ac.in', password: 'Password123!' });
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'ok@iiitnr.ac.in', password: 'Password123!' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(typeof res.body.token).toBe('string');
        expect(res.body.user.password).toBeUndefined();
        expect(res.body.user.email).toBe('ok@iiitnr.ac.in');
    });

    it('triggers OTP flow instead of issuing a token for an unverified user', async () => {
        await createTestUser({ email: 'unverified@iiitnr.ac.in', password: 'pass123', isVerified: false });
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'unverified@iiitnr.ac.in', password: 'pass123' });
        expect(res.status).toBe(200);
        expect(res.body.requiresActivation).toBe(true);
        expect(res.body.token).toBeUndefined();
    });
});

describe('GET /api/auth/me', () => {
    it('returns 401 when no token is provided', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/no token/i);
    });

    it('returns 401 for a malformed token', async () => {
        // The auth middleware returns 401 (not 400) for invalid/expired tokens so the
        // client can treat it as "log out & re-authenticate".
        const res = await request(app)
            .get('/api/auth/me')
            .set('x-auth-token', 'not.a.valid.jwt');
        expect(res.status).toBe(401);
    });

    it('returns the authenticated user (without password) for a valid token', async () => {
        const user = await createTestUser({ email: 'me@iiitnr.ac.in', role: UserRole.FACULTY });
        const token = generateToken(user);
        const res = await request(app)
            .get('/api/auth/me')
            .set('x-auth-token', token);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe('me@iiitnr.ac.in');
        expect(res.body.role).toBe('Faculty');
        expect(res.body.password).toBeUndefined();
    });

    it('returns 404 when the token references a deleted user', async () => {
        const user = await createTestUser({ email: 'ghost@iiitnr.ac.in' });
        const token = generateToken(user);
        await User.findByIdAndDelete(user._id);

        const res = await request(app)
            .get('/api/auth/me')
            .set('x-auth-token', token);
        expect(res.status).toBe(404);
    });
});

describe('POST /api/auth/verify-otp', () => {
    it('activates the account and returns a token for a valid OTP', async () => {
        const user = await createTestUser({ email: 'otp@iiitnr.ac.in', isVerified: false });
        user.otp = '123456';
        user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'otp@iiitnr.ac.in', otp: '123456' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.isVerified).toBe(true);
    });

    it('returns 400 for a wrong OTP', async () => {
        const user = await createTestUser({ email: 'wrongotp@iiitnr.ac.in', isVerified: false });
        user.otp = '111111';
        user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'wrongotp@iiitnr.ac.in', otp: '999999' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it('returns 400 for an expired OTP', async () => {
        const user = await createTestUser({ email: 'expired@iiitnr.ac.in', isVerified: false });
        user.otp = '999999';
        user.otpExpires = new Date(Date.now() - 1000); // 1 second in the past
        await user.save();

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'expired@iiitnr.ac.in', otp: '999999' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it('returns 400 when called on an already-verified account', async () => {
        await createTestUser({ email: 'alreadyverified@iiitnr.ac.in', isVerified: true });
        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'alreadyverified@iiitnr.ac.in', otp: '000000' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already verified/i);
    });
});

describe('POST /api/auth/change-password', () => {
    it('returns 401 when not authenticated', async () => {
        const res = await request(app)
            .post('/api/auth/change-password')
            .send({ newPassword: 'newpass123' });
        expect(res.status).toBe(401);
    });

    it('skips current-password check for mustChangePassword users', async () => {
        const user = await createTestUser({ email: 'firstlogin@iiitnr.ac.in', mustChangePassword: true });
        const token = generateToken(user);
        const res = await request(app)
            .post('/api/auth/change-password')
            .set('x-auth-token', token)
            .send({ newPassword: 'NewSecure456!' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/updated/i);
    });

    it('clears mustChangePassword flag after a successful change', async () => {
        const user = await createTestUser({ email: 'clearflag@iiitnr.ac.in', mustChangePassword: true });
        const token = generateToken(user);
        await request(app)
            .post('/api/auth/change-password')
            .set('x-auth-token', token)
            .send({ newPassword: 'NewSecure456!' });

        const updated = await User.findById(user._id);
        expect(updated?.mustChangePassword).toBe(false);
    });

    it('requires the correct current password for normal users', async () => {
        const user = await createTestUser({ email: 'normaluser@iiitnr.ac.in', password: 'OldPass123' });
        const token = generateToken(user);
        const res = await request(app)
            .post('/api/auth/change-password')
            .set('x-auth-token', token)
            .send({ currentPassword: 'WrongOldPass', newPassword: 'NewPass456!' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/incorrect/i);
    });

    it('rejects a new password shorter than 6 characters', async () => {
        const user = await createTestUser({ email: 'shortpass@iiitnr.ac.in', mustChangePassword: true });
        const token = generateToken(user);
        const res = await request(app)
            .post('/api/auth/change-password')
            .set('x-auth-token', token)
            .send({ newPassword: '12' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/6 characters/i);
    });
});
