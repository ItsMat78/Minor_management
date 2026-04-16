import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
    name?: string;
    members: mongoose.Types.ObjectId[]; // User IDs (referencing the User model)
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
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    status: { type: String, enum: ['Forming', 'ProposalPending', 'Approved', 'Dissolved'], default: 'Forming' },
    inviteCode: { type: String },
    targetBatch: { type: String },
    isArchived: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Enforce member limit (max 3)
GroupSchema.path('members').validate(function (members: any[]) {
    return members.length <= 3;
}, 'Group cannot have more than 3 members.');

export default mongoose.model<IGroup>('Group', GroupSchema);
