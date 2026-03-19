import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Event, { EventType } from '../models/Event';
import User from '../models/User';

const verifyAdminPassword = async (userId: string, passwordToVerify: string) => {
    if (!passwordToVerify) return false;
    const admin = await User.findById(userId);
    if (!admin) return false;
    const isMatch = await bcrypt.compare(passwordToVerify, admin.password);
    return isMatch;
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
        const { type, endDate, extensionDate, batchYear, isActive, password } = req.body;
        const adminId = (req as any).user?.id;

        if (!await verifyAdminPassword(adminId, password)) {
            return res.status(401).json({ message: 'Invalid admin password provided.' });
        }

        if (!type || !endDate) {
            return res.status(400).json({ message: 'Missing required fields: type, endDate' });
        }

        // Validate event type
        if (!Object.values(EventType).includes(type)) {
            return res.status(400).json({ message: 'Invalid event type' });
        }

        const event = new Event({
            type,
            endDate: new Date(endDate),
            extensionDate: extensionDate ? new Date(extensionDate) : undefined,
            batchYear: batchYear || undefined,
            isActive: isActive !== undefined ? isActive : true, // Events start inherently active usually if created like this, but fallback to provided prop
            createdBy: adminId
        });

        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Update an event
export const updateEvent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const adminId = (req as any).user?.id;

        if (!await verifyAdminPassword(adminId, updates.password)) {
            return res.status(401).json({ message: 'Invalid admin password provided.' });
        }

        // Clean out auth components from updates
        delete updates.password;

        if (updates.endDate) updates.endDate = new Date(updates.endDate);
        if (updates.extensionDate) updates.extensionDate = new Date(updates.extensionDate);
        if (updates.extensionDate === null || updates.extensionDate === '') {
            updates.extensionDate = undefined;
        }

        const event = await Event.findByIdAndUpdate(id, updates, { new: true });
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
