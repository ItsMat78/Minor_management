import crypto from 'crypto';
import AuditLog from '../models/AuditLog';
import User from '../models/User';

/**
 * The audit log's integrity machinery: a stable canonical form, a sha256 hash chain, and a
 * single serialized writer so the chain stays consistent. PM2 runs one fork of the API, so one
 * process owns the tail; the unique index on `seq` is the backstop if that ever stops being true.
 */

// ── canonical form ──────────────────────────────────────────────────────────
// Deep-remove `undefined` (Mongo never stores it, so a read-back would differ), then serialize
// with sorted keys. Writer and verifier both go through this, so the bytes always match.
const prune = (v: any): any => {
    if (Array.isArray(v)) return v.map(prune);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o: any = {};
        for (const k of Object.keys(v)) {
            if (v[k] === undefined) continue;
            o[k] = prune(v[k]);
        }
        return o;
    }
    return v;
};

const canonical = (v: any): string => {
    const x = prune(v);
    const walk = (n: any): string => {
        if (n === null) return 'null';
        if (n instanceof Date) return JSON.stringify(n.toISOString());
        if (typeof n !== 'object') return JSON.stringify(n);
        if (Array.isArray(n)) return '[' + n.map(walk).join(',') + ']';
        const keys = Object.keys(n).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + walk(n[k])).join(',') + '}';
    };
    return walk(x);
};

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** The exact shape that gets hashed. Callable from a fresh entry or a read-back document. */
const bodyOf = (r: any) => ({
    seq: r.seq,
    ts: (r.ts instanceof Date ? r.ts : new Date(r.ts)).toISOString(),
    actor: r.actor ?? null,
    ip: r.ip,
    forwardedFor: r.forwardedFor,
    userAgent: r.userAgent,
    method: r.method,
    path: r.path,
    action: r.action,
    target: r.target ?? null,
    status: r.status,
    durationMs: r.durationMs,
    meta: r.meta,
});

export const GENESIS = 'GENESIS';

/** Recompute a record's hash from its predecessor. Used by both the writer and the verifier. */
export const hashRecord = (prevHash: string, record: any): string =>
    sha256(prevHash + canonical(bodyOf(record)));

// ── serialized writer ───────────────────────────────────────────────────────
let head: { seq: number; hash: string } | null = null;
let queue: Promise<any> = Promise.resolve();

const loadHead = async () => {
    const last = await AuditLog.findOne().sort({ seq: -1 }).select('seq hash').lean();
    head = last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: GENESIS };
};

export interface AuditEntry {
    actor?: { id?: string; name?: string; role?: string; email?: string } | null;
    ip?: string;
    forwardedFor?: string;
    userAgent?: string;
    method: string;
    path: string;
    action?: string;
    target?: { type?: string; id?: string; name?: string } | null;
    status?: number;
    durationMs?: number;
    meta?: any;
}

/**
 * Append one record. Never throws into the caller — a failed audit write must not turn a
 * successful user action into a 500. Returns a promise that resolves once this record is durable,
 * so callers that care (tests, the verifier) can await it; the request path does not.
 */
export const appendAudit = (entry: AuditEntry): Promise<void> => {
    queue = queue.then(async () => {
        try {
            if (!head) await loadHead();
            const seq = head!.seq + 1;
            const prevHash = head!.hash;
            const record = { ...entry, seq, ts: new Date(), actor: entry.actor ?? null, target: entry.target ?? null };
            const hash = hashRecord(prevHash, record);
            await AuditLog.create({ ...record, prevHash, hash });
            head = { seq, hash };
        } catch (err) {
            // Re-read the tail next time so a transient failure can't wedge the chain on a bad seq.
            head = null;
            console.error('[audit] append failed:', err);
        }
    });
    return queue;
};

// ── actor/target name resolution (bounded cache, avoids a DB hit per request) ─
const nameCache = new Map<string, { name?: string; email?: string; role?: string }>();
const NAME_CACHE_MAX = 1000;

export const resolveUser = async (id?: string): Promise<{ name?: string; email?: string; role?: string } | undefined> => {
    if (!id) return undefined;
    const hit = nameCache.get(id);
    if (hit) return hit;
    try {
        const u: any = await User.findById(id).select('name email role').lean();
        const rec = u ? { name: u.name, email: u.email, role: u.role } : {};
        if (nameCache.size >= NAME_CACHE_MAX) nameCache.clear();
        nameCache.set(id, rec);
        return rec;
    } catch {
        return undefined;
    }
};

/**
 * Record an explicit domain event with before/after detail. For controllers that want richer
 * context than the generic middleware captures (e.g. the member list before and after a removal,
 * or a name that will no longer resolve once the row is deleted). Pass JSON-safe values only.
 */
export const recordAudit = async (
    req: any,
    opts: { action: string; target?: { type?: string; id?: string; name?: string }; before?: any; after?: any; meta?: any }
): Promise<void> => {
    const u = req?.user || {};
    await appendAudit({
        actor: u.id ? { id: String(u.id), name: u.name, role: u.role, email: u.email } : null,
        ip: req?.ip,
        forwardedFor: (req?.headers?.['x-forwarded-for'] as string) || undefined,
        userAgent: req?.headers?.['user-agent'],
        method: req?.method,
        path: (req?.originalUrl || req?.url || '').split('?')[0],
        action: opts.action,
        target: opts.target ?? null,
        meta: { ...(opts.meta || {}), before: opts.before, after: opts.after },
    });
};
