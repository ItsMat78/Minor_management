import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, MessageSquare, Plus, Link as LinkIcon, ArrowLeft, X } from 'lucide-react';
import FilePreview from './FilePreview';
import api from '../utils/api';

interface MenteeGroupDetailsProps {
    group: any;
    user: any;
    onBack: () => void;
    onUpdateSuccess: () => void;
}

const MenteeGroupDetails: React.FC<MenteeGroupDetailsProps> = ({ group, user, onBack, onUpdateSuccess }) => {
    // Update Modal State
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [updateTitle, setUpdateTitle] = useState('');
    const [updateContent, setUpdateContent] = useState('');
    const [updateLinks, setUpdateLinks] = useState('');
    const [updateFiles, setUpdateFiles] = useState<File[]>([]);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);

    const handleAddUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!group?.project?._id) return;
        setSubmittingUpdate(true);

        try {
            const formData = new FormData();
            formData.append('title', updateTitle);
            formData.append('content', updateContent);
            formData.append('links', updateLinks);
            updateFiles.forEach(file => {
                formData.append('files', file);
            });

            await api.post(`/projects/${group.project._id}/updates`, formData);

            // Notify parent to refresh data
            onUpdateSuccess();

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

    if (!group) return <div>Group data not available via props.</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors font-medium text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Mentees
                </button>
            </div>

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">

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
                        {group.project?.feedback && (
                            <div className="mt-8 p-6 bg-orange-50 rounded-2xl border border-orange-100">
                                <h5 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Faculty Feedback
                                </h5>
                                <p className="text-sm text-orange-700 leading-relaxed">
                                    {group.project.feedback}
                                </p>
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
                                                        <FilePreview key={aIdx} url={url} />
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
                                {user?.name?.charAt(0) || 'F'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-gray-900 text-sm truncate">{user?.name}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.department || 'Faculty'}</p>
                            </div>
                        </div>
                    </div>

                </div>
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
        </div>
    );
};

export default MenteeGroupDetails;
