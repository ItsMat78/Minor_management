import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, X, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Faculty {
    _id: string;
    name: string;
    department: string;
    currentStudents: number;
    maxStudents: number;
}

const ProjectProposal: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        tags: '',
        facultyId: ''
    });
    const [facultyList, setFacultyList] = useState<Faculty[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/users/faculty')
            .then(res => setFacultyList(res.data))
            .catch(err => console.error('Failed to fetch faculty', err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const nextStep = () => {
        if (step === 1 && (!formData.title || !formData.description)) {
            setError('Please fill in all fields');
            return;
        }
        setError('');
        setStep(step + 1);
    };

    const prevStep = () => setStep(step - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.post('/projects', {
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim())
            });
            // Redirect to dashboard (Project view)
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to submit proposal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center font-jakarta p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 px-8 py-6 flex justify-between items-center text-white">
                    <div>
                        <h2 className="text-2xl font-bold">New Project Proposal</h2>
                        <p className="text-indigo-200 text-sm">Step {step} of 2</p>
                    </div>
                    <button onClick={() => navigate('/')} className="p-2 bg-indigo-500 rounded-full hover:bg-indigo-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm flex items-center gap-2">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                                        <input
                                            type="text"
                                            name="title"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="e.g. Smart Traffic Management System"
                                            value={formData.title}
                                            onChange={handleChange}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            name="description"
                                            rows={5}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="Describe the problem, solution, and scope..."
                                            value={formData.description}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tags (Comma Separated)</label>
                                        <input
                                            type="text"
                                            name="tags"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="AI, Machine Learning, Web App"
                                            value={formData.tags}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Faculty Mentor</label>
                                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                            {facultyList.map(faculty => (
                                                <label
                                                    key={faculty._id}
                                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${formData.facultyId === faculty._id
                                                            ? 'border-indigo-600 bg-indigo-50'
                                                            : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="facultyId"
                                                            value={faculty._id}
                                                            checked={formData.facultyId === faculty._id}
                                                            onChange={handleChange}
                                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 hidden"
                                                        />
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.facultyId === faculty._id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'
                                                            }`}>
                                                            {formData.facultyId === faculty._id && <Check className="w-3 h-3" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">{faculty.name}</p>
                                                            <p className="text-xs text-gray-500">{faculty.department}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${faculty.currentStudents >= faculty.maxStudents
                                                            ? 'bg-red-100 text-red-600'
                                                            : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {faculty.currentStudents}/{faculty.maxStudents} Students
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-100">
                            {step > 1 ? (
                                <button
                                    type="button"
                                    onClick={prevStep}
                                    className="px-6 py-2 text-gray-600 font-medium hover:text-gray-900"
                                >
                                    Back
                                </button>
                            ) : (
                                <div></div>
                            )}

                            {step < 2 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2"
                                >
                                    Next Step <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading || !formData.facultyId}
                                    className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Submitting...' : 'Submit Proposal'} <Send className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProjectProposal;
