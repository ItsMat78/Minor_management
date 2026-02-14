import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';

const Signup: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Student', // Default role
        rollNumber: '', // Conditional
        branch: '', // Conditional
        department: '', // Conditional
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords don't match");
            setIsLoading(false);
            return;
        }

        try {
            const { confirmPassword, ...dataToSend } = formData;
            const res = await axios.post('http://localhost:5000/api/auth/signup', dataToSend);
            login(res.data.token, res.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Signup failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen font-jakarta">
            {/* Left Side: Form */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="flex w-full flex-col justify-center bg-white px-8 md:w-1/2 lg:px-24 py-12"
            >
                <div className="mb-8">
                    <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Create an account</h1>
                    <p className="mt-2 text-neutral-500">
                        Join the IIITNR Minor Project Portal.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
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

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Full Name</label>
                            <input
                                name="name"
                                type="text"
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="john@iiitnr.edu.in"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Confirm Password</label>
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Role</label>
                            <select
                                name="role"
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-0"
                                value={formData.role}
                                onChange={handleChange}
                            >
                                <option value="Student">Student</option>
                                <option value="Faculty">Faculty</option>
                            </select>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {formData.role === 'Student' && (
                            <motion.div
                                key="student-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-1 gap-5 md:grid-cols-2 overflow-hidden"
                            >
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700">Roll Number</label>
                                    <input
                                        name="rollNumber"
                                        type="text"
                                        required
                                        className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                        placeholder="e.g. 21100"
                                        value={formData.rollNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700">Branch</label>
                                    <select
                                        name="branch"
                                        required
                                        className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-0"
                                        value={formData.branch}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Branch</option>
                                        <option value="CSE">CSE</option>
                                        <option value="DSAI">DSAI</option>
                                        <option value="ECE">ECE</option>
                                    </select>
                                </div>
                            </motion.div>
                        )}

                        {formData.role === 'Faculty' && (
                            <motion.div
                                key="faculty-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700">Department</label>
                                    <input
                                        name="department"
                                        type="text"
                                        required
                                        className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                        placeholder="e.g. Computer Science"
                                        value={formData.department}
                                        onChange={handleChange}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group mt-4 flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-70"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                Create Account
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-neutral-500">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-neutral-900 hover:underline">
                        Sign in
                    </Link>
                </p>
            </motion.div>

            {/* Right Side: Visual */}
            <div className="hidden w-1/2 bg-neutral-900 md:block relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-900/80 to-indigo-900/50" />
                </div>
                <div className="absolute bottom-12 left-12 right-12 text-white">
                    <p className="text-3xl font-bold leading-tight drop-shadow-lg">
                        "Innovation distinguishes between a leader and a follower."
                    </p>
                    <p className="mt-4 text-lg font-medium opacity-80">
                        Start your journey today.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
