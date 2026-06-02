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
    // 4-digit batch years whose groups must be single-branch this semester. Authoritative
    // when present (even if empty). Legacy events created before this field fall back to the
    // `branchRestricted` boolean (which meant "all participating batches").
    branchRestrictedBatches?: string[];
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
    // default:undefined so legacy events (written before this field) read as undefined and
    // fall back to the boolean; new events always write an explicit array (possibly empty).
    branchRestrictedBatches: { type: [String], default: undefined },
    rubricParams: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

export default mongoose.model<IEvent>('Event', EventSchema);
