import React, { useState } from 'react';
import api from '../utils/api';

import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

const GroupFormation: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.post('/groups', {});
            navigate('/dashboard'); // Refresh or redirect to group view
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
            <div className="flex items-center gap-3 mb-6">
                <Users className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-800">Form a Group</h2>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Rules for Minor Project Groups
                </h3>
                <ul className="list-disc list-inside mt-2 text-blue-700 text-sm space-y-1">
                    <li>Maximum 3 students per group.</li>
                    <li>Cross-branch groups are allowed.</li>
                    <li>Once approved, groups cannot be dissolved without faculty permission.</li>
                </ul>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-6">
                <div className="text-sm text-gray-600 mb-6">
                    By confirming below, you will create a new default group. The group number will be assigned automatically upon project submission.
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Creating...' : (
                        <span className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4" /> Create Group
                        </span>
                    )}
                </button>
            </form>
        </div>
    );
};

export default GroupFormation;
