import mongoose, { Document, Schema } from 'mongoose';

export interface IPanel extends Document {
    faculty: mongoose.Types.ObjectId[];
    batchYear: number;
    room?: string;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const PanelSchema: Schema = new Schema({
    faculty: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    batchYear: { type: Number, required: true },
    room: { type: String },
    isArchived: { type: Boolean, default: false }
}, {
    timestamps: true
});

PanelSchema.index({ batchYear: 1, isArchived: 1 });

export default mongoose.model<IPanel>('Panel', PanelSchema);
