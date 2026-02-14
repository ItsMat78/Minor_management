import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Using logic from previous context - verify correct endpoint
            const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
            login(res.data.token, res.data.user);

            // Redirect based on role
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
        <div className="flex min-h-screen">
            {/* Left Side: Form */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="flex w-full flex-col justify-center bg-white px-8 md:w-1/2 lg:px-24"
            >
                <div className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Welcome back</h1>
                    <p className="mt-2 text-neutral-500">
                        Please enter your details to sign in.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="Enter your email"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input id="remember-me" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-neutral-900 focus:ring-neutral-900" />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-600">Remember for 30 days</label>
                        </div>
                        <a href="#" className="text-sm font-medium text-neutral-900 hover:underline">Forgot password?</a>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-70"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                Sign in
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-neutral-500">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-semibold text-neutral-900 hover:underline">
                        Sign up for free
                    </Link>
                </p>
            </motion.div>

            {/* Right Side: Visual */}
            <div className="hidden w-1/2 bg-neutral-100 md:block relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-90 grayscale contrast-125" />
                    <div className="absolute inset-0 bg-neutral-900/10 mix-blend-multiply" />
                </div>
                <div className="absolute bottom-12 left-12 right-12 text-white">
                    <p className="text-3xl font-bold leading-tight drop-shadow-lg">
                        "Design is intelligence made visible."
                    </p>
                    <p className="mt-4 text-lg font-medium opacity-90 drop-shadow-md">
                        IIITNR Project Portal
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
