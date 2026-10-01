import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserRole, coordinatorIsActive } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export interface AuthRequest extends Request {
    user?: any;
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
        // 401 (not 400) so the client can treat an expired/invalid token as "log out & re-auth".
        return res.status(401).json({ message: 'Token is not valid' });
    }

    // Coordinator accounts are handed over yearly: once deactivated or expired, even a token
    // issued earlier stops working. Only coordinators pay for this lookup.
    if (decoded?.role === UserRole.COORDINATOR) {
        try {
            const u = await User.findById(decoded.id).select('isDeactivated validUntil').lean();
            if (!u || !coordinatorIsActive(u as any)) {
                return res.status(401).json({ message: 'This coordinator account is no longer active' });
            }
        } catch (e) {
            return res.status(500).json({ message: 'Server error' });
        }
    }

    req.user = decoded;
    next();
};

// Full-admin only. Most staff routes use requirePermission (utils/permissions) instead, which
// also admits coordinators where they are allowed.
export const adminAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === UserRole.ADMIN) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};
