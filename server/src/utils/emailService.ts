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

/**
 * Generic email sender
 */
export const sendEmail = async (to: string | string[], subject: string, text: string, html?: string) => {
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
        return true;
    } catch (error) {
        console.error(`[EmailService] Error sending email to ${to}:`, error);
        return false;
    }
};

// ---------------------------------------------------------
// Specialized Email Templates 
// ---------------------------------------------------------

export const sendEventNotificationEmail = async (emails: string[], eventTitle: string, eventType: string, deadline: Date) => {
    const subject = `New Event Scheduled: ${eventTitle}`;
    const text = `A new event "${eventTitle}" of type "${eventType}" has been scheduled. The deadline is ${new Date(deadline).toLocaleString()}. Please log in to the portal for more details.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #4f46e5;">New Event Scheduled</h2>
            <p><strong>Title:</strong> ${eventTitle}</p>
            <p><strong>Type:</strong> ${eventType.replace(/_/g, ' ').toUpperCase()}</p>
            <p><strong>Deadline:</strong> <span style="color: #dc2626; font-weight: bold;">${new Date(deadline).toLocaleString()}</span></p>
            <p>Please log in to the Minor Management Portal for more details.</p>
        </div>
    `;
    await sendEmail(emails, subject, text, html);
};

export const sendGroupCreationEmail = async (emails: string[], groupName: string) => {
    const subject = `Group Formation Started: ${groupName}`;
    const text = `You have started the group "${groupName}". Invitations have been sent to your proposed members. The group will be finalised once all members accept.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #10b981;">Group Formation Started</h2>
            <p>Your group has been created under the name: <strong>${groupName}</strong>.</p>
            <p>We've sent invitations to your proposed members. Your group dashboard will unlock once every member has accepted.</p>
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
