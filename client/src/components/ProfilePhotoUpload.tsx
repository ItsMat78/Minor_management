import React, { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import Avatar from './Avatar';
import api from '../utils/api';
import { errorMessage } from '../utils/apiError';
import { useAuth } from '../context/AuthContext';

interface ProfilePhotoUploadProps {
    /** Classes for the photo itself. */
    className?: string;
    /** Classes for the initial-letter fallback. Falls back to `className` when omitted. */
    fallbackClassName?: string;
}

/**
 * The signed-in user's own photo, with the control to replace it.
 *
 * Every role uses the same endpoint (POST /users/profile-photo, which has never been role-gated),
 * but only faculty had UI for it — a student's avatar was always their initial because there was
 * nowhere to upload one, not because they hadn't.
 *
 * Refreshes the user through AuthContext rather than reloading the page, which the two hand-rolled
 * copies of this did: a full reload on a dashboard this size throws away all the fetched tab state
 * to update one image.
 */
const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({ className, fallbackClassName }) => {
    const { user, refreshUser } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

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
                    className={`absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-1.5 shadow-md transition-colors ${uploading ? 'opacity-70' : 'cursor-pointer hover:bg-indigo-700'}`}
                    title="Upload a profile photo"
                >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={uploading}
                        className="hidden"
                        onChange={e => {
                            onPick(e.target.files?.[0]);
                            // Clear the input so picking the same file again still fires onChange.
                            e.target.value = '';
                        }}
                    />
                </label>
            </div>

            {error && (
                <p className="mt-3 max-w-xs text-center text-xs text-red-600 leading-relaxed">{error}</p>
            )}
        </div>
    );
};

export default ProfilePhotoUpload;
