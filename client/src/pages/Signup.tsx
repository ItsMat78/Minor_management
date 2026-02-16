import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, User, Lock, Mail, Hash, BookOpen, Briefcase } from 'lucide-react';

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

    // Assets
    const LOGO_URL = "/logo.svg";
    const CAMPUS_BG_URL = "/cover.jpeg";

    const facultyTitles = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.'];
    const departments = ['Computer Science & Engineering', 'Electronics & Communication Engineering', 'Data Science & AI', 'Physics', 'Mathematics', 'Humanities'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'name') {
            const capitalized = value.replace(/\b\w/g, c => c.toUpperCase());
            setFormData({ ...formData, [name]: capitalized });
            return;
        }

        if (name === 'rollNumber') {
            const roll = value.replace(/\D/g, '').slice(0, 9);
            let branch = '';
            if (roll.length >= 5) {
                const branchCode = roll.charAt(4);
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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden font-jakarta">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url('${CAMPUS_BG_URL}')`,
                }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            </div>

            {/* Signup Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl md:bg-white/90 m-4"
            >
                {/* Header Section */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 text-center text-white">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white p-2 shadow-lg">
                        <img
                            src={LOGO_URL}
                            alt="IIITNR Logo"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Create an Account</h1>
                    <p className="mt-1 text-sm text-blue-100 opacity-90">Join the Project Portal</p>
                </div>

                {/* Form Section */}
                <div className="p-8 pt-6">
                    <div className="mb-6 flex p-1 bg-gray-100 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, role: 'Student' })}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.role === 'Student' ? 'bg-white shadow-sm text-blue-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Student
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, role: 'Faculty' })}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.role === 'Faculty' ? 'bg-white shadow-sm text-blue-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Faculty
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
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

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* Title for Faculty */}
                            {formData.role === 'Faculty' && (
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                        <User size={18} />
                                    </div>
                                    <select
                                        name="title"
                                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none appearance-none"
                                        value={formData.title}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Title</option>
                                        {facultyTitles.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Name */}
                            <div className={`relative ${formData.role === 'Student' ? 'md:col-span-2' : ''}`}>
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                    <User size={18} />
                                </div>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                    placeholder={formData.role === 'Student' ? "Full Name" : "Faculty Name"}
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Email */}
                            <div className="relative md:col-span-2">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                    <Mail size={18} />
                                </div>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                    placeholder={formData.role === 'Student' ? "Institute Email ID" : "Faculty Email ID"}
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Student Specific Fields */}
                            {formData.role === 'Student' && (
                                <>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <Hash size={18} />
                                        </div>
                                        <input
                                            name="rollNumber"
                                            type="text"
                                            required
                                            maxLength={9}
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                            placeholder="Roll Number"
                                            value={formData.rollNumber}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                            <BookOpen size={18} />
                                        </div>
                                        <input
                                            name="branch"
                                            type="text"
                                            readOnly
                                            className="block w-full rounded-lg border border-gray-300 bg-gray-100 py-3 pl-10 pr-3 text-gray-500 cursor-not-allowed outline-none"
                                            placeholder="Auto-detected Branch"
                                            value={formData.branch}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Faculty Specific Fields */}
                            {formData.role === 'Faculty' && (
                                <div className="relative md:col-span-2">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                        <Briefcase size={18} />
                                    </div>
                                    <select
                                        name="department"
                                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none appearance-none"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Password */}
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                    <Lock size={18} />
                                </div>
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                    <Lock size={18} />
                                </div>
                                <input
                                    name="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                    placeholder="Confirm Password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
                            >
                                {showPassword ? "Hide Passwords" : "Show Passwords"}
                            </button>
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
                                    Create Account
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-blue-900 hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Signup;
