import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User, { IUser, UserRole } from '../../models/User';
import Group, { IGroup } from '../../models/Group';
import Project, { IProject } from '../../models/Project';

interface CreateUserOptions {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    isVerified?: boolean;
    mustChangePassword?: boolean;
    rollNumber?: string;
    targetBatch?: string;
    department?: string;
}

export async function createTestUser(overrides: CreateUserOptions = {}): Promise<IUser> {
    const plainPassword = overrides.password ?? 'Password123!';
    const hash = await bcrypt.hash(plainPassword, 10);

    const user = new User({
        name: overrides.name ?? 'Test User',
        email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@iiitnr.ac.in`,
        password: hash,
        role: overrides.role ?? UserRole.STUDENT,
        isVerified: overrides.isVerified !== undefined ? overrides.isVerified : true,
        mustChangePassword: overrides.mustChangePassword ?? false,
        rollNumber: overrides.rollNumber,
        targetBatch: overrides.targetBatch,
        department: overrides.department,
    });

    return user.save();
}

// Read JWT_SECRET lazily (inside function body) so it picks up the value set in jestSetup.ts
export function generateToken(user: IUser): string {
    const secret = process.env.JWT_SECRET || 'secret';
    return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
}

interface CreateGroupResult {
    group: IGroup;
    members: IUser[];
}

// Creates a group with `memberCount` accepted members (all students with roll numbers)
export async function createTestGroup(memberCount = 1): Promise<CreateGroupResult> {
    const members: IUser[] = [];
    for (let i = 0; i < memberCount; i++) {
        members.push(
            await createTestUser({
                email: `member-${i}-${Date.now()}@iiitnr.ac.in`,
                rollNumber: `23IT${String(i + 1).padStart(3, '0')}`,
            })
        );
    }

    const group = new Group({
        name: `TestGroup-${Date.now()}`,
        members: members.map(m => m._id),
        createdBy: members[0]._id,
        status: 'Forming',
        inviteCode: 'TESTCODE',
    });

    await group.save();
    return { group, members };
}

interface CreateProjectOptions {
    title?: string;
    description?: string;
    status?: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
    faculty?: mongoose.Types.ObjectId | string;
}

// Creates a project attached to an existing group
export async function createTestProject(
    groupId: mongoose.Types.ObjectId | string,
    overrides: CreateProjectOptions = {}
): Promise<IProject> {
    const project = new Project({
        title: overrides.title ?? 'Test Project',
        description: overrides.description ?? 'A test project description',
        tags: ['test'],
        group: groupId,
        faculty: overrides.faculty ?? null,
        status: overrides.status ?? 'Draft',
    });

    return project.save();
}
