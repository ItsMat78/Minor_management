import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';
import { sendEmail } from '../utils/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.otp = otp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
            await user.save();

            const subject = 'Your IIITNR Minor Portal Activation OTP';
            const text = `Your OTP to activate your account is: ${otp}\n\nThis code expires in 10 minutes.`;
            const html = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2 style="color: #4f46e5;">Account Activation</h2>
                    <p>Use the following OTP to activate your Minor Project Portal account:</p>
                    <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</p>
                    <p style="color: #6b7280;">This code expires in <strong>10 minutes</strong>.</p>
                </div>
            `;
            sendEmail(user.email, subject, text, html).catch(err =>
                console.error(`[AuthController] Failed to send OTP email to ${user.email}:`, err)
            );

            return res.status(200).json({
                requiresActivation: true,
                email: user.email,
                message: 'Account not yet verified. OTP sent to your email.'
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        const userObj = user.toObject() as any;
        delete userObj.password;

        res.json({ token, user: userObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
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
        res.status(500).json({ message: 'Server error', error });
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

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        const userObj = user.toObject() as any;
        delete userObj.password;

        res.json({ token, user: userObj, message: 'Account activated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
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

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const subject = 'Your IIITNR Minor Portal Activation OTP';
        const text = `Your OTP to activate your account is: ${otp}\n\nThis code expires in 10 minutes.`;
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #4f46e5;">Account Activation (Resent)</h2>
                <p>Use the following OTP to activate your Minor Project Portal account:</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</p>
                <p style="color: #6b7280;">This code expires in <strong>10 minutes</strong>.</p>
            </div>
        `;
        sendEmail(user.email, subject, text, html).catch(err =>
            console.error(`[AuthController] Failed to resend OTP to ${user.email}:`, err)
        );

        res.json({ message: 'OTP resent to your email.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
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
        res.status(500).json({ message: 'Server error', error });
    }
};
