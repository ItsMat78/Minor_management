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

    // Reads — friendly labels for the common ones. Order specific → general (first match wins);
    // anything unmatched still logs as a plain `GET <path>`.
    { m: 'GET', re: /^\/api\/auth\/me/,                    action: 'session.check' },
    { m: 'GET', re: /^\/api\/admin\/audit\/verify/,        action: 'audit.verify' },
    { m: 'GET', re: /^\/api\/admin\/audit/,                action: 'audit.view' },
    { m: 'GET', re: /^\/api\/admin\/stats/,                action: 'admin.stats' },
    { m: 'GET', re: /^\/api\/admin\/archive/,              action: 'admin.archive' },
    { m: 'GET', re: /^\/api\/groups\/my\/invites/,         action: 'group.myInvites' },
    { m: 'GET', re: /^\/api\/groups\/mentees/,             action: 'group.mentees' },
    { m: 'GET', re: /^\/api\/groups\/my/,                  action: 'group.viewMine' },
    { m: 'GET', re: /^\/api\/groups(?:[/?]|$)/,            action: 'groups.list' },
    { m: 'GET', re: /^\/api\/users\/students/,             action: 'students.list' },
    { m: 'GET', re: /^\/api\/users\/faculty/,              action: 'faculty.list' },
    { m: 'GET', re: /^\/api\/projects\/admin\/proposals/,  action: 'proposals.list' },
    { m: 'GET', re: /^\/api\/projects\/faculty/,           action: 'projects.faculty' },
    { m: 'GET', re: /^\/api\/projects\/archived/,          action: 'projects.archived' },
    { m: 'GET', re: /^\/api\/projects(?:[/?]|$)/,          action: 'projects.list' },
    { m: 'GET', re: /^\/api\/events\/active/,              action: 'events.active' },
    { m: 'GET', re: /^\/api\/events/,                      action: 'events.list' },
    { m: 'GET', re: /^\/api\/panels/,                      action: 'panels.view' },
    { m: 'GET', re: /^\/uploads\//,                        action: 'file.download' },
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
