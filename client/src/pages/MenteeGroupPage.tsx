import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

import {
    Clock, Users, FileText, Link as LinkIcon,
    MessageSquare, Settings, LogOut, Menu, X, Plus, ChevronRight, Layout, GraduationCap, Medal
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import FilePreview from '../components/FilePreview';
import { GlobalEventBanner } from '../components/GlobalEventBanner';

const MenteeGroupPage: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { user, logout, activeEvents } = useAuth();
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Update Modal State
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [updateTitle, setUpdateTitle] = useState('');
    const [updateContent, setUpdateContent] = useState('');
    const [updateLinks, setUpdateLinks] = useState('');
    const [updateFiles, setUpdateFiles] = useState<File[]>([]);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);

    // Feedback Modal State
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackContent, setFeedbackContent] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    const handleAddUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!group?.project?._id) return;
        setSubmittingUpdate(true);

        try {
            const formData = new FormData();
            formData.append('title', updateTitle);
            formData.append('content', updateContent);
            formData.append('links', updateLinks); // Comma separated string
            updateFiles.forEach(file => {
                formData.append('files', file);
            });

            await api.post(`/projects/${group.project._id}/updates`, formData);

            // Refresh details
            await fetchGroupDetails();

            // Reset and close
            setIsUpdateModalOpen(false);
            setUpdateTitle('');
            setUpdateContent('');
            setUpdateLinks('');
            setUpdateFiles([]);
        } catch (error) {
            console.error("Failed to submit update", error);
            alert("Failed to submit update. Please try again.");
        } finally {
            setSubmittingUpdate(false);
        }
    };

    const handleAddFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!group?.project?._id) return;
        setSubmittingFeedback(true);

        try {
            await api.put(`/projects/${group.project._id}/feedback`, { feedback: feedbackContent });
            await fetchGroupDetails();
            setIsFeedbackModalOpen(false);
            setFeedbackContent('');
        } catch (error) {
            console.error("Failed to submit feedback", error);
            alert("Failed to submit feedback. Please try again.");
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const fetchGroupDetails = async () => {
        try {
            const res = await api.get('/groups/mentees');
            const foundGroup = res.data.find((g: any) => g._id === groupId);

            if (foundGroup) {
                setGroup(foundGroup);
                if (foundGroup.project?.hasNewUpdate) {
                    await api.put(`/projects/${foundGroup.project._id}/updates/read`);
                }
            } else {
                console.error("Group not found or not authorized");
            }
        } catch (error) {
            console.error("Failed to fetch group details", error);
        } finally {
            setLoading(false);
        }
    };

    if (user && user.role !== 'Faculty' && user.role !== 'Admin') {
        return <Navigate to="/dashboard" replace />;
    }

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    if (!group) return <div className="p-8 text-center">Group not found.</div>;

    const SidebarItem = ({ icon, label, active, onClick }: any) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="flex h-full bg-gray-50 font-jakarta text-neutral-900 overflow-hidden">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: isSidebarOpen ? 0 : -250 }}
                className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-neutral-200 transition-width duration-300 flex flex-col z-20`}
            >
                <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Users className="w-5 h-5" />
                        </div>
                        Faculty Portal
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <SidebarItem
                        icon={<Layout className="w-5 h-5" />}
                        label="Student Directory"
                        active={false}
                        onClick={() => navigate('/dashboard?tab=directory')}
                    />
                    <SidebarItem
                        icon={<FileText className="w-5 h-5" />}
                        label="Project Proposals"
                        active={false}
                        onClick={() => navigate('/dashboard?tab=proposals')}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="My Mentees"
                        active={true}
                        onClick={() => navigate('/dashboard?tab=mentees')}
                    />
                    <SidebarItem
                        icon={<Settings className="w-5 h-5" />}
                        label="My Profile"
                        active={false}
                        onClick={() => navigate('/dashboard?tab=profile')}
                    />

                    {(activeEvents?.some(e => e.type === 'mid_term_evaluation') || activeEvents?.some(e => e.type === 'end_term_evaluation')) && (
                        <div className="pt-4 border-t border-neutral-100 mt-4">
                            <p className="px-4 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Evaluations</p>
                            {activeEvents?.some(e => e.type === 'mid_term_evaluation') && (
                                <SidebarItem
                                    icon={<GraduationCap className="w-5 h-5" />}
                                    label="Mid-Term Eval"
                                    active={false}
                                    onClick={() => navigate('/dashboard?tab=mid-term')}
                                />
                            )}
                            {activeEvents?.some(e => e.type === 'end_term_evaluation') && (
                                <SidebarItem
                                    icon={<Medal className="w-5 h-5" />}
                                    label="End-Term Eval"
                                    active={false}
                                    onClick={() => navigate('/dashboard?tab=end-term')}
                                />
                            )}
                        </div>
                    )}
                </nav>
                <div className="p-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
                            {user?.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                    >
                        <LogOut className="w-4 h-4" /> Sign out
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-neutral-50/50">
                <header className="flex items-center h-16 px-6 border-b border-neutral-200 bg-white sticky top-0 z-10 justify-between">
                    <div className="flex items-center gap-4">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Menu className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                            <span
                                onClick={() => navigate('/dashboard?tab=mentees')}
                                className="hover:text-indigo-600 cursor-pointer transition-colors"
                            >
                                My Mentees
                            </span>
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                            {group ? (
                                <>
                                    <span>Semester {group.project?.semester || 'N/A'}</span>
                                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                                    <span className="font-bold text-neutral-900">{group.name}</span>
                                </>
                            ) : (
                                <span>Loading...</span>
                            )}
                        </div>
                    </div>
                    <GlobalEventBanner />
                </header>

                <main className="flex-1 overflow-y-auto p-8">


                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column - Project Info (2/3 width) */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Main Project Card */}
                            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-8">
                                <div className="flex flex-wrap items-center gap-3 mb-6">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${group.project?.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                        group.project?.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-indigo-100 text-indigo-700'
                                        }`}>
                                        <span className={`w-2 h-2 rounded-full ${group.project?.status === 'Approved' ? 'bg-emerald-500' :
                                            group.project?.status === 'Rejected' ? 'bg-red-500' :
                                                'bg-indigo-500'
                                            }`} />
                                        {group.project?.status || 'Active'}
                                    </span>

                                    {group.project?.semester && (
                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">
                                            Semester {group.project.semester}
                                        </span>
                                    )}

                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" /> {group.name}
                                    </span>
                                </div>

                                <h1 className="text-3xl font-bold text-gray-900 mb-4 capitalize leading-tight">
                                    {group.project?.title || 'Untitled Project'}
                                </h1>
                                <p className="text-gray-500 leading-relaxed text-sm mb-6">
                                    {group.project?.description || "No description provided."}
                                </p>

                                {/* Tags */}
                                {group.project?.tags && group.project.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {group.project.tags.map((tag: string, i: number) => (
                                            <span key={i} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold border border-gray-100">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Attachments */}
                                {group.project?.attachments && group.project.attachments.length > 0 && (
                                    <div className="mb-6">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                                            Attachments
                                        </h5>
                                        <div className="flex flex-wrap gap-2">
                                            {group.project.attachments.map((url: string, index: number) => (
                                                <FilePreview key={index} url={url} description={`Attachment ${index + 1}`} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Faculty Feedback Box */}
                                {group.project?.feedback ? (
                                    <div className="mt-8 p-6 bg-orange-50 rounded-2xl border border-orange-100 relative group/feedback">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" /> Faculty Feedback
                                            </h5>
                                            {(user?.role === 'Admin' || user?._id === group.project.faculty) && (
                                                <button
                                                    onClick={() => {
                                                        setFeedbackContent(group.project.feedback);
                                                        setIsFeedbackModalOpen(true);
                                                    }}
                                                    className="opacity-0 group-hover/feedback:opacity-100 transition-opacity text-xs font-bold text-orange-600 hover:text-orange-800 bg-white/50 px-2.5 py-1 rounded-md"
                                                >
                                                    Edit Feedback
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-orange-700 leading-relaxed whitespace-pre-wrap">
                                            {group.project.feedback}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-8 p-6 bg-orange-50/50 rounded-2xl border border-dashed border-orange-200 flex flex-col items-center justify-center text-center">
                                        <p className="text-sm text-orange-600/70 mb-3 font-medium">No feedback provided yet.</p>
                                        {(user?.role === 'Admin' || user?._id === group.project.faculty) && (
                                            <button
                                                onClick={() => {
                                                    setFeedbackContent('');
                                                    setIsFeedbackModalOpen(true);
                                                }}
                                                className="text-xs font-bold text-orange-700 bg-orange-100 px-4 py-2 rounded-xl transition-colors hover:bg-orange-200 shadow-sm"
                                            >
                                                Add Feedback
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Project Timeline */}
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-indigo-600" /> Project Timeline
                                    </h3>
                                    <button
                                        onClick={() => setIsUpdateModalOpen(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" /> New Update
                                    </button>
                                </div>

                                {group.project?.updates && group.project.updates.length > 0 ? (
                                    <div className="relative border-l-2 border-indigo-100 ml-3 space-y-8 pl-8 pb-4">
                                        {group.project.updates.slice().reverse().map((update: any, i: number) => (
                                            <div key={i} className="relative">
                                                <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-white bg-indigo-600 shadow-sm"></div>
                                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            {update.title && <h4 className="font-bold text-gray-900 text-sm mb-1">{update.title}</h4>}
                                                            <span className="text-xs font-medium text-gray-500">
                                                                {new Date(update.date).toLocaleDateString()} at {new Date(update.date).toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                                                        {update.content}
                                                    </div>
                                                    {(update.links?.length > 0 || update.attachments?.length > 0) && (
                                                        <div className="pt-4 border-t border-gray-50 flex flex-wrap gap-3">
                                                            {update.links?.map((link: string, li: number) => (
                                                                <a key={li} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-blue-50 px-2.5 py-1.5 rounded-lg font-medium">
                                                                    <LinkIcon className="w-3 h-3" /> Link {li + 1}
                                                                </a>
                                                            ))}
                                                            {update.attachments?.map((url: string, aIdx: number) => (
                                                                <FilePreview key={aIdx} url={url} description={`Attachment ${aIdx + 1}`} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                                        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium">No updates posted yet.</p>
                                        <p className="text-gray-400 text-sm mt-1">Students can post updates from their dashboard.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Team & Mentor (1/3 width) */}
                        <div className="space-y-8">

                            {/* Team Members */}
                            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-600" /> Team Members
                                </h3>
                                <div className="space-y-5">
                                    {group.members.map((member: any) => (
                                        <div key={member._id} className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-200 shrink-0">
                                                {member.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 text-sm truncate">{member.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Faculty Mentor */}
                            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-orange-600" /> Faculty Mentor
                                </h3>
                                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 border border-orange-200 shrink-0">
                                        {user?.name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-bold text-gray-900 text-sm truncate">{user?.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{user?.department || 'Faculty'}</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </main>
            </div>

            {/* Update Modal */}
            {isUpdateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                    >
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">Add New Update</h3>
                            <button onClick={() => setIsUpdateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddUpdate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={updateTitle}
                                    onChange={(e) => setUpdateTitle(e.target.value)}
                                    placeholder="Update Heading (optional)"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Content</label>
                                <textarea
                                    value={updateContent}
                                    onChange={(e) => setUpdateContent(e.target.value)}
                                    required
                                    rows={4}
                                    placeholder="Describe the progress..."
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Links (comma separated)</label>
                                <input
                                    type="text"
                                    value={updateLinks}
                                    onChange={(e) => setUpdateLinks(e.target.value)}
                                    placeholder="https://github.com/..., https://..."
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Attachments</label>
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setUpdateFiles(Array.from(e.target.files));
                                        }
                                    }}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUpdateModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingUpdate}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md disabled:opacity-50"
                                >
                                    {submittingUpdate ? 'Posting...' : 'Post Update'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Feedback Modal */}
            {isFeedbackModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                    >
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-orange-600" />
                                {group.project?.feedback ? 'Edit Feedback' : 'Add Feedback'}
                            </h3>
                            <button onClick={() => setIsFeedbackModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddFeedback} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-2">
                                    Provide constructive feedback or remarks for the <span className="font-bold text-gray-900">{group.name}</span> team project.
                                </label>
                                <textarea
                                    value={feedbackContent}
                                    onChange={(e) => setFeedbackContent(e.target.value)}
                                    required
                                    rows={5}
                                    placeholder="Write your feedback here..."
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setIsFeedbackModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingFeedback || !feedbackContent.trim()}
                                    className="px-6 py-2 text-sm font-bold text-white bg-orange-600 rounded-xl hover:bg-orange-700 shadow-md disabled:opacity-50"
                                >
                                    {submittingFeedback ? 'Saving...' : 'Save Feedback'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default MenteeGroupPage;
