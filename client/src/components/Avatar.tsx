import React, { useEffect, useState } from 'react';
import { resolveUploadUrl } from '../utils/uploadUrl';

interface AvatarProps {
    name?: string;
    photoUrl?: string | null;
    /** Classes for the <img>. */
    className?: string;
    /** Classes for the initial-letter fallback. Falls back to `className` when omitted. */
    fallbackClassName?: string;
}

/**
 * A profile photo that degrades to the person's initial.
 *
 * Two failure modes are handled here rather than at each of the ~25 call sites:
 * the stored URL may carry a stale host (resolveUploadUrl re-points it at this
 * client's API origin), and the file may be gone or in a format the browser
 * cannot decode — an iPhone HEIC upload passes the server's `image/*` filter but
 * renders nowhere except Safari. Either way we show the initial instead of a
 * broken-image icon.
 *
 * The image and the fallback take separate class strings because they were styled
 * independently at every call site (different shadows, borders and backgrounds);
 * merging them would change how the fallback looks.
 */
const Avatar: React.FC<AvatarProps> = ({ name, photoUrl, className = '', fallbackClassName }) => {
    const src = resolveUploadUrl(photoUrl);
    const [failed, setFailed] = useState(false);

    // A new src deserves a fresh attempt — otherwise switching people keeps the fallback.
    useEffect(() => { setFailed(false); }, [src]);

    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name || 'Profile photo'}
                onError={() => setFailed(true)}
                className={className}
            />
        );
    }

    return (
        <div className={fallbackClassName ?? className}>
            {(name || '?').charAt(0).toUpperCase()}
        </div>
    );
};

export default Avatar;
