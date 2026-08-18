import React, { useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import api from '../utils/api';
import { errorMessage } from '../utils/apiError';
import { useAuth } from '../context/AuthContext';

interface ProfilePhotoUploadProps {
    /** Classes for the photo itself. */
    className?: string;
    /** Classes for the initial-letter fallback. Falls back to `className` when omitted. */
    fallbackClassName?: string;
    /**
     * Show the "Remove photo" control under the avatar once one is set. Off by default: the
     * compact avatars this renders elsewhere (the mentor card, for one) have no room for a
     * caption, and removal belongs on the profile page anyway.
     */
    allowRemove?: boolean;
}

/**
 * The signed-in user's own photo, with the controls to replace or remove it.
 *
 * Every role uses the same endpoints (POST/DELETE /users/profile-photo, which have never been
 * role-gated), but only faculty had UI for the upload — a student's avatar was always their
 * initial because there was nowhere to upload one, not because they hadn't.
 *
 * Refreshes the user through AuthContext rather than reloading the page, which the two hand-rolled
 * copies of this did: a full reload on a dashboard this size throws away all the fetched tab state
 * to update one image.
 */
const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({ className, fallbackClassName, allowRemove }) => {
    const { user, refreshUser } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState('');

    const busy = uploading || removing;

    const onPick = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('photo', file);
            await api.post('/users/profile-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            await refreshUser();
        } catch (err) {
            // The server names the real reason — wrong format, or over the 2MB cap — and both are
            // things the person can act on, so show it rather than a generic failure.
            setError(errorMessage(err, 'Could not upload that photo.'));
        } finally {
            setUploading(false);
        }
    };

    const onRemove = async () => {
        if (!window.confirm('Remove your profile photo? Your initial will be shown instead.')) return;
        setRemoving(true);
        setError('');
        try {
            await api.delete('/users/profile-photo');
            await refreshUser();
        } catch (err) {
            setError(errorMessage(err, 'Could not remove that photo.'));
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="inline-flex flex-col items-center">
            <div className="relative inline-block">
                <Avatar
                    name={user?.name}
                    photoUrl={user?.photoUrl}
                    className={className}
                    fallbackClassName={fallbackClassName}
                />
                <label
                    className={`absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-1.5 shadow-md transition-colors ${busy ? 'opacity-70' : 'cursor-pointer hover:bg-indigo-700'}`}
                    title="Upload a profile photo"
                >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={busy}
                        className="hidden"
                        onChange={e => {
                            onPick(e.target.files?.[0]);
                            // Clear the input so picking the same file again still fires onChange.
                            e.target.value = '';
                        }}
                    />
                </label>
            </div>

            {allowRemove && user?.photoUrl && (
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={busy}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-red-600 disabled:opacity-60 disabled:hover:text-neutral-500 transition-colors"
                >
                    {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {removing ? 'Removing…' : 'Remove photo'}
                </button>
            )}

            {error && (
                <p className="mt-3 max-w-xs text-center text-xs text-red-600 leading-relaxed">{error}</p>
            )}
        </div>
    );
};

export default ProfilePhotoUpload;
