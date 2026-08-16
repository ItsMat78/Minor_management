import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User, { IUser, UserRole } from '../models/User';
import { sendEmail, emailOutageMessage, getEmailOutage, EmailFailure } from '../utils/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Portal deep links for OTP mail. Defaults to the production portal (the host in the CORS
// defaults); override with CLIENT_URL per environment.
const PORTAL_URL = (process.env.CLIENT_URL || 'https://minor-project.iiitnr.ac.in').replace(/\/+$/, '');
const LOGIN_URL = `${PORTAL_URL}/login`;
const SUPPORT_EMAIL = process.env.EMAIL_REPLY_TO || 'btechminiproject@iiitnr.edu.in';

// Shared, branded OTP email body (HTML + plain text). Every one-time-code mail carries the
// code, its expiry, a direct link to the sign-in page, a security warning, and a contact.
const otpEmailHtml = (heading: string, otp: string, extraNote = ''): string => `
    <div style="background:#f3f4f6;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#4f46e5;padding:18px 24px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${heading}</h1>
          <p style="margin:2px 0 0;color:rgba(255,255,255,0.85);font-size:12px;">IIITNR Minor Project Portal</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;">Use this one-time code:</p>
          <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#111827;margin:0 0 8px;">${otp}</p>
          <p style="margin:0 0 18px;color:#6b7280;font-size:13px;">This code expires in <strong>10 minutes</strong>. Enter it on the sign-in screen.</p>
          <a href="${LOGIN_URL}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">Open the sign-in page</a>
          <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br>${LOGIN_URL}</p>
          ${extraNote ? `<p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">${extraNote}</p>` : ''}
        </div>
        <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;">
            Never share this code with anyone — portal staff will never ask for it.<br>
            Need help? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#4f46e5;">${SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </div>
    </div>`;

const otpEmailText = (otp: string, extraNote = ''): string =>
    `Your one-time code is: ${otp}\n\n` +
    `This code expires in 10 minutes. Enter it on the sign-in screen: ${LOGIN_URL}\n` +
    (extraNote ? `\n${extraNote}\n` : '') +
    `\nNever share this code with anyone. Need help? Contact ${SUPPORT_EMAIL}.`;

// Local-dev convenience: when LOG_OTP=true, print generated OTPs to the SERVER console so devs
// (where SMTP may be unconfigured) can activate / sign in without a real email. Off by default,
// so production never logs OTPs. Set LOG_OTP=true in server/.env to enable.
const logOtpForDev = (email: string, otp: string, purpose: string) => {
    if (process.env.LOG_OTP === 'true') {
        console.log(`\n  🔑 [DEV OTP] ${purpose} — ${email}: ${otp}\n`);
    }
};

/**
 * Abandon an OTP whose email never went out. The code is persisted before the send, and the
 * 60-second resend cooldown is derived from otpExpires, so leaving it in place would lock the
 * user out of retrying for a code they were never given. Clearing it also invalidates a code
 * that may yet be delivered by a provider retry.
 *
 * Note the wait is reported as `emailRetryAfterSeconds`, deliberately not `retryAfter`: the
 * client feeds `retryAfter` straight into the resend cooldown timer, and a quota outage would
 * hand it a 24-hour value.
 */
const failOtpDelivery = async (res: Response, user: IUser, failure: EmailFailure) => {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return res.status(503).json({
        message: emailOutageMessage(failure),
        emailUnavailable: true,
        emailRetryAfterSeconds: failure.retryAfterSeconds,
    });
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (user.isVerified === false) {
            const otp = crypto.randomInt(100000, 1000000).toString();
            user.otp = otp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
            await user.save();
            logOtpForDev(user.email, otp, 'Account activation');

            const subject = 'Your IIITNR Minor Portal activation code';
            const text = otpEmailText(otp);
            const html = otpEmailHtml('Account Activation', otp);
            const delivery = await sendEmail(user.email, subject, text, html);
            if (!delivery.ok) return failOtpDelivery(res, user, delivery);

            return res.status(200).json({
                requiresActivation: true,
                email: user.email,
                message: 'Account not yet verified. OTP sent to your email.'
            });
        }

        // Attribute this login in the audit trail. The audit middleware records the actor from
        // req.user on response finish, but login is a public route where `auth` never set it — so
        // set it here on success. A failed login (wrong password) never reaches this line and is
        // logged anonymously, which is what we want.
        (req as any).user = { id: String(user._id), role: user.role, name: user.name, email: user.email };
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '1d' });

        const userObj = user.toObject() as any;
        delete userObj.password;

        res.json({ token, user: userObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        // req.user is set by auth middleware
        const user = await User.findById((req as any).user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: 'User not found' });

        if (user.isVerified) return res.status(400).json({ message: 'User is already verified' });

        if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        (req as any).user = { id: String(user._id), role: user.role, name: user.name, email: user.email };
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        const userObj = user.toObject() as any;
        delete userObj.password;

        res.json({ token, user: userObj, message: 'Account activated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// OTP resend — one minute cooldown from the last issued OTP
export const resendOtp = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });
        if (user.isVerified) return res.status(400).json({ message: 'Account already verified' });

        // Cooldown check: OTP is valid 10 minutes, so refuse resend if >9 minutes remain
        if (user.otpExpires) {
            const msUntilExpiry = user.otpExpires.getTime() - Date.now();
            const secondsSinceLastSend = (10 * 60 * 1000 - msUntilExpiry) / 1000;
            if (secondsSinceLastSend < 60) {
                return res.status(429).json({
                    message: 'Please wait before requesting another OTP.',
                    retryAfter: Math.ceil(60 - secondsSinceLastSend)
                });
            }
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        logOtpForDev(user.email, otp, 'OTP resend');

        const subject = 'Your IIITNR Minor Portal activation code (resent)';
        const text = otpEmailText(otp, 'This code was re-sent at your request.');
        const html = otpEmailHtml('Account Activation', otp, 'This code was re-sent at your request.');
        const delivery = await sendEmail(user.email, subject, text, html);
        if (!delivery.ok) return failOtpDelivery(res, user, delivery);

        res.json({ message: 'OTP resent to your email.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        // Checked before the account lookup on purpose. Once the service is known to be down
        // every address must fail identically, otherwise "generic 200" for unknown addresses
        // versus 503 for real ones would turn the outage into an account-enumeration oracle.
        const knownOutage = getEmailOutage();
        if (knownOutage) {
            return res.status(503).json({
                message: emailOutageMessage(knownOutage),
                emailUnavailable: true,
                emailRetryAfterSeconds: knownOutage.retryAfterSeconds,
            });
        }

        const user = await User.findOne({ email });

        // Don't reveal whether an account exists — always return the same generic response.
        if (!user) {
            return res.json({ message: 'If that email is registered, an OTP has been sent.' });
        }

        // 60-second cooldown (same logic as resendOtp)
        if (user.otpExpires) {
            const secondsSinceLastSend = (10 * 60 * 1000 - (user.otpExpires.getTime() - Date.now())) / 1000;
            if (secondsSinceLastSend < 60) {
                return res.status(429).json({
                    message: 'Please wait before requesting another OTP.',
                    retryAfter: Math.ceil(60 - secondsSinceLastSend)
                });
            }
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        logOtpForDev(user.email, otp, 'Password reset / sign-in');

        const subject = 'Your IIITNR Minor Portal sign-in code';
        const resetNote = 'If you did not request this, you can ignore this email — your password will not change.';
        const text = otpEmailText(otp, resetNote);
        const html = otpEmailHtml('Password Reset / Sign-in', otp, resetNote);
        const delivery = await sendEmail(user.email, subject, text, html);
        if (!delivery.ok) return failOtpDelivery(res, user, delivery);

        return res.json({ message: 'If that email is registered, an OTP has been sent.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid request.' });
        }

        if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        user.otp = undefined;
        user.otpExpires = undefined;
        if (!user.isVerified) user.isVerified = true;
        // The user reached this flow because they don't know their password — force them to
        // set a new one (the change-password screen skips the current-password check when this
        // is true). Without this they could never establish a known password again.
        user.mustChangePassword = true;
        await user.save();

        (req as any).user = { id: String(user._id), role: user.role, name: user.name, email: user.email };
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        const userObj = user.toObject() as any;
        delete userObj.password;

        res.json({ token, user: userObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters.' });
        }
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.mustChangePassword) {
            const isMatch = await bcrypt.compare(currentPassword || '', user.password);
            if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.mustChangePassword = false;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
