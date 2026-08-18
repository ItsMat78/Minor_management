import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { appendAudit, resolveUser } from '../utils/audit';

/**
 * Logs every request that reaches Express. Registered once, app-wide, before the routers. It
 * reads the outcome from res.on('finish'), which runs after the route handler — so by then
 * req.user (set by the per-router `auth`) is populated for authenticated calls, and the full
 * status is known. Unauthenticated hits are logged too, with actor = null.
 *
 * Two things make a row answer "what did they do", not just "what did they open":
 *  - RULES below name the route, so a row reads `project.status.decide` rather than
 *    `PUT /api/projects/68f…/status`. Every mutating route has an entry.
 *  - For writes, a redacted copy of the request body (and any uploaded filenames) is recorded
 *    in meta.request — the decision itself, not merely that a decision was made. Secrets are
 *    stripped by key name; see SECRET_KEY. Rich before/after detail still belongs in explicit
 *    controller calls to recordAudit().
 */

// method + path → semantic label, and (for user-scoped routes) the capture group holding the
// target user id. Order matters: first match wins, so put the more specific route first.
const RULES: Array<{ m: string; re: RegExp; action: string; targetUser?: boolean }> = [
    // ── writes ──────────────────────────────────────────────────────────────
    // Groups
    { m: 'DELETE', re: /^\/api\/groups\/[^/]+\/members\/([^/?]+)/, action: 'group.member.remove', targetUser: true },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/members(?:\?|$|\/)/, action: 'group.member.add' },
    { m: 'POST',   re: /^\/api\/groups\/leave/,                     action: 'group.member.leave' },
    { m: 'POST',   re: /^\/api\/groups\/admin/,                     action: 'group.create.admin' },
    { m: 'PUT',    re: /^\/api\/groups\/[^/]+\/mentor/,             action: 'group.mentor.set' },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/cancel-invite/,      action: 'group.invite.cancel' },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/invite/,             action: 'group.invite.send' },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/accept/,             action: 'group.invite.accept' },
    { m: 'POST',   re: /^\/api\/groups\/[^/]+\/reject/,             action: 'group.invite.reject' },
    { m: 'PUT',    re: /^\/api\/groups\/[^/]+/,                     action: 'group.update' },
    { m: 'POST',   re: /^\/api\/groups(?:[/?]|$)/,                  action: 'group.create' },

    // Projects / proposals
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/admin-status/,        action: 'project.status.adminOverride' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/status/,              action: 'project.status.decide' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/details/,             action: 'project.details.update' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/updates\/read/,       action: 'project.updates.markRead' },
    { m: 'POST',   re: /^\/api\/projects\/[^/]+\/updates/,             action: 'project.update.post' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/submissions/,         action: 'project.submission.upload' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/student-evaluations/, action: 'project.evaluation.perStudent' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/student-feedback/,    action: 'project.feedback.perStudent' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/evaluation/,          action: 'project.evaluation.submit' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+\/feedback/,            action: 'project.feedback.add' },
    { m: 'DELETE', re: /^\/api\/projects\/([^/?]+)/,                   action: 'project.delete' },
    { m: 'PUT',    re: /^\/api\/projects\/[^/]+/,                      action: 'project.update' },
    { m: 'POST',   re: /^\/api\/projects(?:[/?]|$)/,                   action: 'project.proposal.submit' },

    // Users — own profile first, so self-service edits are not read as an admin editing someone.
    { m: 'PUT',    re: /^\/api\/users\/me/,                        action: 'user.profile.selfUpdate' },
    { m: 'POST',   re: /^\/api\/users\/profile-photo/,             action: 'user.photo.set' },
    { m: 'DELETE', re: /^\/api\/users\/profile-photo/,             action: 'user.photo.remove' },
    { m: 'POST',   re: /^\/api\/users\/import-preview/,            action: 'users.import.preview' },
    { m: 'POST',   re: /^\/api\/users\/import-commit/,             action: 'users.import.commit' },
    { m: 'DELETE', re: /^\/api\/users\/([^/?]+)/,                  action: 'user.delete', targetUser: true },
    { m: 'PUT',    re: /^\/api\/users\/([^/?]+)/,                  action: 'user.update', targetUser: true },

    // Admin
    { m: 'POST',   re: /^\/api\/admin\/create-user/,               action: 'user.create' },
    { m: 'POST',   re: /^\/api\/admin\/create/,                    action: 'admin.create' },
    { m: 'POST',   re: /^\/api\/admin\/semester-rollover/,         action: 'admin.semesterRollover' },
    { m: 'PUT',    re: /^\/api\/admin\/default-faculty-limits/,    action: 'admin.facultyLimits.set' },

    // Panels & evaluation
    { m: 'POST',   re: /^\/api\/panels\/upload\/preview/,            action: 'panel.import.preview' },
    { m: 'POST',   re: /^\/api\/panels\/admin-eval-batch-import/,    action: 'panel.evaluation.batchImport' },
    { m: 'POST',   re: /^\/api\/panels\/[^/]+\/evaluation-import/,   action: 'panel.evaluation.import' },
    { m: 'DELETE', re: /^\/api\/panels\/[^/]+/,                      action: 'panel.delete' },
    { m: 'PUT',    re: /^\/api\/panels\/[^/]+/,                      action: 'panel.update' },
    { m: 'POST',   re: /^\/api\/panels(?:[/?]|$)/,                   action: 'panel.create' },

    // Events (deadline windows — these gate what everyone else is allowed to do)
    { m: 'PUT',    re: /^\/api\/events\/[^/]+\/toggle/,            action: 'event.toggle' },
    { m: 'DELETE', re: /^\/api\/events\/[^/]+/,                    action: 'event.delete' },
    { m: 'PUT',    re: /^\/api\/events\/[^/]+/,                    action: 'event.update' },
    { m: 'POST',   re: /^\/api\/events(?:[/?]|$)/,                 action: 'event.create' },

    // Bulk import / restore
    { m: 'POST',   re: /^\/api\/import\/excel\/preview/,           action: 'import.excel.preview' },
    { m: 'POST',   re: /^\/api\/import\/excel\/commit/,            action: 'import.excel.commit' },
    { m: 'POST',   re: /^\/api\/import\/snapshot\/preview/,        action: 'import.snapshot.preview' },
    { m: 'POST',   re: /^\/api\/import\/snapshot\/commit/,         action: 'import.snapshot.commit' },

    // Auth. Specific before general: verify-forgot-password-otp also starts with 'verify'.
    { m: 'POST',   re: /^\/api\/auth\/login/,                      action: 'auth.login' },
    { m: 'POST',   re: /^\/api\/auth\/verify-forgot-password-otp/, action: 'auth.passwordReset.verifyOtp' },
    { m: 'POST',   re: /^\/api\/auth\/verify/,                     action: 'auth.verifyOtp' },
    { m: 'POST',   re: /^\/api\/auth\/resend-otp/,                 action: 'auth.resendOtp' },
    { m: 'POST',   re: /^\/api\/auth\/forgot-password/,            action: 'auth.passwordReset.request' },
    { m: 'POST',   re: /^\/api\/auth\/change-password/,            action: 'auth.changePassword' },

    // ── reads ───────────────────────────────────────────────────────────────
    // Exports first: bulk extraction of student data is the read worth spotting in a list.
    { m: 'GET', re: /^\/api\/users\/students\/export/,        action: 'students.export' },
    { m: 'GET', re: /^\/api\/users\/faculty\/export/,         action: 'faculty.export' },
    { m: 'GET', re: /^\/api\/panels\/export-evaluations/,     action: 'panels.exportEvaluations' },
    { m: 'GET', re: /^\/api\/panels\/export-official/,        action: 'panels.exportOfficial' },
    { m: 'GET', re: /^\/api\/panels\/export-template/,        action: 'panels.exportTemplate' },
    { m: 'GET', re: /^\/api\/panels\/export/,                 action: 'panels.export' },
    { m: 'GET', re: /^\/api\/panels\/admin-eval-batch-final/, action: 'panels.exportBatchFinal' },
    { m: 'GET', re: /^\/api\/panels\/[^/]+\/export-final/,    action: 'panels.exportPanelFinal' },
    { m: 'GET', re: /^\/api\/import\/snapshot\/export/,       action: 'import.snapshot.export' },
    { m: 'GET', re: /^\/api\/admin\/export-sessions/,         action: 'admin.exportSessions' },

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
    { m: 'GET', re: /^\/api\/panels\/my-panels/,           action: 'panels.mine' },
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

// ── request detail ──────────────────────────────────────────────────────────
// A redacted copy of what was sent. This is the difference between knowing that someone called
// PUT /projects/x/status and knowing that they rejected it, and with what comment.

/** Key names whose values are never recorded, whatever the route. Matched anywhere in the key. */
const SECRET_KEY = /pass|otp|token|secret|credential|authorization|cookie|session/i;
const REDACTED = '[redacted]';
const MAX_STRING = 300;   // long free text (feedback, descriptions) is truncated, not dropped
const MAX_ARRAY = 20;
const MAX_DEPTH = 4;
const MAX_JSON = 4000;    // whole-body ceiling; a snapshot-import body runs to megabytes

/**
 * Copy a value into something safe to store: secrets removed, size bounded, and keys Mongo would
 * reject ('.' or a leading '$') dropped. Dropping those matters beyond storage — the hash chain
 * verifies by re-serializing what was read back, so a key Mongo would reshape on write would
 * later read as tampering.
 */
const sanitize = (v: any, depth = 0): any => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') return v.length > MAX_STRING ? v.slice(0, MAX_STRING) + `…(+${v.length - MAX_STRING} chars)` : v;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (depth >= MAX_DEPTH) return '[…]';
    if (Array.isArray(v)) {
        const head = v.slice(0, MAX_ARRAY).map(x => sanitize(x, depth + 1));
        if (v.length > MAX_ARRAY) head.push(`…(+${v.length - MAX_ARRAY} more)`);
        return head;
    }
    if (typeof v !== 'object') return undefined;   // functions, symbols
    const out: any = {};
    for (const k of Object.keys(v)) {
        if (k.includes('.') || k.startsWith('$')) continue;
        out[k] = SECRET_KEY.test(k) ? REDACTED : sanitize(v[k], depth + 1);
    }
    return out;
};

/** The request body, sanitized — or undefined when there is nothing worth recording. */
const bodyDetail = (body: any): any => {
    if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) return undefined;
    if (Object.keys(body).length === 0) return undefined;
    const clean = sanitize(body);
    // Cheaper to overshoot and then measure than to thread a running byte count through sanitize.
    if (JSON.stringify(clean).length > MAX_JSON) {
        return { tooLarge: true, fields: Object.keys(body).slice(0, 40) };
    }
    return clean;
};

/** Uploaded files, from whichever multer shape the route used. Names only — never contents. */
const fileDetail = (req: any): any => {
    const list: any[] = [];
    if (req.file) list.push(req.file);
    if (Array.isArray(req.files)) list.push(...req.files);
    else if (req.files && typeof req.files === 'object') {
        for (const k of Object.keys(req.files)) list.push(...(req.files[k] || []));
    }
    if (!list.length) return undefined;
    return list.slice(0, MAX_ARRAY).map(f => ({ field: f.fieldname, name: f.originalname, size: f.size }));
};

export const auditMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const started = Date.now();

    // Snapshot the JSON body now, before a controller can mutate req.body. Multipart bodies are
    // still empty at this point — multer runs inside the router — so those get picked up on
    // finish instead. GETs carry no body worth recording.
    const isWrite = req.method !== 'GET' && req.method !== 'HEAD';
    const bodyAtEntry = isWrite ? bodyDetail(req.body) : undefined;

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

            let meta: any;
            if (isWrite) {
                const body = bodyAtEntry ?? bodyDetail(req.body);
                const files = fileDetail(req);
                if (body || files) meta = { request: { body, files } };
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
                meta,
            });
        })();
    });

    next();
};
