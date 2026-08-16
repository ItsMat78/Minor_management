import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { appendAudit, resolveUser } from '../utils/audit';

/**
 * Logs every request that reaches Express. Registered once, app-wide, before the routers. It
 * reads the outcome from res.on('finish'), which runs after the route handler — so by then
 * req.user (set by the per-router `auth`) is populated for authenticated calls, and the full
 * status is known. Unauthenticated hits are logged too, with actor = null.
 *
 * Request bodies are deliberately NOT logged here: they carry passwords and OTPs. Rich
 * before/after detail belongs in explicit controller calls to recordAudit(), which pass only
 * safe fields.
 */

// method + path → semantic label, and (for user-scoped routes) the capture group holding the
// target user id. Order matters: first match wins, so put the more specific route first.
const RULES: Array<{ m: string; re: RegExp; action: string; targetUser?: boolean }> = [
    { m: 'DELETE', re: /^\/api\/groups\/[^/]+\/members\/([^/?]+)/, action: 'group.member.remove', targetUser: true },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/members(?:\?|$|\/)/, action: 'group.member.add' },
    { m: 'POST',   re: /^\/api\/groups\/leave/,                     action: 'group.member.leave' },
    { m: 'POST',   re: /^\/api\/groups\/admin/,                     action: 'group.create.admin' },
    { m: 'PUT',    re: /^\/api\/groups\/[^/]+\/mentor/,             action: 'group.mentor.set' },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/invite/,             action: 'group.invite' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/admin-status/,     action: 'project.status.adminOverride' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/status/,           action: 'project.status.decide' },
    { m: 'DELETE', re: /^\/api\/projects\/([^/?]+)/,                action: 'project.delete' },
    { m: 'DELETE', re: /^\/api\/users\/([^/?]+)/,                   action: 'user.delete', targetUser: true },
    { m: 'PUT',    re: /^\/api\/users\/([^/?]+)/,                   action: 'user.update', targetUser: true },
    { m: 'POST',   re: /^\/api\/admin\/create-user/,               action: 'user.create' },
    { m: 'POST',   re: /^\/api\/admin\/create/,                    action: 'admin.create' },
    { m: 'POST',   re: /^\/api\/admin\/semester-rollover/,         action: 'admin.semesterRollover' },
    { m: 'POST',   re: /^\/api\/auth\/login/,                       action: 'auth.login' },
    { m: 'POST',   re: /^\/api\/auth\/verify/,                      action: 'auth.verifyOtp' },
];

const match = (method: string, path: string) => {
    for (const r of RULES) {
        if (r.m !== method) continue;
        const m = r.re.exec(path);
        if (m) return { action: r.action, targetUser: r.targetUser, capturedId: m[1] };
    }
    return undefined;
};

export const auditMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const started = Date.now();

    res.on('finish', () => {
        // Fire-and-forget: the response is already sent; an audit failure must not affect it.
        void (async () => {
            const path = (req.originalUrl || req.url || '').split('?')[0];
            const rule = match(req.method, path);

            const u: any = req.user || {};
            let actor: any = u.id ? { id: String(u.id), name: u.name, role: u.role, email: u.email } : null;
            // Tokens minted before this change carry no name/email — fill from the cache so every
            // authenticated entry still names a person.
            if (actor && !actor.name) {
                const r = await resolveUser(actor.id);
                if (r) {
                    actor.name = r.name;
                    actor.role = actor.role || r.role;
                    actor.email = actor.email || r.email;
                }
            }

            let target: any = null;
            if (rule?.targetUser && rule.capturedId) {
                const r = await resolveUser(rule.capturedId);
                // On user.delete the row is already gone, so name may be undefined — the id is
                // still recorded. recordAudit() in the controller captures the name pre-delete.
                target = { type: 'user', id: rule.capturedId, name: r?.name };
            }

            await appendAudit({
                actor,
                ip: req.ip,
                forwardedFor: (req.headers['x-forwarded-for'] as string) || undefined,
                userAgent: req.headers['user-agent'],
                method: req.method,
                path,
                action: rule?.action || `${req.method} ${path}`,
                target,
                status: res.statusCode,
                durationMs: Date.now() - started,
            });
        })();
    });

    next();
};
