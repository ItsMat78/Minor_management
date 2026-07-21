import mongoose, { Document, Schema } from 'mongoose';

export enum UserRole {
    STUDENT = 'Student',
    FACULTY = 'Faculty',
    ADMIN = 'Admin'
}

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    branch?: string;
    rollNumber?: string; // For students
    semester?: number; // For students
    targetBatch?: string; // For students (override batch)
    isVerified: boolean;
    isParticipating: boolean; // True when part of the current semester's minor-project cohort
    mustChangePassword: boolean; // Force change on first login for admin-created / imported accounts
    otp?: string;
    otpExpires?: Date;
    department?: string; // For faculty
    expertise?: string[]; // For faculty
    // For faculty: capacity for the WHOLE semester, summed across every batch they mentor.
    maxStudents?: number; // default 21
    maxGroups?: number; // default 7
    currentStudents: number;
    currentGroups: number;
    /**
     * @deprecated Per-batch capacity overrides. Supervisor limits are now semester-wide
     * totals across all batches, so nothing reads or writes this. Retained only so existing
     * documents keep their data; safe to drop in a later migration.
     */
    batchConfigs?: {
        batchYear: number;
        maxStudents: number;
        maxGroups: number;
    }[];
    photoUrl?: string;
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.STUDENT },
    branch: { type: String },
    rollNumber: { type: String },
    semester: { type: Number },
    targetBatch: { type: String },
    isVerified: { type: Boolean, default: false },
    isParticipating: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    department: { type: String },
    expertise: [{ type: String }],
    maxStudents: { type: Number, default: 21 },
    maxGroups: { type: Number, default: 7 },
    currentStudents: { type: Number, default: 0 },
    currentGroups: { type: Number, default: 0 },
    batchConfigs: [{
        batchYear: Number,
        maxStudents: Number,
        maxGroups: Number
    }],
    photoUrl: { type: String }
}, {
    timestamps: true
});

UserSchema.index({ role: 1, isParticipating: 1 });

export default mongoose.model<IUser>('User', UserSchema);
