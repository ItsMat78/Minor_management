import mongoose, { Document, Schema } from 'mongoose';

// Global, singleton-style settings for the portal.
// Holds the default mentorship limits applied to faculty and the project-details lock.
export interface ISettings extends Document {
    key: string; // always 'global'
    defaultMaxStudents: number;
    defaultMaxGroups: number;
    // When on, groups can no longer change their project's title / description (and the rest of
    // its details). Set from Setup Events; see utils/evaluationLock.
    projectDetailsLocked: boolean;
}

const SettingsSchema: Schema = new Schema({
    key: { type: String, default: 'global', unique: true },
    defaultMaxStudents: { type: Number, default: 21 },
    defaultMaxGroups: { type: Number, default: 7 },
    projectDetailsLocked: { type: Boolean, default: false },
}, {
    timestamps: true
});

const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);

// Fetch the single global settings document, creating it with defaults if absent.
export const getGlobalSettings = async (): Promise<ISettings> => {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
        settings = await Settings.create({ key: 'global' });
    }
    return settings;
};

export default Settings;
