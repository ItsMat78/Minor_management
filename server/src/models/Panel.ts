import mongoose, { Document, Schema } from 'mongoose';

export interface IPanel extends Document {
    faculty: mongoose.Types.ObjectId[];
    batchYear: number;
    room?: string;
    // Seed of the draw that produced this panel, so the arrangement can be re-derived
    // from the faculty workloads alone. 0 / absent means the plain deterministic run.
    seed?: number;
    isArchived: boolean;
    archivedSession?: string; // Academic session the panel was archived in, e.g. "Even 2025-26"
    createdAt: Date;
    updatedAt: Date;
}

const PanelSchema: Schema = new Schema({
    faculty: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    batchYear: { type: Number, required: true },
    room: { type: String },
    seed: { type: Number },
    isArchived: { type: Boolean, default: false },
    archivedSession: { type: String }
}, {
    timestamps: true
});

PanelSchema.index({ batchYear: 1, isArchived: 1 });

export default mongoose.model<IPanel>('Panel', PanelSchema);
