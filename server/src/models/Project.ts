import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
    title: string;
    description: string;
    tags: string[];
    faculty: mongoose.Types.ObjectId; // User ID
    group: mongoose.Types.ObjectId; // Group ID
    semester?: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    attachments?: string[]; // URLs
    feedback?: string;
    createdAt: Date;
    updates: {
        title?: string;
        content: string;
        date: Date;
        attachments?: string[];
        links?: string[];
    }[];
    hasNewUpdate: boolean;
}

const ProjectSchema: Schema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [{ type: String }],
    faculty: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional now
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    semester: { type: Number },
    status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
    attachments: [{ type: String }],
    feedback: { type: String },
    updates: [{
        title: { type: String },
        content: { type: String, required: true },
        date: { type: Date, default: Date.now },
        attachments: [{ type: String }],
        links: [{ type: String }]
    }],
    hasNewUpdate: { type: Boolean, default: false } // Flag for faculty notification
}, {
    timestamps: true
});

export default mongoose.model<IProject>('Project', ProjectSchema);
