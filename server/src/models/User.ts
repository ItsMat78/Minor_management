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
    isVerified: boolean;
    department?: string; // For faculty
    expertise?: string[]; // For faculty
    maxStudents?: number; // For faculty, default 21
    maxGroups?: number; // For faculty, default 7
    currentStudents: number;
    currentGroups: number;
    batchConfigs?: {
        batchYear: number;
        maxStudents: number;
        maxGroups: number;
    }[];
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
    isVerified: { type: Boolean, default: false },
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
    }]
}, {
    timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);
