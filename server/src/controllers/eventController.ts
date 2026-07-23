import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Event, { EventType } from '../models/Event';
import User from '../models/User';
import Group from '../models/Group';
import Project from '../models/Project';
import Panel from '../models/Panel';
import { getGlobalSettings } from '../models/Settings';

const verifyAdminPassword = async (userId: string, passwordToVerify: string) => {
    if (!passwordToVerify) return false;
    const admin = await User.findById(userId);
    if (!admin) return false;
    const isMatch = await bcrypt.compare(passwordToVerify, admin.password);
    return isMatch;
};

// Normalize the per-batch branch clustering: keep only entries for batches that are actually
// branch-restricted, clean each cluster (uppercase/trim/dedupe branch codes), and drop entries
// that don't actually relax the single-branch rule (i.e. every cluster is a singleton) so the
// default single-branch behaviour stays represented by the absence of an entry.
const normalizeBranchRestrictionGroups = (raw: any, restrictedBatches: string[]): { batch: string; clusters: string[] }[] => {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set(restrictedBatches.map(String));
    const out: { batch: string; clusters: string[] }[] = [];
    for (const entry of raw) {
        const batch = String(entry?.batch ?? '').trim();
        if (!allowed.has(batch)) continue;
        const clustersRaw = Array.isArray(entry?.clusters) ? entry.clusters : [];
        const clusters = clustersRaw
            .map((c: any) => {
                const branches = String(c).split(',').map(b => b.trim().toUpperCase()).filter(Boolean);
                return Array.from(new Set(branches)); // dedupe within a cluster
            })
            .filter((c: string[]) => c.length > 0)
            .map((c: string[]) => c.join(','));
        // Only persist if at least one cluster groups 2+ branches; otherwise it's just single-branch.
        if (clusters.some((c: string) => c.includes(','))) {
            out.push({ batch, clusters });
        }
    }
    return out;
};

// Return the participating batches of the currently active Group Formation event.
// Accessible to all authenticated users so dropdowns can filter correctly.
export const getParticipatingBatchesHandler = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const event = await Event.findOne({
            type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
            isActive: true,
            startDate: { $lte: now },
            $or: [
                { extensionDate: { $exists: true, $ne: null, $gte: now } },
                { extensionDate: { $exists: false }, endDate: { $gte: now } },
                { extensionDate: null, endDate: { $gte: now } }
            ]
        }).lean();
        res.json({ participatingBatches: event?.participatingBatches ?? [] });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};


// Get all events (optionally filter by batchYear)
export const getEvents = async (req: Request, res: Response) => {
    try {
        const { batchYear } = req.query;
        const filter: any = {};
        if (batchYear && batchYear !== 'All') {
            filter.batchYear = batchYear;
        }
        const events = await Event.find(filter).sort({ createdAt: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get currently active events (for banners - accessible by all authenticated users)
export const getActiveEvents = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const events = await Event.find({
            isActive: true,
            startDate: { $lte: now },
            $or: [
                { extensionDate: { $exists: true, $gte: now } },
                { extensionDate: { $exists: false }, endDate: { $gte: now } },
                { extensionDate: null, endDate: { $gte: now } }
            ]
        }).sort({ startDate: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Create a new event
export const createEvent = async (req: Request, res: Response) => {
    try {
        const { type, endDate, extensionDate, batchYear, password, rubricParams, participatingBatches, defaultMaxStudents, defaultMaxGroups, branchRestrictedBatches, branchRestrictionGroups } = req.body;
        const adminId = (req as any).user?.id;

        if (!await verifyAdminPassword(adminId, password)) {
            return res.status(401).json({ message: 'Invalid admin password provided.' });
        }

        if (!type || !endDate) {
            return res.status(400).json({ message: 'Missing required fields: type, endDate' });
        }

        if (extensionDate && new Date(extensionDate) <= new Date(endDate)) {
            return res.status(400).json({ message: 'Extension date must be after the deadline (end date).' });
        }

        // Validate event type
        if (!Object.values(EventType).includes(type)) {
            return res.status(400).json({ message: 'Invalid event type' });
        }

        // Block mid-term / end-term creation if group formation is still active
        if (type === EventType.MID_TERM_EVALUATION || type === EventType.END_TERM_EVALUATION) {
            const now = new Date();
            const activeGroupFormation = await Event.findOne({
                type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL,
                isActive: true,
                startDate: { $lte: now },
                $or: [
                    { extensionDate: { $exists: true, $ne: null, $gte: now } },
                    { extensionDate: { $exists: false }, endDate: { $gte: now } },
                    { extensionDate: null, endDate: { $gte: now } }
                ]
            });
            if (activeGroupFormation) {
                return res.status(400).json({
                    message: 'Cannot create an evaluation event while a Group Formation event is still active. Close or deactivate the Group Formation event first.'
                });
            }
        }

        // Participation reset for Group Formation (archiving is handled by Semester Rollover)
        let normalizedBatches: string[] | undefined;
        let normalizedRestrictedBatches: string[] = [];
        let normalizedBranchGroups: { batch: string; clusters: string[] }[] = [];
        if (type === EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL) {
            if (!Array.isArray(participatingBatches) || participatingBatches.length === 0) {
                return res.status(400).json({
                    message: 'participatingBatches is required for Group Formation events. Select at least one batch that will participate this semester.'
                });
            }
            normalizedBatches = participatingBatches
                .map((b: any) => String(b).trim())
                .filter((b: string) => /^\d{4}$/.test(b));
            if (normalizedBatches.length === 0) {
                return res.status(400).json({ message: 'participatingBatches must contain 4-digit year strings (e.g. "2024").' });
            }

            // Branch-restricted batches must be a subset of the participating batches.
            normalizedRestrictedBatches = Array.isArray(branchRestrictedBatches)
                ? branchRestrictedBatches.map((b: any) => String(b).trim()).filter((b: string) => normalizedBatches!.includes(b))
                : [];
            normalizedBranchGroups = normalizeBranchRestrictionGroups(branchRestrictionGroups, normalizedRestrictedBatches);

            // Reset student participation, then flip on for selected batches
            await User.updateMany(
                { role: 'Student' },
                { $set: { isParticipating: false } }
            );
            const prefixes = normalizedBatches.map(b => b.slice(-2));
            const prefixRegex = new RegExp(`^(${prefixes.join('|')})`);
            await User.updateMany(
                {
                    role: 'Student',
                    $or: [
                        // Students moved INTO a participating batch (droppers).
                        { targetBatch: { $in: normalizedBatches } },
                        // Original cohort by roll prefix, but NOT those moved out to a
                        // different (non-selected) batch. $in:[null,...] also matches missing.
                        {
                            rollNumber: { $regex: prefixRegex },
                            targetBatch: { $in: [null, '', ...normalizedBatches] }
                        }
                    ]
                },
                { $set: { isParticipating: true } }
            );

            // Set the semester's default mentorship limits. These become the global
            // defaults (inherited by faculty created later this semester) and are
            // applied to every existing faculty member now.
            const normalizeLimit = (val: any, fallback: number): number => {
                if (val === undefined || val === null || val === '') return fallback;
                const n = Number(val);
                if (!Number.isFinite(n) || n < 0) return fallback;
                return Math.floor(n);
            };
            const settings = await getGlobalSettings();
            settings.defaultMaxStudents = normalizeLimit(defaultMaxStudents, settings.defaultMaxStudents);
            settings.defaultMaxGroups = normalizeLimit(defaultMaxGroups, settings.defaultMaxGroups);
            await settings.save();

            await User.updateMany(
                { role: 'Faculty' },
                { $set: { maxStudents: settings.defaultMaxStudents, maxGroups: settings.defaultMaxGroups } }
            );
        }

        const newEvent = new Event({
            type,
            endDate: new Date(endDate),
            extensionDate: extensionDate ? new Date(extensionDate) : undefined,
            batchYear: batchYear || undefined,
            participatingBatches: normalizedBatches,
            branchRestrictedBatches: type === EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL ? normalizedRestrictedBatches : [],
            branchRestrictionGroups: type === EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL ? normalizedBranchGroups : undefined,
            // Legacy boolean kept in sync (derived) so older read paths still work.
            branchRestricted: type === EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL ? normalizedRestrictedBatches.length > 0 : false,
            isActive: true,
            rubricParams,
            createdBy: adminId
        });

        await newEvent.save();

        // No email blast on event creation: it addressed every participating student in a single
        // send, which exhausts the daily quota in one call and leaks the full recipient list.
        // Students see new events via the in-app event banner on login instead.
        res.status(201).json(newEvent);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Update an event
export const updateEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { password, ...updates } = req.body; // Extract password and keep the rest in updates
        const adminId = (req as any).user?.id;

        if (!await verifyAdminPassword(adminId, password)) {
            return res.status(401).json({ message: 'Invalid admin password provided.' });
        }

        if (updates.endDate) updates.endDate = new Date(updates.endDate);

        // Clearing extensionDate must use $unset. Assigning `undefined` is silently dropped by
        // findByIdAndUpdate, so the old extension would survive — which both breaks "remove
        // extension" and makes "end event early" look broken (effectiveEnd = extensionDate ||
        // endDate, so a stale future extension keeps the event alive even after endDate is now).
        const clearExtension = updates.extensionDate === null || updates.extensionDate === '';
        if (clearExtension) {
            delete updates.extensionDate;
        } else if (updates.extensionDate) {
            updates.extensionDate = new Date(updates.extensionDate);
        }

        // An extension must fall after the deadline. Compare against the new endDate if it's part of
        // this update, otherwise the event's existing endDate.
        if (!clearExtension && updates.extensionDate) {
            const endRef = updates.endDate ?? (await Event.findById(id).select('endDate').lean())?.endDate;
            if (endRef && new Date(updates.extensionDate) <= new Date(endRef)) {
                return res.status(400).json({ message: 'Extension date must be after the deadline (end date).' });
            }
        }

        // Keep the per-batch branch clustering consistent with the (possibly updated) restricted
        // batch list. When branchRestrictedBatches isn't part of this update, allow the groups'
        // own batches through so an edit that only touches clustering still saves.
        if ('branchRestrictionGroups' in updates) {
            const allowedBatches = Array.isArray(updates.branchRestrictedBatches)
                ? updates.branchRestrictedBatches.map((b: any) => String(b).trim())
                : (Array.isArray(updates.branchRestrictionGroups) ? updates.branchRestrictionGroups.map((g: any) => String(g?.batch ?? '').trim()) : []);
            updates.branchRestrictionGroups = normalizeBranchRestrictionGroups(updates.branchRestrictionGroups, allowedBatches);
        }

        const updateOps: any = { $set: updates };
        if (clearExtension) updateOps.$unset = { extensionDate: 1 };

        const event = await Event.findByIdAndUpdate(id, updateOps, { new: true });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Toggle event active status
export const toggleEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user?.id;
        const { password } = req.body;

        if (!await verifyAdminPassword(adminId, password)) {
            return res.status(401).json({ message: 'Invalid admin password provided.' });
        }

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        event.isActive = !event.isActive;
        await event.save();
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Delete an event
export const deleteEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user?.id;
        const { password } = req.body;

        if (!await verifyAdminPassword(adminId, password)) {
            return res.status(401).json({ message: 'Invalid admin password provided.' });
        }

        const event = await Event.findByIdAndDelete(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
