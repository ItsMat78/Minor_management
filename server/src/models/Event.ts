import mongoose, { Document, Schema } from 'mongoose';

export enum EventType {
    GROUP_FORMATION_AND_PROJECT_PROPOSAL = 'group_formation_project_proposal',
    MID_TERM_EVALUATION = 'mid_term_evaluation',
    END_TERM_EVALUATION = 'end_term_evaluation'
}

export interface IEvent extends Document {
    type: EventType;
    isActive: boolean;
    startDate: Date;
    endDate: Date;
    extensionDate?: Date;
    batchYear?: string;
    participatingBatches?: string[];
    branchRestricted?: boolean;
    rubricParams?: any;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const EventSchema: Schema = new Schema({
    type: {
        type: String,
        enum: Object.values(EventType),
        required: true
    },
    isActive: { type: Boolean, default: false },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    extensionDate: { type: Date },
    batchYear: { type: String },
    participatingBatches: [{ type: String }],
    branchRestricted: { type: Boolean, default: false },
    rubricParams: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

export default mongoose.model<IEvent>('Event', EventSchema);
