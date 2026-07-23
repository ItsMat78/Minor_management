/**
 * Integration tests for /api/events routes.
 *
 * Key design notes:
 * - createEvent / updateEvent / toggleEvent / deleteEvent all require the
 *   admin's plaintext password for a secondary verification step (verifyAdminPassword).
 *   Tests create an admin with a known password and pass it in the request body.
 * - The GROUP_FORMATION event triggers archiving of all active groups, projects,
 *   and panels, plus resets student participation flags.
 */
import request from 'supertest';
import app from '../../app';
import Event, { EventType } from '../../models/Event';
import Group from '../../models/Group';
import User from '../../models/User';
import { createTestUser, generateToken, createTestGroup } from '../helpers/factories';
import { UserRole } from '../../models/User';

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ ok: true }),
    getEmailOutage: jest.fn().mockReturnValue(null),
    emailOutageMessage: jest.fn().mockReturnValue('Email service unavailable'),
    sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupInviteResponseEmail: jest.fn().mockResolvedValue(undefined),
    sendGroupCompleteEmail: jest.fn().mockResolvedValue(undefined),
    sendEventNotificationEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalSubmissionEmail: jest.fn().mockResolvedValue(undefined),
    sendProposalStatusEmail: jest.fn().mockResolvedValue(undefined),
    sendPanelAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

const ADMIN_PASSWORD = 'Password123!';
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

// ── GET /api/events/active ────────────────────────────────────────────────────

describe('GET /api/events/active', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).get('/api/events/active');
        expect(res.status).toBe(401);
    });

    it('returns an empty array when no active events exist', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/events/active')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(0);
    });

    it('returns active events that have started and not yet ended', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: true,
            startDate: new Date(Date.now() - 1000), // started 1s ago
            endDate: new Date(Date.now() + 60 * 60 * 1000), // ends in 1h
            createdBy: student._id,
        });

        const res = await request(app)
            .get('/api/events/active')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('does not return events that have ended', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: true,
            startDate: new Date(Date.now() - 2000),
            endDate: new Date(Date.now() - 1000), // ended 1s ago
            createdBy: student._id,
        });

        const res = await request(app)
            .get('/api/events/active')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

// ── GET /api/events/participating-batches ─────────────────────────────────────

describe('GET /api/events/participating-batches', () => {
    it('returns empty array when no group formation event is active', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/events/participating-batches')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(res.body.participatingBatches).toEqual([]);
    });

    it('returns the participating batches of an active group formation event', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        await Event.create({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            isActive: true,
            startDate: new Date(Date.now() - 1000),
            endDate: new Date(Date.now() + 60 * 60 * 1000),
            participatingBatches: ['2023', '2024'],
            createdBy: student._id,
        });

        const res = await request(app)
            .get('/api/events/participating-batches')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(200);
        expect(res.body.participatingBatches).toEqual(expect.arrayContaining(['2023', '2024']));
    });
});

// ── GET /api/events (admin) ───────────────────────────────────────────────────

describe('GET /api/events', () => {
    it('returns 403 for non-admin users', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .get('/api/events')
            .set('x-auth-token', generateToken(student));
        expect(res.status).toBe(403);
    });

    it('returns all events for admin', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN });
        await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: false,
            startDate: new Date(),
            endDate: new Date(FUTURE_DATE),
            createdBy: admin._id,
        });

        const res = await request(app)
            .get('/api/events')
            .set('x-auth-token', generateToken(admin));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
});

// ── POST /api/events ──────────────────────────────────────────────────────────

describe('POST /api/events', () => {
    it('returns 403 for non-admin users', async () => {
        const student = await createTestUser({ role: UserRole.STUDENT });
        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(student))
            .send({ type: EventType.MID_TERM_EVALUATION, endDate: FUTURE_DATE, password: 'x' });
        expect(res.status).toBe(403);
    });

    it('returns 401 when admin password is wrong', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({ type: EventType.MID_TERM_EVALUATION, endDate: FUTURE_DATE, password: 'WRONGPASSWORD' });
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid admin password/i);
    });

    it('returns 400 when required fields are missing', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({ type: EventType.MID_TERM_EVALUATION, password: ADMIN_PASSWORD }); // missing endDate
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/missing required/i);
    });

    it('returns 400 for an invalid event type', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({ type: 'not_a_real_type', endDate: FUTURE_DATE, password: ADMIN_PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid event type/i);
    });

    it('creates a mid-term evaluation event successfully', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({ type: EventType.MID_TERM_EVALUATION, endDate: FUTURE_DATE, password: ADMIN_PASSWORD });
        expect(res.status).toBe(201);
        expect(res.body.type).toBe(EventType.MID_TERM_EVALUATION);
        expect(res.body.isActive).toBe(true);
    });

    it('requires participatingBatches for GROUP_FORMATION event', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({
                type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
                endDate: FUTURE_DATE,
                password: ADMIN_PASSWORD,
                // participatingBatches missing
            });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/participatingBatches is required/i);
    });

    it('blocks evaluation event creation while group formation is active', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });

        // Create an active group formation event
        await Event.create({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            isActive: true,
            startDate: new Date(Date.now() - 1000),
            endDate: new Date(Date.now() + 60 * 60 * 1000),
            participatingBatches: ['2023'],
            createdBy: admin._id,
        });

        const res = await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({ type: EventType.MID_TERM_EVALUATION, endDate: FUTURE_DATE, password: ADMIN_PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/group formation.*still active/i);
    });

    it('does NOT archive existing groups when a GROUP_FORMATION event is created', async () => {
        // Archiving is intentionally handled by Semester Rollover (POST /api/admin/semester-rollover),
        // not by creating a Group Formation event. Creating a GF event only resets participation flags.
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const { group } = await createTestGroup(1);
        expect(group.isArchived).toBeFalsy();

        await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({
                type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
                endDate: FUTURE_DATE,
                password: ADMIN_PASSWORD,
                participatingBatches: ['2023'],
            });

        const updatedGroup = await Group.findById(group._id);
        expect(updatedGroup!.isArchived).toBeFalsy();
    });

    it('sets isParticipating=true for students in participating batches', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const student23 = await createTestUser({
            role: UserRole.STUDENT,
            rollNumber: '23IT001',
            email: 'p23@t.ac.in',
        });
        const student24 = await createTestUser({
            role: UserRole.STUDENT,
            rollNumber: '24IT001',
            email: 'p24@t.ac.in',
        });

        await request(app)
            .post('/api/events')
            .set('x-auth-token', generateToken(admin))
            .send({
                type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
                endDate: FUTURE_DATE,
                password: ADMIN_PASSWORD,
                participatingBatches: ['2023'], // only 2023 batch
            });

        const updated23 = await User.findById(student23._id);
        const updated24 = await User.findById(student24._id);
        expect(updated23!.isParticipating).toBe(true);
        expect(updated24!.isParticipating).toBe(false);
    });
});

// ── PUT /api/events/:id ───────────────────────────────────────────────────────

describe('PUT /api/events/:id', () => {
    it('updates the deadline of an event', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const event = await Event.create({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            isActive: true,
            startDate: new Date(),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            participatingBatches: ['2024'],
            createdBy: admin._id,
        });

        const newEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
        const res = await request(app)
            .put(`/api/events/${event._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ type: event.type, endDate: newEnd, password: ADMIN_PASSWORD });

        expect(res.status).toBe(200);
        expect(new Date(res.body.endDate).toISOString()).toBe(newEnd);
    });

    it('clears extensionDate when sent as null (regression)', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const event = await Event.create({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            isActive: true,
            startDate: new Date(),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            extensionDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            participatingBatches: ['2024'],
            createdBy: admin._id,
        });

        const res = await request(app)
            .put(`/api/events/${event._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ type: event.type, extensionDate: null, password: ADMIN_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.extensionDate == null).toBe(true);
        const fresh = await Event.findById(event._id).lean() as any;
        expect(fresh.extensionDate).toBeUndefined();
    });

    it('"end early" (endDate=now + cleared extension) expires an event that had an extension', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const student = await createTestUser({ role: UserRole.STUDENT });
        const event = await Event.create({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            isActive: true,
            startDate: new Date(Date.now() - 1000),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            extensionDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            participatingBatches: ['2024'],
            createdBy: admin._id,
        });

        const res = await request(app)
            .put(`/api/events/${event._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ type: event.type, endDate: new Date().toISOString(), extensionDate: null, password: ADMIN_PASSWORD });
        expect(res.status).toBe(200);

        // With the extension gone and endDate now in the past, it must no longer be active.
        const activeRes = await request(app)
            .get('/api/events/active')
            .set('x-auth-token', generateToken(student));
        expect(activeRes.body.find((e: any) => e._id === String(event._id))).toBeUndefined();
    });
});

// ── PUT /api/events/:id/toggle ────────────────────────────────────────────────

describe('PUT /api/events/:id/toggle', () => {
    it('toggles event active state with correct password', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const event = await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: true,
            startDate: new Date(),
            endDate: new Date(FUTURE_DATE),
            createdBy: admin._id,
        });

        const res = await request(app)
            .put(`/api/events/${event._id}/toggle`)
            .set('x-auth-token', generateToken(admin))
            .send({ password: ADMIN_PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.isActive).toBe(false); // was true, now false

        // Toggle again
        const res2 = await request(app)
            .put(`/api/events/${event._id}/toggle`)
            .set('x-auth-token', generateToken(admin))
            .send({ password: ADMIN_PASSWORD });
        expect(res2.body.isActive).toBe(true);
    });

    it('returns 401 with wrong password', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const event = await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: true,
            startDate: new Date(),
            endDate: new Date(FUTURE_DATE),
            createdBy: admin._id,
        });

        const res = await request(app)
            .put(`/api/events/${event._id}/toggle`)
            .set('x-auth-token', generateToken(admin))
            .send({ password: 'wrongpassword' });
        expect(res.status).toBe(401);
    });
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────

describe('DELETE /api/events/:id', () => {
    it('deletes an event with correct admin password', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const event = await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: false,
            startDate: new Date(),
            endDate: new Date(FUTURE_DATE),
            createdBy: admin._id,
        });

        const res = await request(app)
            .delete(`/api/events/${event._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ password: ADMIN_PASSWORD });
        expect(res.status).toBe(200);
        expect(await Event.findById(event._id)).toBeNull();
    });

    it('returns 401 when password is wrong', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const event = await Event.create({
            type: EventType.MID_TERM_EVALUATION,
            isActive: false,
            startDate: new Date(),
            endDate: new Date(FUTURE_DATE),
            createdBy: admin._id,
        });

        const res = await request(app)
            .delete(`/api/events/${event._id}`)
            .set('x-auth-token', generateToken(admin))
            .send({ password: 'wrong' });
        expect(res.status).toBe(401);
        expect(await Event.findById(event._id)).not.toBeNull(); // not deleted
    });

    it('returns 404 for a non-existent event', async () => {
        const admin = await createTestUser({ role: UserRole.ADMIN, password: ADMIN_PASSWORD });
        const fakeId = '000000000000000000000000';
        const res = await request(app)
            .delete(`/api/events/${fakeId}`)
            .set('x-auth-token', generateToken(admin))
            .send({ password: ADMIN_PASSWORD });
        expect(res.status).toBe(404);
    });
});
