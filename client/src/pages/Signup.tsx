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
        role: 'Student',
        rollNumber: '',
        branch: '',
        department: '',
        title: '', // For Faculty
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const facultyTitles = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.'];
    const departments = ['Computer Science & Engineering', 'Electronics & Communication Engineering', 'Data Science & AI', 'Physics', 'Mathematics', 'Humanities'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'name') {
            // Auto-capitalize first letter of each word
            const capitalized = value.replace(/\b\w/g, c => c.toUpperCase());
            setFormData({ ...formData, [name]: capitalized });
            return;
        }

        if (name === 'rollNumber') {
            const roll = value.replace(/\D/g, '').slice(0, 9); // Only digits, max 9
            let branch = '';

            // Auto-fill branch based on roll number
            if (roll.length >= 5) {
                const branchCode = roll.charAt(4); // 5th digit (index 4)
                if (branchCode === '0') branch = 'CSE';
                else if (branchCode === '1') branch = 'ECE';
                else if (branchCode === '2') branch = 'DSAI';
            }

            setFormData({ ...formData, rollNumber: roll, branch });
            return;
        }

        setFormData({ ...formData, [name]: value });
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

        if (formData.role === 'Student') {
            if (formData.rollNumber.length !== 9) {
                setError("Roll Number must be exactly 9 digits.");
                setIsLoading(false);
                return;
            }
            if (!formData.email.endsWith('@iiitnr.edu.in')) {
                setError("Please use your Institute Email ID (@iiitnr.edu.in)");
                setIsLoading(false);
                return;
            }
        }

        try {
            const { confirmPassword, title, ...dataToSend } = formData;
            const finalName = title && formData.role === 'Faculty' ? `${title} ${formData.name}` : formData.name;

            const payload = {
                ...dataToSend,
                name: finalName
            };

            const res = await axios.post('http://localhost:5000/api/auth/signup', payload);
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

                {/* Role Selection Toggle */}
                <div className="mb-6 flex p-1 bg-neutral-100 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'Student' })}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.role === 'Student' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}
                    >
                        Student
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'Faculty' })}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.role === 'Faculty' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}
                    >
                        Faculty
                    </button>
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
                        {formData.role === 'Faculty' && (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Title</label>
                                <select
                                    name="title"
                                    className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-0"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select</option>
                                    {facultyTitles.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        )}
                        <div className={formData.role === 'Faculty' ? "" : "md:col-span-2"}>
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Full Name</label>
                            <input
                                name="name"
                                type="text"
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder={formData.role === 'Student' ? "John Doe" : "Enter Name"}
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Institute Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder={formData.role === 'Student' ? "john@iiitnr.edu.in" : "faculty@iiitnr.edu.in"}
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        {formData.role === 'Student' && (
                            <>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700">Roll Number</label>
                                    <input
                                        name="rollNumber"
                                        type="text"
                                        required
                                        maxLength={9}
                                        className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                        placeholder="e.g. 241020269"
                                        value={formData.rollNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-neutral-700">Branch (Auto)</label>
                                    <input
                                        name="branch"
                                        type="text"
                                        readOnly
                                        className="block w-full rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-3 text-neutral-500 cursor-not-allowed outline-none"
                                        placeholder="Auto-detected"
                                        value={formData.branch}
                                    />
                                </div>
                            </>
                        )}

                        {formData.role === 'Faculty' && (
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Department</label>
                                <select
                                    name="department"
                                    className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-0"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="relative">
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Password</label>
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="relative">
                            <label className="mb-1 block text-sm font-medium text-neutral-700">Confirm Password</label>
                            <input
                                name="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                required
                                className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-0"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-sm text-neutral-500 hover:text-neutral-900 underline"
                            >
                                {showPassword ? "Hide Passwords" : "Show Passwords"}
                            </button>
                        </div>
                    </div>

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
