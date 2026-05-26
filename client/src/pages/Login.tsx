import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, User, Lock, KeyRound } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOtpMode, setIsOtpMode] = useState(false);
    const [otp, setOtp] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [isForgotOtpMode, setIsForgotOtpMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotCooldown, setForgotCooldown] = useState(0);
    const { login, isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && user) {
            if (user.mustChangePassword) {
                navigate('/change-password', { replace: true });
            } else if (user.role === 'Admin') {
                navigate('/admin', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [isAuthenticated, user, navigate]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    useEffect(() => {
        if (forgotCooldown <= 0) return;
        const t = setTimeout(() => setForgotCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [forgotCooldown]);

    const LOGO_URL = "/logo.svg";
    const CAMPUS_BG_URL = "/cover.jpeg";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setInfo('');

        try {
            if (isOtpMode) {
                const res = await api.post('/auth/verify-otp', { email, otp });
                login(res.data.token, res.data.user, rememberMe);

                if (res.data.user.mustChangePassword) {
                    navigate('/change-password');
                } else if (res.data.user.role === 'Admin') {
                    navigate('/admin');
                } else {
                    navigate('/dashboard');
                }
            } else {
                const res = await api.post('/auth/login', { email, password });

                if (res.data.requiresActivation) {
                    setIsOtpMode(true);
                    setInfo(res.data.message || 'Please enter the OTP sent to your email.');
                    setResendCooldown(60);
                    return;
                }

                login(res.data.token, res.data.user, rememberMe);

                if (res.data.user.mustChangePassword) {
                    navigate('/change-password');
                } else if (res.data.user.role === 'Admin') {
                    navigate('/admin');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setError('');
        setInfo('');
        try {
            await api.post('/auth/resend-otp', { email });
            setInfo('A new OTP has been sent to your email.');
            setResendCooldown(60);
        } catch (err: any) {
            const retry = err.response?.data?.retryAfter;
            if (retry) setResendCooldown(retry);
            setError(err.response?.data?.message || 'Could not resend OTP.');
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setInfo('');
        try {
            await api.post('/auth/forgot-password', { email: forgotEmail });
            setIsForgotOtpMode(true);
            setForgotCooldown(60);
            setInfo('If that email is registered, an OTP has been sent.');
        } catch (err: any) {
            const retry = err.response?.data?.retryAfter;
            if (retry) setForgotCooldown(retry);
            setError(err.response?.data?.message || 'Could not send OTP. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setInfo('');
        try {
            const res = await api.post('/auth/verify-forgot-password-otp', { email: forgotEmail, otp: forgotOtp });
            login(res.data.token, res.data.user, rememberMe);
            if (res.data.user.mustChangePassword) {
                navigate('/change-password');
            } else if (res.data.user.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid or expired OTP.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotResend = async () => {
        if (forgotCooldown > 0) return;
        setError('');
        setInfo('');
        try {
            await api.post('/auth/forgot-password', { email: forgotEmail });
            setForgotCooldown(60);
            setInfo('A new OTP has been sent to your email.');
        } catch (err: any) {
            const retry = err.response?.data?.retryAfter;
            if (retry) setForgotCooldown(retry);
            setError(err.response?.data?.message || 'Could not resend OTP.');
        }
    };

    const resetToLogin = () => {
        setIsForgotMode(false);
        setIsForgotOtpMode(false);
        setForgotEmail('');
        setForgotOtp('');
        setError('');
        setInfo('');
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('${CAMPUS_BG_URL}')` }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl md:bg-white/90"
            >
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 text-center text-white">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white p-2 shadow-lg">
                        <img src={LOGO_URL} alt="IIITNR Logo" className="h-full w-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">IIIT Naya Raipur</h1>
                    <p className="mt-1 text-blue-100 opacity-90">Project Management Portal</p>
                </div>

                <div className="p-8 pt-6">
                    <form onSubmit={isForgotOtpMode ? handleForgotOtpSubmit : isForgotMode ? handleForgotSubmit : handleSubmit} className="space-y-5">
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100 flex items-center"
                                >
                                    <span className="mr-2">⚠️</span> {error}
                                </motion.div>
                            )}
                            {info && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 border border-blue-100"
                                >
                                    {info}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-4">
                            {isForgotOtpMode ? (
                                <>
                                    <p className="text-sm text-gray-600 text-center">Enter the OTP sent to <span className="font-medium text-gray-800">{forgotEmail}</span></p>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <KeyRound size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={forgotOtp}
                                            onChange={(e) => setForgotOtp(e.target.value)}
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none tracking-widest text-center text-lg font-bold"
                                            placeholder="Enter 6-digit OTP"
                                            maxLength={6}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <button type="button" onClick={resetToLogin} className="font-medium text-gray-600 hover:text-blue-800 hover:underline">
                                            ← Back to login
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleForgotResend}
                                            disabled={forgotCooldown > 0}
                                            className="font-medium text-blue-700 hover:text-blue-900 hover:underline disabled:text-gray-400 disabled:hover:no-underline"
                                        >
                                            {forgotCooldown > 0 ? `Resend in ${forgotCooldown}s` : 'Resend OTP'}
                                        </button>
                                    </div>
                                </>
                            ) : isForgotMode ? (
                                <>
                                    <p className="text-sm text-gray-600 text-center">Enter your institute email and we'll send you a one-time sign-in code.</p>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <User size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                            placeholder="Institute Email ID"
                                            autoFocus
                                        />
                                    </div>
                                    <button type="button" onClick={resetToLogin} className="text-xs font-medium text-gray-500 hover:text-blue-800 hover:underline">
                                        ← Back to login
                                    </button>
                                </>
                            ) : !isOtpMode ? (
                                <>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <User size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                            placeholder="Institute Email ID"
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                            placeholder="Password"
                                        />
                                    </div>
                                    <div className="flex items-center justify-end">
                                        <button
                                            type="button"
                                            onClick={() => { setIsForgotMode(true); setError(''); setInfo(''); setForgotEmail(email); }}
                                            className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <KeyRound size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none tracking-widest text-center text-lg font-bold"
                                            placeholder="Enter 6-digit OTP"
                                            maxLength={6}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <button
                                            type="button"
                                            onClick={() => { setIsOtpMode(false); setOtp(''); setError(''); setInfo(''); }}
                                            className="font-medium text-gray-600 hover:text-blue-800 hover:underline"
                                        >
                                            ← Back to login
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResend}
                                            disabled={resendCooldown > 0}
                                            className="font-medium text-blue-700 hover:text-blue-900 hover:underline disabled:text-gray-400 disabled:hover:no-underline"
                                        >
                                            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {!isOtpMode && !isForgotMode && !isForgotOtpMode && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="rememberMe"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
                                    Remember me
                                </label>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group flex w-full items-center justify-center rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    {isForgotOtpMode ? 'Verify OTP & Sign In' : isForgotMode ? 'Send OTP' : isOtpMode ? 'Verify & Activate' : 'Sign In'}
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-gray-500">
                        Accounts are created by the Minor Project Coordinator.<br />
                        Contact <a href="mailto:btechminiproject@iiitnr.edu.in" className="text-blue-800 hover:underline">btechminiproject@iiitnr.edu.in</a> if you can't sign in.
                    </p>

                    <div className="mt-8 text-center text-xs text-gray-500">
                        <p>© {new Date().getFullYear()} IIIT Naya Raipur. All rights reserved.</p>
                        <p className="mt-1">Dr. Shyama Prasad Mukherjee International Institute of Information Technology</p>
                    </div>
                </div>
            </motion.div>

            {/* User Manual download — bottom right */}
            <a
                href="/userManual.pdf"
                download="UserManual.pdf"
                className="fixed bottom-6 right-6 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
            >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                    </svg>
                </div>
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">PDF</span>
                    <span className="text-sm font-bold text-neutral-800">Download User Manual</span>
                    <span className="text-[11px] text-neutral-400">Don't know what to do?</span>
                </div>
            </a>
        </div>
    );
};

export default Login;
