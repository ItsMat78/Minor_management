import { Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

// What each staff role may do. Admin holds everything; a Coordinator (the yearly minor-project
// coordinator, a separate account the admin creates and later deactivates) runs the semester
// but cannot touch accounts, settings, the archive pipeline or the audit trail.
//
// Keep in sync with client/src/utils/permissions.ts, which hides what the server would refuse.
export const PERMISSIONS = [
    'stats',          // overview dashboard
    'events',         // create / edit / toggle / extend events
    'events.delete',
    'groups',         // view all groups, create groups, edit rosters, set mentors
    'proposals',      // view every proposal, decide / override project status
    'panels',         // create, edit, auto-create, import and export panels
    'evaluations',    // view and enter any group's evaluation, batch templates, final sheets
    'exports',        // evaluation / official / faculty exports, export sessions
    'archive',        // browse the admin archive
    'users',          // create, edit, delete and bulk-import user accounts
    'settings',       // default mentorship limits
    'accounts',       // create admins; create / deactivate coordinators
    'rollover',       // semester rollover
    'snapshot',       // snapshot export / import
    'audit',          // audit log and chain verification
] as const;

export type Permission = typeof PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
    [UserRole.ADMIN]: PERMISSIONS,
    [UserRole.COORDINATOR]: ['stats', 'events', 'groups', 'proposals', 'panels', 'evaluations', 'exports', 'archive'],
};

export const hasPermission = (role: string | undefined, permission: Permission): boolean =>
    !!role && (ROLE_PERMISSIONS[role] || []).includes(permission);

// Staff = anyone with a dashboard-level role (admin or coordinator).
export const isStaff = (role: string | undefined): boolean =>
    role === UserRole.ADMIN || role === UserRole.COORDINATOR;

// Route guard: passes when the caller's role holds the permission. Must run after `auth`.
export const requirePermission = (permission: Permission) => (req: any, res: Response, next: NextFunction) => {
    if (hasPermission(req.user?.role, permission)) return next();
    res.status(403).json({ message: 'Access denied. You do not have permission for this action.' });
};
