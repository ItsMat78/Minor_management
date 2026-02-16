import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    groupId: mongoose.Types.ObjectId;
    sender: string; // The name of the sender
    message: string;
    attachments: { name: string; url: string }[];
    timestamp: Date;
}

const MessageSchema: Schema = new Schema({
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    sender: { type: String, required: true },
    message: { type: String, required: true },
    attachments: [
        {
            name: { type: String },
            url: { type: String }
        }
    ],
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<IMessage>('Message', MessageSchema);
