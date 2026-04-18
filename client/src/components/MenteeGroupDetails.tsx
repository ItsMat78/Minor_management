import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, MessageSquare, Plus, Link as LinkIcon, ArrowLeft, X, FileText, Download } from 'lucide-react';
import FilePreview from './FilePreview';
import api from '../utils/api';

interface MenteeGroupDetailsProps {
    group: any;
    user: any;
    onBack: () => void;
    onUpdateSuccess: () => void;
}

const MenteeGroupDetails: React.FC<MenteeGroupDetailsProps> = ({ group, user, onBack, onUpdateSuccess }) => {
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
            updateFiles.forEach(file => formData.append('files', file));
            await api.post(`/projects/${group.project._id}/updates`, formData);
            onUpdateSuccess();
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

    const project = group.project;
    const submissions = project?.submissions || {};
    const faculty = project?.faculty;

    const hasMidTerm = !!(submissions.midTermReport || submissions.midTermPPT || submissions.midTermPlagiarism);
    const hasEndTerm = !!(submissions.endTermReport || submissions.endTermPPT || submissions.endTermPlagiarism);

    const deliverableLink = (url: string | undefined, label: string) => {
        if (!url) return null;
        return (
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-neutral-50 hover:bg-indigo-50 rounded-lg border border-neutral-200 hover:border-indigo-200 text-xs font-medium text-neutral-700 hover:text-indigo-700 transition-colors group"
            >
                <FileText className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-500" />
                <span className="flex-1">{label}</span>
                <Download className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
            </a>
        );
    };

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

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Left Column - Project Info (3/4 width) */}
                <div className="xl:col-span-3 space-y-6">

                    {/* Main Project Card */}
                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-xl shadow-neutral-100/50 p-8">
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${project?.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                project?.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-indigo-100 text-indigo-700'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${project?.status === 'Approved' ? 'bg-emerald-500' :
                                    project?.status === 'Rejected' ? 'bg-red-500' :
                                        'bg-indigo-500'
                                    }`} />
                                {project?.status || 'Active'}
                            </span>

                            {project?.semester && (
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">
                                    Semester {project.semester}
                                </span>
                            )}

                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> Group {group.name}
                            </span>

                            {user?.role === 'Admin' && (
                                <div className="flex items-center gap-2 ml-4">
                                    <span className="text-xs font-bold text-gray-500">Override Batch:</span>
                                    <select
                                        value={group.targetBatch || ''}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            try {
                                                await api.put(`/groups/${group._id}`, { targetBatch: val || null });
                                                onUpdateSuccess();
                                            } catch {
                                                alert("Failed to change batch");
                                            }
                                        }}
                                        className="text-xs border border-gray-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">Default (From Roll No)</option>
                                        <option value="2023">2023</option>
                                        <option value="2024">2024</option>
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 mb-4 capitalize leading-tight">
                            {project?.title || 'Untitled Project'}
                        </h1>
                        <p className="text-gray-500 leading-relaxed text-sm mb-6">
                            {project?.description || "No description provided."}
                        </p>

                        {project?.tags && project.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                {project.tags.map((tag: string, i: number) => (
                                    <span key={i} className="px-3 py-1 bg-neutral-50 text-neutral-600 rounded-md text-xs font-semibold border border-neutral-100">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {project?.attachments && project.attachments.length > 0 && (
                            <div className="mb-6">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                                    <LinkIcon className="w-3 h-3" /> Proposal Attachments
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {project.attachments.map((url: string, index: number) => (
                                        <FilePreview key={index} url={url} description={`Attachment ${index + 1}`} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {project?.feedback && (
                            <div className="mt-8 p-6 bg-orange-50 rounded-2xl border border-orange-100">
                                <h5 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Faculty Feedback
                                </h5>
                                <p className="text-sm text-orange-700 leading-relaxed">{project.feedback}</p>
                            </div>
                        )}
                    </div>

                    {/* Final Deliverables (read-only) */}
                    {(hasMidTerm || hasEndTerm) && (
                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" /> Final Deliverables
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {hasMidTerm && (
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">Mid-Term Submissions</p>
                                        <div className="space-y-2">
                                            {deliverableLink(submissions.midTermReport, 'Mid-Term Report')}
                                            {deliverableLink(submissions.midTermPPT, 'Mid-Term Presentation')}
                                            {deliverableLink(submissions.midTermPlagiarism, 'Plagiarism Report')}
                                        </div>
                                    </div>
                                )}
                                {hasEndTerm && (
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">End-Term Submissions</p>
                                        <div className="space-y-2">
                                            {deliverableLink(submissions.endTermReport, 'End-Term Report')}
                                            {deliverableLink(submissions.endTermPPT, 'End-Term Presentation')}
                                            {deliverableLink(submissions.endTermPlagiarism, 'Plagiarism Report')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Project Timeline */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" /> Project Timeline
                            </h3>
                            {user?.role !== 'Admin' && (
                                <button
                                    onClick={() => setIsUpdateModalOpen(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    <Plus className="w-4 h-4" /> New Update
                                </button>
                            )}
                        </div>

                        {project?.updates && project.updates.length > 0 ? (
                            <div className="relative border-l-2 border-indigo-100 ml-3 space-y-8 pl-8 pb-4">
                                {project.updates.slice().reverse().map((update: any, i: number) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-white bg-indigo-600 shadow-sm"></div>
                                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    {update.title && <h4 className="font-bold text-gray-900 text-sm mb-1">{update.title}</h4>}
                                                    <span className="text-xs font-medium text-gray-500">
                                                        {new Date(update.date).toLocaleDateString()} at {new Date(update.date).toLocaleTimeString()}
                                                    </span>
                                                    {update.createdBy && (
                                                        <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${update.createdBy.role === 'Faculty' ? 'bg-orange-50 text-orange-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                                            {update.createdBy.name} · {update.createdBy.role}
                                                        </span>
                                                    )}
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

                {/* Right Column - Team & Mentor (1/4 width) */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="sticky top-6 space-y-6">
                        {/* Group Members */}
                        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 max-h-[400px] overflow-y-auto">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" /> Group {group.name}
                            </h3>
                            <div className="space-y-4">
                                {group.members.map((member: any) => (
                                    <div key={member._id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors">
                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0 text-xs">
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
                        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Users className="w-4 h-4 text-orange-600" /> Faculty Mentor
                            </h3>
                            <div className="flex items-center gap-3 p-2 bg-orange-50/50 rounded-lg border border-orange-100">
                                {faculty?.photoUrl ? (
                                    <img src={faculty.photoUrl} alt={faculty.name} className="h-9 w-9 rounded-full object-cover shrink-0 border border-orange-200" />
                                ) : (
                                    <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 shrink-0 text-sm border border-orange-200">
                                        {(faculty?.name || user?.name || 'F').charAt(0)}
                                    </div>
                                )}
                                <div className="overflow-hidden">
                                    <p className="font-bold text-gray-900 text-sm truncate">{faculty?.name || user?.name || 'Unassigned'}</p>
                                    <p className="text-xs text-gray-500 truncate">{faculty?.department || user?.department || 'Faculty'}</p>
                                </div>
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
                                    onChange={(e) => { if (e.target.files) setUpdateFiles(Array.from(e.target.files)); }}
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
