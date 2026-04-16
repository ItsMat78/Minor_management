import mongoose, { Document, Schema } from 'mongoose';

export interface IPanel extends Document {
    faculty: mongoose.Types.ObjectId[];
    batchYear: number;
    room?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PanelSchema: Schema = new Schema({
    faculty: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    batchYear: { type: Number, required: true },
    room: { type: String }
}, {
    timestamps: true
});

export default mongoose.model<IPanel>('Panel', PanelSchema);
