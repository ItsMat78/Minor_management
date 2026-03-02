import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, User, Lock } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (isAuthenticated && user) {
            if (user.role === 'Admin') {
                navigate('/admin', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [isAuthenticated, user, navigate]);

    // URLs for assets - These would ideally be local assets or hosted on a reliable CDN
    const LOGO_URL = "/logo.svg";
    const CAMPUS_BG_URL = "/cover.jpeg";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
            login(res.data.token, res.data.user);

            if (res.data.user.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url('${CAMPUS_BG_URL}')`,
                }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            </div>

            {/* Login Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl md:bg-white/90"
            >
                {/* Header Section */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 text-center text-white">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white p-2 shadow-lg">
                        <img
                            src={LOGO_URL}
                            alt="IIITNR Logo"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">IIIT Naya Raipur</h1>
                    <p className="mt-1 text-blue-100 opacity-90">Project Management Portal</p>
                </div>

                {/* Form Section */}
                <div className="p-8 pt-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
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
                        </AnimatePresence>

                        <div className="space-y-4">
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
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center space-x-2 text-gray-600 cursor-pointer">
                                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800" />
                                <span>Remember me</span>
                            </label>
                            <a href="#" className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
                                Forgot Password?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group flex w-full items-center justify-center rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-semibold text-blue-900 hover:underline">
                            Sign up
                        </Link>
                    </p>

                    <div className="mt-8 text-center text-xs text-gray-500">
                        <p>© {new Date().getFullYear()} IIIT Naya Raipur. All rights reserved.</p>
                        <p className="mt-1">Dr. Shyama Prasad Mukherjee International Institute of Information Technology</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;

