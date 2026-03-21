import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const signup = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role, branch, rollNumber, semester, department, expertise } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const isVerified = role === UserRole.STUDENT; // Auto-verify students

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || UserRole.STUDENT,
            branch,
            rollNumber,
            semester,
            department,
            expertise,
            isVerified
        });

        await newUser.save();

        const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '1d' });

        const userObj = newUser.toObject() as any;
        delete userObj.password;

        res.status(201).json({ token, user: userObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
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

        if (user.isActive === false) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.otp = otp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
            await user.save();
            
            // TODO: Replace with actual email service
            console.log(`[DEV MODE] OTP for ${user.email} is ${otp}`);

            return res.status(200).json({ 
                requiresActivation: true, 
                email: user.email, 
                message: 'Account inactive. OTP sent to your email.' 
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
        
        if (user.isActive) return res.status(400).json({ message: 'User is already active' });
        
        if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        
        user.isActive = true;
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
