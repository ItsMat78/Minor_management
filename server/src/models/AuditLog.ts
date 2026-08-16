import mongoose, { Document, Schema } from 'mongoose';

/**
 * Append-only audit trail. One document per request that reaches Express (and any explicit
 * domain event a controller records). Records are hash-chained: each carries the hash of the
 * one before it, so deleting or editing any row breaks every hash after it — see
 * utils/audit.ts (hashRecord) and adminController.verifyAuditChain.
 *
 * Nothing in the app updates or deletes these rows. The chain makes tampering *detectable*; to
 * make it *survivable* the log still needs to be shipped off-box (see the logging plan). This
 * model is the on-box half.
 */
export interface IAuditLog extends Document {
    seq: number;                 // monotonic, gap = something was deleted
    ts: Date;
    actor: { id?: string; name?: string; role?: string; email?: string } | null; // null = unauthenticated
    ip?: string;                 // req.ip — real client IP only once TRUST_PROXY + nginx XFF are set
    forwardedFor?: string;       // raw X-Forwarded-For, kept verbatim for cross-checking
    userAgent?: string;
    method: string;
    path: string;                // originalUrl without the query string
    action?: string;             // semantic label, e.g. 'group.member.remove'
    target?: { type?: string; id?: string; name?: string } | null; // who/what the action was on
    status?: number;             // HTTP status the client received
    durationMs?: number;
    meta?: any;                  // domain-event extras (before/after) — JSON-safe values only
    prevHash: string;
    hash: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
    seq: { type: Number, required: true, unique: true },
    ts: { type: Date, required: true, default: Date.now },
    // Mixed so what is written is exactly what is read back — the hash chain depends on that
    // byte-for-byte equality, and a typed nested schema would cast/reshape it.
    actor: { type: Schema.Types.Mixed, default: null },
    ip: String,
    forwardedFor: String,
    userAgent: String,
    method: { type: String, required: true },
    path: { type: String, required: true },
    action: String,
    target: { type: Schema.Types.Mixed, default: null },
    status: Number,
    durationMs: Number,
    meta: Schema.Types.Mixed,
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
}, { minimize: false, versionKey: false });

// Query paths for the admin viewer. Indexing Mixed subpaths is fine at the Mongo level.
AuditLogSchema.index({ seq: -1 });
AuditLogSchema.index({ ts: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ 'actor.id': 1 });
AuditLogSchema.index({ 'target.id': 1 });
AuditLogSchema.index({ path: 1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
