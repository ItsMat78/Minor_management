import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
    title: string;
    description: string;
    tags: string[];
    faculty: mongoose.Types.ObjectId; // User ID
    group: mongoose.Types.ObjectId; // Group ID
    status: 'Pending' | 'Approved' | 'Rejected';
    attachments?: string[]; // URLs
    feedback?: string;
    createdAt: Date;
}

const ProjectSchema: Schema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [{ type: String }],
    faculty: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    attachments: [{ type: String }],
    feedback: { type: String }
}, {
    timestamps: true
});

export default mongoose.model<IProject>('Project', ProjectSchema);
