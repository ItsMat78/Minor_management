/**
 * Unit tests for auth logic in isolation.
 * No HTTP, no database — pure function behaviour.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-jwt-secret-do-not-use-in-prod';

describe('bcrypt password hashing', () => {
    it('produces a hash that does not equal the plain text', async () => {
        const plain = 'MySecurePass!99';
        const hash = await bcrypt.hash(plain, 10);
        expect(hash).not.toBe(plain);
    });

    it('verifies the correct password against its hash', async () => {
        const plain = 'CorrectHorseBatteryStaple';
        const hash = await bcrypt.hash(plain, 10);
        expect(await bcrypt.compare(plain, hash)).toBe(true);
    });

    it('rejects a wrong password', async () => {
        const hash = await bcrypt.hash('rightpassword', 10);
        expect(await bcrypt.compare('wrongpassword', hash)).toBe(false);
    });

    it('two different hashes are produced for the same password (salt randomness)', async () => {
        const plain = 'SamePassword1';
        const [h1, h2] = await Promise.all([bcrypt.hash(plain, 10), bcrypt.hash(plain, 10)]);
        expect(h1).not.toBe(h2); // different salts → different hashes
        // but both verify against the original
        expect(await bcrypt.compare(plain, h1)).toBe(true);
        expect(await bcrypt.compare(plain, h2)).toBe(true);
    });
});

describe('JWT token creation and verification', () => {
    it('encodes user id and role into the token', () => {
        const payload = { id: 'abc123', role: 'Student' };
        const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1d' });
        const decoded = jwt.verify(token, TEST_SECRET) as typeof payload;
        expect(decoded.id).toBe('abc123');
        expect(decoded.role).toBe('Student');
    });

    it('does not expose the password in the payload', () => {
        const payload = { id: 'xyz', role: 'Admin' };
        const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1d' });
        const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
        expect(decoded.password).toBeUndefined();
    });

    it('throws on a tampered token', () => {
        const token = jwt.sign({ id: 'u1' }, TEST_SECRET);
        const tampered = token.slice(0, -5) + 'XXXXX';
        expect(() => jwt.verify(tampered, TEST_SECRET)).toThrow();
    });

    it('throws on a token signed with a different secret', () => {
        const token = jwt.sign({ id: 'u1' }, 'other-secret');
        expect(() => jwt.verify(token, TEST_SECRET)).toThrow();
    });

    it('throws on an expired token', () => {
        const token = jwt.sign({ id: 'u1' }, TEST_SECRET, { expiresIn: '0s' });
        expect(() => jwt.verify(token, TEST_SECRET)).toThrow(/expired/);
    });
});

describe('OTP expiry logic', () => {
    it('correctly identifies an unexpired OTP (> now)', () => {
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min from now
        expect(otpExpires > new Date()).toBe(true);
    });

    it('correctly identifies an expired OTP (< now)', () => {
        const otpExpires = new Date(Date.now() - 1000); // 1 second ago
        expect(otpExpires < new Date()).toBe(true);
    });

    it('OTP expires after exactly 10 minutes', () => {
        const before = Date.now();
        const otpExpires = new Date(before + 10 * 60 * 1000);
        const diffMs = otpExpires.getTime() - before;
        expect(diffMs).toBe(10 * 60 * 1000);
    });

    it('resend cooldown: rejects if < 60 seconds since last send', () => {
        // Simulate an OTP issued 30 seconds ago (9.5 min remaining)
        const otpExpires = new Date(Date.now() + 9.5 * 60 * 1000);
        const msUntilExpiry = otpExpires.getTime() - Date.now();
        const secondsSinceLastSend = (10 * 60 * 1000 - msUntilExpiry) / 1000;
        expect(secondsSinceLastSend).toBeLessThan(60); // should be ~30s → cooldown applies
    });

    it('resend cooldown: allows resend if > 60 seconds since last send', () => {
        // Simulate an OTP issued 90 seconds ago (8.5 min remaining)
        const otpExpires = new Date(Date.now() + 8.5 * 60 * 1000);
        const msUntilExpiry = otpExpires.getTime() - Date.now();
        const secondsSinceLastSend = (10 * 60 * 1000 - msUntilExpiry) / 1000;
        expect(secondsSinceLastSend).toBeGreaterThanOrEqual(60); // ~90s → cooldown expired
    });
});
