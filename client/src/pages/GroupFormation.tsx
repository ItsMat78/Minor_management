import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * /group/create is deprecated — group formation now lives in the
 * Student Dashboard modal flow. We redirect immediately so old
 * bookmarks / links still work.
 */
const GroupFormation: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    return null;
};

export default GroupFormation;
