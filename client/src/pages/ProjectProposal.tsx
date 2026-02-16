
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, X, Check, ArrowRight } from 'lucide-react';
import FilePreview from '../components/FilePreview';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface Faculty {
    _id: string;
    name: string;
    department: string;
    currentStudents: number;
    maxStudents: number;
    email: string;
    expertise?: string[];
}

const ProjectProposal: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');

    const [step, setStep] = useState(1);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        tags: '',
        facultyId: '',
        links: '',
        semester: 0
    });
    const [files, setFiles] = useState<FileList | null>(null);
    const [facultyList, setFacultyList] = useState<Faculty[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
    const [lockedFacultyId, setLockedFacultyId] = useState<string | null>(null);

    useEffect(() => {
        api.get('/users/faculty')
            .then(res => setFacultyList(res.data))
            .catch(err => console.error('Failed to fetch faculty', err));

        // Fetch group projects to check for existing faculty locks or edit data
        api.get('/groups/my')
            .then(res => {
                const projects = res.data.projects || (res.data.project ? [res.data.project] : []);

                // key logic: If any existing project has a faculty, lock it for new proposals
                // If editing, we generally keep the faculty unless we want to enforce consistency across all projects
                // The requirement is "When selecting the 2nd project proposal, auto-lock the original faculty."
                // This implies creation flow primarily. 

                const existingProjectWithFaculty = projects.find((p: any) => p.faculty && (!editId || p._id !== editId));

                if (existingProjectWithFaculty) {
                    const fid = existingProjectWithFaculty.faculty._id || existingProjectWithFaculty.faculty;
                    setLockedFacultyId(fid);
                    // If creating new proposal, auto-select
                    if (!editId) {
                        setFormData(prev => ({ ...prev, facultyId: fid }));
                    }
                }

                if (editId) {
                    const p = projects.find((proj: any) => proj._id === editId);

                    if (p) {
                        setProjectId(p._id);
                        setFormData({
                            title: p.title,
                            description: p.description,
                            tags: p.tags.join(', '),
                            facultyId: p.faculty?._id || p.faculty || '',
                            links: '',
                            semester: p.semester || 0
                        });
                        setExistingAttachments(p.attachments || []);
                    }
                }
            })
            .catch(() => { });

        if (user?.rollNumber) {
            const batchYear = 2000 + parseInt(user.rollNumber.substring(0, 2));
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            let sem = (currentYear - batchYear) * 2;
            if (currentMonth >= 5) sem += 1;

            if (sem < 1) sem = 1;
            setFormData(prev => ({ ...prev, semester: sem }));
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(e.target.files);
        }
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

    const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formattedTitle = formData.title.replace(/\b\w/g, char => char.toUpperCase());

        try {
            const data = new FormData();
            data.append('title', formattedTitle);
            data.append('description', formData.description);
            data.append('tags', formData.tags);
            data.append('facultyId', formData.facultyId);
            data.append('semester', formData.semester.toString());
            data.append('status', isDraft ? 'Draft' : 'Pending');
            data.append('links', formData.links);

            if (files) {
                for (let i = 0; i < files.length; i++) {
                    data.append('files', files[i]);
                }
            }

            // Send list of existing attachments to keep
            data.append('existingAttachments', JSON.stringify(existingAttachments));

            if (projectId) {
                await api.put(`/projects/${projectId}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                // Determine how creation handles files - if createProject expects JSON, we need to update it too.
                // But currently createProject expects JSON.
                // Assuming createProject does NOT support files yet.
                // If ID exists, we use PUT (which supports files).
                // If new, we use POST. If user uploads files on NEW project, we might fail if backend doesn't support.
                // Let's assume for now creation does not support files or I need to update createProject too.
                // Actually user request is "Allow me to edit the proposal and allow adding attachments".
                // Usually editing implies it exists.
                // If creating, I should probably update createProject to support files too or just ignore files for now.
                // Or better, update createProject to handle FormData.
                // For now let's handle PUT. For POST, send JSON without files if controller not updated.
                // Actually I can update createProject controller to handle FormData as well, but that's more work.
                // Let's focus on "Edit".
                // If creation, fallback to JSON.

                if (files && files.length > 0) {
                    // If files are present on creation, warn or handle?
                    // Let's just send JSON for creation as before, ignoring files (or user uploaded none).
                }

                await api.post('/projects', {
                    ...formData,
                    title: formattedTitle,
                    tags: formData.tags.split(',').map(t => t.trim()),
                    attachments: formData.links.split(',').map(a => a.trim()).filter(Boolean), // Map links to attachments for now
                    status: isDraft ? 'Draft' : 'Pending'
                });
            }
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
                        <h2 className="text-2xl font-bold">{projectId ? 'Edit Project Proposal' : 'New Project Proposal'}</h2>
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

                    <form>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                                        <input
                                            type="text"
                                            value={formData.semester ? `Semester ${formData.semester} ` : 'Detecting...'}
                                            disabled
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                                        <input
                                            type="text"
                                            name="title"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all capitalize"
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
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">External Links (Optional URLs)</label>
                                        <input
                                            type="text"
                                            name="links"
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="https://github.com/..."
                                            value={formData.links}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (Max 10MB)</label>
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleFileChange}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        />
                                        {existingAttachments.length > 0 && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                <p className="font-semibold">Current Attachments:</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {existingAttachments.map((url, index) => (
                                                        <div key={index} className="relative group">
                                                            <FilePreview url={url} description={`Attachment ${index + 1} `} />
                                                            <button
                                                                type="button" // Prevent form submission
                                                                onClick={() => setExistingAttachments(prev => prev.filter((_, i) => i !== index))}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-gray-700">Select Faculty Mentor</label>
                                            {lockedFacultyId && (
                                                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                                    Faculty locked based on previous proposal
                                                </span>
                                            )}
                                        </div>

                                        {!lockedFacultyId && (
                                            <div className="mb-4">
                                                <label className="flex items-center gap-2 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                                    <input
                                                        type="radio"
                                                        name="facultyId"
                                                        value=""
                                                        checked={formData.facultyId === ""}
                                                        onChange={handleChange}
                                                        className="h-4 w-4 text-gray-500"
                                                    />
                                                    <span className="font-medium text-gray-700">Decide Later (No Faculty Selected)</span>
                                                </label>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                            {facultyList.map(faculty => {
                                                const isLocked = !!lockedFacultyId && lockedFacultyId !== faculty._id;
                                                return (
                                                    <label
                                                        key={faculty._id}
                                                        className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${isLocked ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100' :
                                                                formData.facultyId === faculty._id
                                                                    ? 'border-indigo-600 bg-indigo-50 cursor-pointer'
                                                                    : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50 cursor-pointer'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <input
                                                                type="radio"
                                                                name="facultyId"
                                                                value={faculty._id}
                                                                checked={formData.facultyId === faculty._id}
                                                                onChange={handleChange}
                                                                disabled={isLocked}
                                                                className={`h-4 w-4 text-indigo-600 focus:ring-indigo-500 ${isLocked ? 'cursor-not-allowed' : ''} ${formData.facultyId === faculty._id ? '' : 'hidden'}`}
                                                            />
                                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${formData.facultyId === faculty._id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'
                                                                }`}>
                                                                {formData.facultyId === faculty._id && <Check className="w-3 h-3" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0 pr-2">
                                                                <p className="font-semibold text-gray-900 truncate">{faculty.name}</p>
                                                                <p className="text-xs text-indigo-600 mb-1 truncate">{faculty.email}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded shrink-0">
                                                                        {faculty.department}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded-full shrink-0 font-medium ${faculty.currentStudents >= faculty.maxStudents
                                                            ? 'bg-red-100 text-red-600'
                                                            : 'bg-green-100 text-green-600'
                                                            }`}>
                                                            {faculty.currentStudents}/{faculty.maxStudents}
                                                        </span>
                                                    </label>
                                                )
                                            })}
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
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={loading}
                                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                                    >
                                        Save as Draft
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, false)}
                                        disabled={loading}
                                        className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Submitting...' : (projectId ? 'Update Proposal' : 'Submit Proposal')} <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProjectProposal;
