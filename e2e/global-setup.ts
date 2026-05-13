/**
 * Runs once before any tests or webServers start.
 * Drops the E2E database and re-seeds it with known test users + an active
 * group-formation event so every test run starts from a clean, predictable state.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ADMIN, FACULTY, STUDENT, UNVERIFIED, FIRST_LOGIN } from './fixtures/users';

const E2E_MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://localhost:27017/minor_management_e2e';

export default async function globalSetup() {
    await mongoose.connect(E2E_MONGO_URI);
    const db = mongoose.connection.db!;

    // Clean slate
    await db.dropDatabase();

    const hash = async (pw: string) => bcrypt.hash(pw, 10);

    // ── Users ────────────────────────────────────────────────────────────────
    await db.collection('users').insertMany([
        {
            name: ADMIN.name,
            email: ADMIN.email,
            password: await hash(ADMIN.password),
            role: 'Admin',
            isVerified: true,
            mustChangePassword: false,
            isParticipating: false,
            currentStudents: 0,
            currentGroups: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: FACULTY.name,
            email: FACULTY.email,
            password: await hash(FACULTY.password),
            role: 'Faculty',
            department: FACULTY.department,
            isVerified: true,
            mustChangePassword: false,
            isParticipating: true,
            currentStudents: 0,
            currentGroups: 0,
            maxStudents: 21,
            maxGroups: 7,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: STUDENT.name,
            email: STUDENT.email,
            password: await hash(STUDENT.password),
            role: 'Student',
            rollNumber: STUDENT.rollNumber,
            branch: 'CSE',
            isVerified: true,
            mustChangePassword: false,
            isParticipating: true,
            currentStudents: 0,
            currentGroups: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: UNVERIFIED.name,
            email: UNVERIFIED.email,
            password: await hash(UNVERIFIED.password),
            role: 'Student',
            rollNumber: UNVERIFIED.rollNumber,
            branch: 'CSE',
            isVerified: false,         // ← triggers OTP screen on login
            mustChangePassword: false,
            isParticipating: false,
            currentStudents: 0,
            currentGroups: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: FIRST_LOGIN.name,
            email: FIRST_LOGIN.email,
            password: await hash(FIRST_LOGIN.password),
            role: 'Student',
            rollNumber: FIRST_LOGIN.rollNumber,
            branch: 'CSE',
            isVerified: true,
            mustChangePassword: true,   // ← triggers forced /change-password redirect
            isParticipating: true,
            currentStudents: 0,
            currentGroups: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ]);

    // ── Active group-formation event ─────────────────────────────────────────
    // Required for the "Form Group" button to appear in the student dashboard.
    const adminUser = await db.collection('users').findOne({ email: ADMIN.email });
    await db.collection('events').insertOne({
        type: 'group_formation_project_proposal',
        isActive: true,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),   // started 1 day ago
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // ends in 30 days
        participatingBatches: ['2023'],
        createdBy: adminUser?._id,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await mongoose.disconnect();
    console.log('[E2E] Database seeded at', E2E_MONGO_URI);
}
