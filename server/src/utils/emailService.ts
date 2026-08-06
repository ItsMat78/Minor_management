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
// Presentation helpers (used only inside this module's templates)
// ---------------------------------------------------------

// Base URL for deep links. Defaults to the production portal (the host baked into the CORS
// defaults); override per environment with CLIENT_URL. Trailing slashes are trimmed so
// portalLink('/x') never produces a double slash.
const CLIENT_URL = (process.env.CLIENT_URL || 'https://minor-project.iiitnr.ac.in').replace(/\/+$/, '');
// A monitored mailbox recipients can contact for help (also the reply-to on outbound mail).
const SUPPORT_EMAIL = process.env.EMAIL_REPLY_TO || 'btechminiproject@iiitnr.edu.in';

// Absolute portal link, e.g. portalLink('/dashboard?tab=project').
export const portalLink = (path = ''): string =>
    `${CLIENT_URL}${path ? (path.startsWith('/') ? path : `/${path}`) : ''}`;

interface EmailSection {
    title: string;
    accent?: string;                    // heading + button colour
    lead: string;                       // opening line(s); HTML allowed
    details?: Array<[string, string | undefined]>; // label / value rows (empty values dropped)
    body?: string;                      // extra HTML block after the details
    cta?: { label: string; url: string };
    note?: string;                      // small print (security / context)
}

// One email-client-safe layout (all inline styles) shared by every template, so portal mail
// looks consistent and always carries a working link back to the portal plus a contact.
const renderHtml = (s: EmailSection): string => {
    const accent = s.accent || '#4f46e5';
    const rows = (s.details || [])
        .filter(([, v]) => v != null && `${v}`.trim() !== '')
        .map(([label, value]) => `
            <tr>
                <td style="padding:6px 14px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap;">${label}</td>
                <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${value}</td>
            </tr>`).join('');

    return `
    <div style="background:#f3f4f6;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:${accent};padding:18px 24px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${s.title}</h1>
          <p style="margin:2px 0 0;color:rgba(255,255,255,0.85);font-size:12px;">IIITNR Minor Project Portal</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">${s.lead}</p>
          ${rows ? `<table style="border-collapse:collapse;margin:0 0 16px;width:100%;">${rows}</table>` : ''}
          ${s.body || ''}
          ${s.cta ? `
            <div style="margin:20px 0 8px;">
              <a href="${s.cta.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">${s.cta.label}</a>
            </div>
            <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br>${s.cta.url}</p>
          ` : ''}
          ${s.note ? `<p style="margin:18px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">${s.note}</p>` : ''}
        </div>
        <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;">
            Open the portal: <a href="${portalLink()}" style="color:${accent};">${CLIENT_URL.replace(/^https?:\/\//, '')}</a><br>
            Need help? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${accent};">${SUPPORT_EMAIL}</a>.<br>
            This is an automated message — please do not share any login codes.
          </p>
        </div>
      </div>
    </div>`;
};

// Plain-text footer mirrors the HTML footer so text-only clients keep the link + contact.
const textFooter = (): string =>
    `\n\n—\nOpen the portal: ${portalLink()}\nNeed help? Contact ${SUPPORT_EMAIL}.\nThis is an automated message from the IIITNR Minor Project Portal.`;

// ---------------------------------------------------------
// Specialized Email Templates
// ---------------------------------------------------------

// Sent once, when the final pending invite is accepted and the group is fully formed. Replaces
// the old per-accept notification that mailed every existing member on every acceptance.
export const sendGroupCompleteEmail = async (
    emails: string[],
    groupName: string,
    opts: { batch?: string; memberNames?: string[] } = {}
) => {
    const url = portalLink('/project/propose');
    const members = opts.memberNames?.length ? opts.memberNames.join(', ') : '';
    const subject = `Group "${groupName}" is complete — submit your proposal`;
    const text =
        `All invited members have accepted, so group "${groupName}"${opts.batch ? ` (Batch ${opts.batch})` : ''} is now fully formed and its dashboard is unlocked.\n` +
        (members ? `Members: ${members}.\n` : '') +
        `\nNext step: choose a faculty mentor and submit your project proposal. A proposal must name a mentor to be sent for review; you can also save a draft first.\n` +
        `Submit your proposal: ${url}` + textFooter();
    const html = renderHtml({
        title: 'Group Complete',
        accent: '#10b981',
        lead: 'All invited members have accepted. Your group is now fully formed and its dashboard is unlocked.',
        details: [['Group', groupName], ['Batch', opts.batch], ['Members', members]],
        body: `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">Your next step is to choose a faculty mentor and submit your project proposal. A proposal must name a mentor to be sent for review — you can also save a draft and decide the mentor later.</p>`,
        cta: { label: 'Submit Your Proposal', url },
    });
    await sendEmail(emails, subject, text, html);
};

export const sendGroupInviteEmail = async (
    email: string,
    inviterName: string,
    groupName: string,
    opts: { batch?: string } = {}
) => {
    const url = portalLink('/dashboard?tab=directory');
    const subject = `Group invite: join "${groupName}" for your Minor Project`;
    const text =
        `${inviterName} has invited you to join Minor Project group "${groupName}"${opts.batch ? ` (Batch ${opts.batch})` : ''}.\n\n` +
        `Every invited member must accept before the group's dashboard unlocks and a proposal can be submitted, so please respond soon.\n` +
        `Accept or decline: ${url}` + textFooter();
    const html = renderHtml({
        title: 'Group Invitation',
        accent: '#4f46e5',
        lead: `<strong>${inviterName}</strong> has invited you to join their Minor Project group.`,
        details: [['Group', groupName], ['Batch', opts.batch], ['Invited by', inviterName]],
        body: `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">The group's dashboard unlocks only once <strong>all</strong> invited members accept, so please respond soon.</p>`,
        cta: { label: 'Accept or Decline', url },
    });
    await sendEmail(email, subject, text, html);
};

export const sendGroupInviteResponseEmail = async (
    emails: string[],
    responderName: string,
    groupName: string,
    response: 'accepted' | 'rejected',
    opts: { batch?: string } = {}
) => {
    const accepted = response === 'accepted';
    const accent = accepted ? '#10b981' : '#dc2626';
    const url = portalLink('/dashboard?tab=group');
    const nextLine = accepted
        ? 'Once every invited member accepts, the group is complete and you can submit a proposal.'
        : 'You can invite another classmate from your group page to fill the spot.';
    const subject = `${responderName} ${accepted ? 'accepted' : 'declined'} the invite to "${groupName}"`;
    const text =
        `${responderName} has ${response} your group invitation for "${groupName}"${opts.batch ? ` (Batch ${opts.batch})` : ''}.\n\n` +
        `${nextLine}\nView your group: ${url}` + textFooter();
    const html = renderHtml({
        title: `Invite ${accepted ? 'Accepted' : 'Declined'}`,
        accent,
        lead: `<strong>${responderName}</strong> has <span style="color:${accent};font-weight:700;">${response}</span> the invitation to join <strong>${groupName}</strong>.`,
        details: [['Group', groupName], ['Batch', opts.batch]],
        body: `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${nextLine}</p>`,
        cta: { label: 'View Group', url },
    });
    await sendEmail(emails, subject, text, html);
};

export const sendProposalSubmissionEmail = async (
    emails: string[],
    projectTitle: string,
    groupName: string,
    opts: { batch?: string; memberNames?: string[]; description?: string; tags?: string[] } = {}
) => {
    const url = portalLink('/dashboard?tab=proposals');
    const members = opts.memberNames?.length ? opts.memberNames.join(', ') : '';
    const desc = opts.description
        ? (opts.description.length > 300 ? `${opts.description.slice(0, 300)}…` : opts.description)
        : '';
    const tags = opts.tags?.length ? opts.tags.join(', ') : '';
    const subject = `New proposal to review: "${projectTitle}"`;
    const text =
        `Group "${groupName}"${opts.batch ? ` (Batch ${opts.batch})` : ''} has submitted a project proposal naming you as mentor.\n\n` +
        `Title: ${projectTitle}\n` +
        (members ? `Members: ${members}\n` : '') +
        (tags ? `Tags: ${tags}\n` : '') +
        (desc ? `\nDescription:\n${desc}\n` : '') +
        `\nReview and approve or reject it here: ${url}` + textFooter();
    const html = renderHtml({
        title: 'New Project Proposal',
        accent: '#4f46e5',
        lead: 'A group has submitted a project proposal naming you as mentor. Please review it and approve or reject.',
        details: [['Title', projectTitle], ['Group', groupName], ['Batch', opts.batch], ['Members', members], ['Tags', tags]],
        body: desc
            ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;">
                 <p style="margin:0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Description</p>
                 <p style="margin:6px 0 0;color:#374151;font-size:13px;line-height:1.6;">${desc}</p>
               </div>`
            : '',
        cta: { label: 'Review Proposal', url },
    });
    await sendEmail(emails, subject, text, html);
};

export const sendProposalStatusEmail = async (
    emails: string[],
    projectTitle: string,
    status: 'Approved' | 'Rejected',
    feedback?: string,
    opts: { facultyName?: string; projectId?: string } = {}
) => {
    const approved = status === 'Approved';
    const accent = approved ? '#10b981' : '#dc2626';
    const url = approved
        ? portalLink('/dashboard?tab=project')
        : portalLink(`/project/propose${opts.projectId ? `?edit=${opts.projectId}` : ''}`);
    const nextSteps = approved
        ? 'Your project is now active. You can post progress updates to your mentor and upload your mid-term and end-term deliverables once those evaluation windows open.'
        : "You can revise this proposal and resubmit it for review, or start a new one. Address your mentor's feedback before resubmitting.";
    const subject = `Proposal ${status}: "${projectTitle}"`;
    const text =
        `Your project proposal "${projectTitle}" has been ${status}.\n` +
        (opts.facultyName ? `Mentor: ${opts.facultyName}\n` : '') +
        (feedback ? `\nFeedback from your mentor:\n"${feedback}"\n` : '') +
        `\n${nextSteps}\n` +
        `\n${approved ? 'Open your project' : 'Revise your proposal'}: ${url}` + textFooter();
    const html = renderHtml({
        title: `Proposal ${status}`,
        accent,
        lead: `Your proposal <strong>"${projectTitle}"</strong> has been <span style="color:${accent};font-weight:700;">${status.toUpperCase()}</span>.`,
        details: [['Mentor', opts.facultyName]],
        body:
            (feedback
                ? `<div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:0 0 12px;">
                     <p style="margin:0;color:#374151;font-size:12px;font-weight:700;">Mentor feedback</p>
                     <p style="margin:6px 0 0;color:#4b5563;font-size:13px;line-height:1.6;">${feedback}</p>
                   </div>`
                : '') +
            `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${nextSteps}</p>`,
        cta: { label: approved ? 'Open Your Project' : 'Revise Proposal', url },
    });
    await sendEmail(emails, subject, text, html);
};

/**
 * A progress update was posted on a project's timeline.
 *
 * Deliberately one-directional per post: a student's update notifies only the mentor, and a
 * mentor's update notifies only the group. Nobody is mailed about their own post, and the
 * portal never fans a single update out to everyone involved.
 */
export const sendProjectUpdateEmail = async (
    emails: string[],
    projectTitle: string,
    authorName: string,
    audience: 'mentor' | 'members',
    opts: {
        groupName?: string;
        groupId?: string;
        batch?: string;
        updateTitle?: string;
        content?: string;
        attachmentCount?: number;
        linkCount?: number;
    } = {}
) => {
    if (emails.length === 0) return;

    const toMentor = audience === 'mentor';
    const url = toMentor
        ? portalLink(opts.groupId ? `/faculty/group/${opts.groupId}` : '/dashboard?tab=mentees')
        : portalLink('/dashboard?tab=project');

    const excerpt = opts.content
        ? (opts.content.length > 300 ? `${opts.content.slice(0, 300)}…` : opts.content)
        : '';

    // "2 files, 1 link" — tells the reader whether opening the portal is worth it right now.
    const attached = [
        opts.attachmentCount ? `${opts.attachmentCount} file${opts.attachmentCount === 1 ? '' : 's'}` : '',
        opts.linkCount ? `${opts.linkCount} link${opts.linkCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(', ');

    const lead = toMentor
        ? `<strong>${authorName}</strong> posted a progress update on a project you supervise.`
        : `Your mentor <strong>${authorName}</strong> posted an update on your project timeline.`;
    const subject = toMentor
        ? `Progress update on "${projectTitle}"${opts.groupName ? ` (Group ${opts.groupName})` : ''}`
        : `Your mentor posted an update on "${projectTitle}"`;

    const text =
        (toMentor
            ? `${authorName} posted a progress update on "${projectTitle}"${opts.groupName ? `, group ${opts.groupName}` : ''}.\n`
            : `Your mentor ${authorName} posted an update on your project "${projectTitle}".\n`) +
        (opts.updateTitle ? `\n${opts.updateTitle}\n` : '') +
        (excerpt ? `\n${excerpt}\n` : '') +
        (attached ? `\nAttached: ${attached}\n` : '') +
        `\nRead it on the project timeline: ${url}` + textFooter();

    const html = renderHtml({
        title: 'Project Update',
        accent: '#4f46e5',
        lead,
        details: [
            ['Project', projectTitle],
            ['Group', opts.groupName],
            ['Batch', opts.batch],
            ['Posted by', authorName],
            ['Attached', attached],
        ],
        body: (opts.updateTitle || excerpt)
            ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;">
                 ${opts.updateTitle ? `<p style="margin:0 0 6px;color:#111827;font-size:13px;font-weight:700;">${opts.updateTitle}</p>` : ''}
                 ${excerpt ? `<p style="margin:0;color:#374151;font-size:13px;line-height:1.6;white-space:pre-wrap;">${excerpt}</p>` : ''}
               </div>`
            : '',
        cta: { label: 'Open Project Timeline', url },
    });

    await sendEmail(emails, subject, text, html);
};

/**
 * An admin moved a group to a different supervisor. Sent to three audiences with the same facts
 * but different framing, since "you have a new group" and "this group is no longer yours" are
 * very different messages to open.
 */
export const sendMentorChangeEmail = async (
    emails: string[],
    audience: 'new-mentor' | 'previous-mentor' | 'members',
    opts: {
        projectTitle: string;
        newMentorName: string;
        previousMentorName?: string;
        groupName?: string;
        groupId?: string;
        batch?: string;
        memberNames?: string[];
    }
) => {
    if (emails.length === 0) return;

    const members = opts.memberNames?.length ? opts.memberNames.join(', ') : '';
    const groupLabel = opts.groupName ? `Group ${opts.groupName}` : 'A group';

    const url = audience === 'members'
        ? portalLink('/dashboard?tab=project')
        : portalLink(opts.groupId && audience === 'new-mentor' ? `/faculty/group/${opts.groupId}` : '/dashboard?tab=mentees');

    const copy = {
        'new-mentor': {
            subject: `You are now the mentor for "${opts.projectTitle}"`,
            accent: '#10b981',
            lead: `${groupLabel} has been assigned to you as their faculty mentor by the portal administrator.`,
            note: 'This group now appears in your mentees list, and its evaluation falls to the panel you sit on.',
        },
        'previous-mentor': {
            subject: `"${opts.projectTitle}" has been reassigned to another mentor`,
            accent: '#f59e0b',
            lead: `${groupLabel} is no longer supervised by you. The portal administrator has reassigned them to <strong>${opts.newMentorName}</strong>.`,
            note: 'The group has been removed from your mentees list. Any marks you already recorded for them are preserved.',
        },
        members: {
            subject: `Your Minor Project mentor is now ${opts.newMentorName}`,
            accent: '#4f46e5',
            lead: `The portal administrator has changed your group's faculty mentor to <strong>${opts.newMentorName}</strong>.`,
            note: 'Direct any further questions about your project to your new mentor. Your project details, timeline and uploaded files are unchanged.',
        },
    }[audience];

    const text =
        `${copy.lead.replace(/<[^>]+>/g, '')}\n\n` +
        `Project: ${opts.projectTitle}\n` +
        (opts.groupName ? `Group: ${opts.groupName}\n` : '') +
        (opts.batch ? `Batch: ${opts.batch}\n` : '') +
        `New mentor: ${opts.newMentorName}\n` +
        (opts.previousMentorName ? `Previous mentor: ${opts.previousMentorName}\n` : '') +
        (members ? `Members: ${members}\n` : '') +
        `\n${copy.note}\n` +
        `\nOpen the portal: ${url}` + textFooter();

    const html = renderHtml({
        title: 'Mentor Changed',
        accent: copy.accent,
        lead: copy.lead,
        details: [
            ['Project', opts.projectTitle],
            ['Group', opts.groupName],
            ['Batch', opts.batch],
            ['New mentor', opts.newMentorName],
            ['Previous mentor', opts.previousMentorName],
            ['Members', members],
        ],
        body: `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${copy.note}</p>`,
        cta: { label: audience === 'members' ? 'Open Your Project' : 'Open Your Mentees', url },
    });

    await sendEmail(emails, copy.subject, text, html);
};

/**
 * The group's project details were edited by someone outside the group — their mentor or the
 * admin. Groups own their proposal text, so a change arriving from elsewhere has to be visible
 * rather than silent; the old title is named so they can tell what moved.
 */
export const sendProjectDetailsChangedEmail = async (
    emails: string[],
    opts: {
        previousTitle: string;
        newTitle: string;
        editorName: string;
        editorRole: string;
        changedFields: string[];
    }
) => {
    if (emails.length === 0) return;

    const titleChanged = opts.previousTitle !== opts.newTitle;
    const url = portalLink('/dashboard?tab=project');
    const lead = `Your project details were updated by <strong>${opts.editorName}</strong> (${opts.editorRole}).`;
    const note = 'If this does not look right, reply to your mentor or contact the project office. Your uploaded files, submissions and marks are unchanged.';

    const text =
        `${lead.replace(/<[^>]+>/g, '')}\n\n` +
        (titleChanged ? `Previous title: ${opts.previousTitle}\n` : '') +
        `Project: ${opts.newTitle}\n` +
        `Updated: ${opts.changedFields.join(', ')}\n` +
        `\n${note}\n` +
        `\nOpen the portal: ${url}` + textFooter();

    const html = renderHtml({
        title: 'Project Details Updated',
        accent: '#4f46e5',
        lead,
        details: [
            ['Project', opts.newTitle],
            ['Previous title', titleChanged ? opts.previousTitle : undefined],
            ['Updated', opts.changedFields.join(', ')],
            ['Updated by', `${opts.editorName} (${opts.editorRole})`],
        ],
        body: `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${note}</p>`,
        cta: { label: 'Open Your Project', url },
    });

    await sendEmail(emails, `Your project details were updated by ${opts.editorName}`, text, html);
};

export const sendPanelAssignmentEmail = async (
    emails: string[],
    eventTitle: string,
    opts: { batch?: string; room?: string; members?: string[] } = {}
) => {
    const url = portalLink('/dashboard?tab=mid-term');
    const panel = opts.members?.length ? opts.members.join(', ') : '';
    const subject = `Panel assignment: ${eventTitle}`;
    const text =
        `You have been assigned as a panel evaluator for ${eventTitle}.\n` +
        (opts.batch ? `Batch: ${opts.batch}\n` : '') +
        (opts.room ? `Room: ${opts.room}\n` : '') +
        (panel ? `Panel members: ${panel}\n` : '') +
        `\nWhen the evaluation window opens, your dashboard lists the groups assigned to your panel so you can record marks for each.\n` +
        `Open evaluations: ${url}` + textFooter();
    const html = renderHtml({
        title: 'Panel Evaluator Assignment',
        accent: '#4f46e5',
        lead: `You have been assigned as a <strong>panel evaluator</strong> for ${eventTitle}.`,
        details: [['Batch', opts.batch], ['Room', opts.room], ['Panel members', panel]],
        body: `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">When the evaluation window opens, your dashboard lists the groups assigned to your panel so you can record marks for each. Groups you supervise are graded as the guide; the rest as panel.</p>`,
        cta: { label: 'Open Evaluations', url },
    });
    await sendEmail(emails, subject, text, html);
};
