const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
    __esModule: true,
    default: { createTransport: () => ({ sendMail: mockSendMail }) },
}));

// Imported after the mock so createTransport() is stubbed at module load.
import { sendEmail, getEmailOutage, emailOutageMessage } from '../../utils/emailService';

/** Shape of the rejection nodemailer produces for an SMTP refusal. */
const smtpError = (responseCode: number, response: string) =>
    Object.assign(new Error(response), { responseCode, response });

const socketError = (code: string) => Object.assign(new Error(code), { code });

describe('emailService failure reporting', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        // Clear any outage remembered by a previous test.
        mockSendMail.mockResolvedValue({ messageId: 'reset' });
        await sendEmail('reset@example.com', 's', 't');
    });

    it('reports success without an outage', async () => {
        mockSendMail.mockResolvedValue({ messageId: 'abc' });

        expect(await sendEmail('a@example.com', 's', 't')).toEqual({ ok: true });
        expect(getEmailOutage()).toBeNull();
    });

    it('classifies a Gmail daily quota rejection as quota', async () => {
        mockSendMail.mockRejectedValue(
            smtpError(550, '550-5.4.5 Daily user sending limit exceeded. Learn more at...')
        );

        const result = await sendEmail('a@example.com', 's', 't');

        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ reason: 'quota' });
        // Quoted wait is bounded by the 24h rolling window.
        expect((result as any).retryAfterSeconds).toBeGreaterThan(23 * 60 * 60);
        expect((result as any).retryAfterSeconds).toBeLessThanOrEqual(24 * 60 * 60);
    });

    it('classifies throttling and transient socket errors separately', async () => {
        mockSendMail.mockRejectedValue(smtpError(421, '421 4.7.0 Try again later'));
        expect(await sendEmail('a@example.com', 's', 't')).toMatchObject({ reason: 'throttled' });

        mockSendMail.mockRejectedValue(socketError('ETIMEDOUT'));
        expect(await sendEmail('a@example.com', 's', 't')).toMatchObject({ reason: 'connection' });
    });

    it('classifies bad credentials as auth and quotes no wait', async () => {
        mockSendMail.mockRejectedValue(socketError('EAUTH'));

        const result = await sendEmail('a@example.com', 's', 't');

        expect(result).toMatchObject({ reason: 'auth' });
        expect((result as any).retryAfterSeconds).toBeUndefined();
        expect(emailOutageMessage(result as any)).toMatch(/administrator/i);
    });

    it('remembers the outage so callers can respond uniformly, and clears it on success', async () => {
        mockSendMail.mockRejectedValue(smtpError(550, '5.4.5 Daily user sending limit exceeded'));
        await sendEmail('a@example.com', 's', 't');

        expect(getEmailOutage()).toMatchObject({ ok: false, reason: 'quota' });

        mockSendMail.mockResolvedValue({ messageId: 'recovered' });
        await sendEmail('a@example.com', 's', 't');

        expect(getEmailOutage()).toBeNull();
    });

    it('counts the quoted wait down rather than resetting it on each attempt', async () => {
        mockSendMail.mockRejectedValue(smtpError(550, '5.4.5 Daily user sending limit exceeded'));

        const first: any = await sendEmail('a@example.com', 's', 't');
        jest.useFakeTimers().setSystemTime(Date.now() + 60 * 60 * 1000);
        const second: any = await sendEmail('a@example.com', 's', 't');
        jest.useRealTimers();

        expect(second.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds - 3000);
    });

    it('phrases the quota message with an approximate wait', () => {
        const message = emailOutageMessage({ ok: false, reason: 'quota', retryAfterSeconds: 7200 });

        expect(message).toMatch(/daily email limit/i);
        expect(message).toMatch(/about 2 hours/i);
    });
});
