import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a reusable transporter object using the default SMTP transport
// Falls back to a generic config if .env vars are missing
export const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'minor_project_admin@example.com', 
        pass: process.env.EMAIL_PASS || 'your_password', 
    },
});

export type EmailFailureReason = 'quota' | 'throttled' | 'auth' | 'connection' | 'unknown';

export type EmailFailure = { ok: false; reason: EmailFailureReason; retryAfterSeconds?: number };
export type EmailResult = { ok: true } | EmailFailure;

const QUOTA_WINDOW_SECONDS = 24 * 60 * 60;

// How long an observed failure is assumed to still be in effect. After this much time we
// forget it and let the next real send discover whether the provider has recovered.
const OUTAGE_ASSUMED_SECONDS: Record<EmailFailureReason, number> = {
    quota: QUOTA_WINDOW_SECONDS,
    throttled: 5 * 60,
    connection: 60,
    auth: 10 * 60,
    unknown: 10 * 60,
};

// Remembered so callers can (a) tell users roughly how long to wait and (b) respond
// identically for registered and unregistered addresses while the service is down.
let outage: { reason: EmailFailureReason; since: Date } | null = null;

/**
 * Nodemailer reports SMTP rejections as a numeric `responseCode` plus the raw `response`
 * text, and socket-level problems as `code`. Gmail signals an exhausted daily allowance
 * with `550 5.4.5 Daily user sending limit exceeded`.
 */
const classifyFailure = (error: any): EmailFailureReason => {
    const response = `${error?.response || error?.message || ''}`;
    const responseCode: number | undefined = error?.responseCode;
    const code = `${error?.code || ''}`;

    if (/5\.4\.5|sending (limit|quota) exceeded|daily (user )?sending/i.test(response)) return 'quota';
    if (responseCode === 421 || responseCode === 454 || /4\.7\.0|try again later/i.test(response)) return 'throttled';
    if (code === 'EAUTH' || responseCode === 535) return 'auth';
    if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET'].includes(code)) return 'connection';
    return 'unknown';
};

const retryAfterFor = (reason: EmailFailureReason): number | undefined => {
    // Broken credentials will not fix themselves; there is no useful wait to quote.
    if (reason === 'auth') return undefined;
    const elapsed = outage ? (Date.now() - outage.since.getTime()) / 1000 : 0;
    const remaining = OUTAGE_ASSUMED_SECONDS[reason] - elapsed;
    return remaining > 0 ? Math.ceil(remaining) : undefined;
};

/**
 * The failure currently believed to be in effect, or null if the service is healthy or the
 * last failure is old enough that it is worth retrying. Clears stale state as a side effect.
 */
export const getEmailOutage = (): EmailFailure | null => {
    if (!outage) return null;
    const elapsed = (Date.now() - outage.since.getTime()) / 1000;
    if (elapsed >= OUTAGE_ASSUMED_SECONDS[outage.reason]) {
        outage = null;
        return null;
    }
    return { ok: false, reason: outage.reason, retryAfterSeconds: retryAfterFor(outage.reason) };
};

const formatWait = (seconds?: number): string => {
    if (!seconds) return 'later';
    if (seconds < 90) return 'in about a minute';
    if (seconds < 60 * 60) return `in about ${Math.round(seconds / 60)} minutes`;
    const hours = Math.round(seconds / 3600);
    return `in about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
};

/**
 * User-facing explanation for a failed send. Quota waits are deliberately hedged: the SMTP
 * rejection carries no retry-after and Gmail's cap is a rolling 24h window, not a fixed
 * daily reset, so the figure is an upper-bound estimate rather than a promise.
 */
export const emailOutageMessage = (failure: EmailFailure): string => {
    if (failure.reason === 'auth') {
        return 'Email service is misconfigured and cannot send right now. Please contact the portal administrator.';
    }
    if (failure.reason === 'quota') {
        return `The portal has reached its daily email limit, so no code could be sent. Please try again ${formatWait(failure.retryAfterSeconds)}, or contact the portal administrator if you need access sooner.`;
    }
    return `Email service is temporarily unavailable, so no code could be sent. Please try again ${formatWait(failure.retryAfterSeconds)}.`;
};

/**
 * Generic email sender. Never throws: callers that care about delivery must inspect `ok`.
 */
export const sendEmail = async (to: string | string[], subject: string, text: string, html?: string): Promise<EmailResult> => {
    try {
        const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@minor-management.edu';
        const replyTo = process.env.EMAIL_REPLY_TO;
        const mailOptions: any = {
            from: `"Minor Project Management" <${fromAddress}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            text,
            html: html || text,
        };
        if (replyTo) mailOptions.replyTo = replyTo;

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Sent to ${to}: ${info.messageId}`);
        outage = null;
        return { ok: true };
    } catch (error) {
        const reason = classifyFailure(error);
        // Keep the original timestamp while the same failure persists so the quoted wait
        // counts down instead of resetting on every attempt.
        if (!outage || outage.reason !== reason) {
            outage = { reason, since: new Date() };
        }
        console.error(`[EmailService] Error sending email to ${to} (${reason}):`, error);
        return { ok: false, reason, retryAfterSeconds: retryAfterFor(reason) };
    }
};

// ---------------------------------------------------------
// Specialized Email Templates 
// ---------------------------------------------------------

// Sent once, when the final pending invite is accepted and the group is fully formed. Replaces
// the old per-accept notification that mailed every existing member on every acceptance.
export const sendGroupCompleteEmail = async (emails: string[], groupName: string) => {
    const subject = `Your group "${groupName}" is now complete`;
    const text = `All invited members have accepted. Your group "${groupName}" is now fully formed and its dashboard is unlocked. Log in to the portal to submit your project proposal.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #10b981;">Group Complete</h2>
            <p>All invited members have accepted. Your group <strong>${groupName}</strong> is now fully formed and its dashboard is unlocked.</p>
            <p>Log in to the Minor Management Portal to submit your project proposal.</p>
        </div>
    `;
    await sendEmail(emails, subject, text, html);
};

export const sendGroupInviteEmail = async (email: string, inviterName: string, groupName: string) => {
    const subject = `You have been invited to group "${groupName}"`;
    const text = `${inviterName} has invited you to join their Minor Project group "${groupName}". Log in to the portal to accept or decline.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #4f46e5;">Group Invitation</h2>
            <p><strong>${inviterName}</strong> has invited you to join the group <strong>${groupName}</strong>.</p>
            <p>Please log in to the Minor Management Portal to accept or decline this invite. The group dashboard will only unlock once all members accept.</p>
        </div>
    `;
    await sendEmail(email, subject, text, html);
};

export const sendGroupInviteResponseEmail = async (emails: string[], responderName: string, groupName: string, response: 'accepted' | 'rejected') => {
    const color = response === 'accepted' ? '#10b981' : '#dc2626';
    const subject = `${responderName} has ${response} the invite to "${groupName}"`;
    const text = `${responderName} has ${response} your group invitation for "${groupName}".`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: ${color};">Group Invite ${response === 'accepted' ? 'Accepted' : 'Declined'}</h2>
            <p><strong>${responderName}</strong> has <span style="color:${color};font-weight:bold">${response}</span> the invite for group <strong>${groupName}</strong>.</p>
            <p>Log in to the portal to view the current group status.</p>
        </div>
    `;
    await sendEmail(emails, subject, text, html);
};

export const sendProposalSubmissionEmail = async (emails: string[], projectTitle: string, groupName: string) => {
    const subject = `New Project Proposal: ${projectTitle}`;
    const text = `Group "${groupName}" has submitted a new project proposal titled "${projectTitle}". Please log in to the portal to review and approve/reject it.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #4f46e5;">New Project Proposal Submitted</h2>
            <p><strong>Group:</strong> ${groupName}</p>
            <p><strong>Title:</strong> ${projectTitle}</p>
            <p>Please log in to the Minor Management Portal to review this proposal.</p>
        </div>
    `;
    await sendEmail(emails, subject, text, html);
};

export const sendProposalStatusEmail = async (emails: string[], projectTitle: string, status: 'Approved' | 'Rejected', feedback?: string) => {
    const subject = `Project Proposal ${status}: ${projectTitle}`;
    const color = status === 'Approved' ? '#10b981' : '#dc2626';
    const text = `Your project proposal "${projectTitle}" has been ${status}. ${feedback ? 'Feedback: ' + feedback : ''}`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>Project Proposal Status Update</h2>
            <p>Your proposal for <strong>"${projectTitle}"</strong> has been <span style="font-weight: bold; color: ${color};">${status.toUpperCase()}</span>.</p>
            ${feedback ? `
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <p style="margin: 0; font-weight: bold; color: #374151;">Faculty Feedback:</p>
                    <p style="margin-top: 5px; color: #4b5563;">${feedback}</p>
                </div>
            ` : ''}
            <p>Please log in to view further details.</p>
        </div>
    `;
    await sendEmail(emails, subject, text, html);
};

export const sendPanelAssignmentEmail = async (emails: string[], eventTitle: string) => {
    const subject = `Panel Evaluator Assignment: ${eventTitle}`;
    const text = `You have been assigned as a panel evaluator for "${eventTitle}". Please check your dashboard for the list of groups.`;
    await sendEmail(emails, subject, text);
};
