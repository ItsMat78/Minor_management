import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Loader2, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

const ChangePassword: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, refreshUser, logout } = useAuth() as any;
    const navigate = useNavigate();

    const isForced = user?.mustChangePassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            if (refreshUser) await refreshUser();
            if (user?.role === 'Admin') navigate('/admin', { replace: true });
            else navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Could not change password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
            >
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                        <ShieldCheck className="h-7 w-7 text-blue-700" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">{isForced ? 'Set a new password' : 'Change password'}</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {isForced ? 'For security, please change the default password before continuing.' : 'Enter your current password and a new one.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isForced && (
                    <div className="relative">
                        <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            placeholder="Current password"
                            required
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                    </div>
                    )}
                    <div className="relative">
                        <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            placeholder="New password (min 6 chars)"
                            required
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                    </div>
                    <div className="relative">
                        <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white shadow hover:bg-blue-800 disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Update Password <ArrowRight className="ml-2 h-4 w-4" /></>)}
                    </button>

                    {!isForced && (
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    )}
                    {isForced && (
                        <button
                            type="button"
                            onClick={() => { logout?.(); navigate('/login', { replace: true }); }}
                            className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
                        >
                            Sign out
                        </button>
                    )}
                </form>
            </motion.div>
        </div>
    );
};

export default ChangePassword;
