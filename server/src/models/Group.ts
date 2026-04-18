import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
    name?: string;
    members: mongoose.Types.ObjectId[]; // Accepted members (creator + those who accepted)
    pendingMembers: mongoose.Types.ObjectId[]; // Invited but not yet responded
    createdBy?: mongoose.Types.ObjectId; // The student who initiated the group
    project?: mongoose.Types.ObjectId; // Project ID
    status: 'Forming' | 'ProposalPending' | 'Approved' | 'Dissolved';
    inviteCode?: string;
    createdAt: Date;
    targetBatch?: string;
    isArchived?: boolean;
}

const GroupSchema: Schema = new Schema({
    name: { type: String },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pendingMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    status: { type: String, enum: ['Forming', 'ProposalPending', 'Approved', 'Dissolved'], default: 'Forming' },
    inviteCode: { type: String },
    targetBatch: { type: String },
    isArchived: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Enforce total member limit (accepted + pending must be <= 3)
GroupSchema.pre('validate', function (this: IGroup, next: any) {
    const total = (this.members?.length || 0) + (this.pendingMembers?.length || 0);
    if (total > 3) {
        return next(new Error('Group (accepted + pending) cannot exceed 3 members.'));
    }
    next();
});

export default mongoose.model<IGroup>('Group', GroupSchema);
