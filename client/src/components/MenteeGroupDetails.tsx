import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, MessageSquare, Plus, Link as LinkIcon, ArrowLeft, X, FileText, Download, Search, UserMinus, Loader2 } from 'lucide-react';
import FilePreview from './FilePreview';
import Avatar from './Avatar';
import { resolveUploadUrl } from '../utils/uploadUrl';
import api from '../utils/api';

interface MenteeGroupDetailsProps {
    group: any;
    user: any;
    onBack: () => void;
    onUpdateSuccess: () => void;
}

const MenteeGroupDetails: React.FC<MenteeGroupDetailsProps> = ({ group: groupProp, user, onBack, onUpdateSuccess }) => {
    // The roster is edited in place by admins, so keep a local copy that the
    // add/remove responses can replace without waiting for the parent to refetch.
    const [group, setGroup] = useState<any>(groupProp);
    useEffect(() => { setGroup(groupProp); }, [groupProp]);

    const isAdmin = user?.role === 'Admin';
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [rosterBusy, setRosterBusy] = useState(false);
    const [rosterError, setRosterError] = useState('');

    // The batch this group belongs to — scopes the picker to the right cohort.
    const groupBatch = useMemo(() => {
        if (group?.targetBatch) return String(group.targetBatch);
        const roll = group?.members?.[0]?.rollNumber;
        return roll ? '20' + String(roll).substring(0, 2) : undefined;
    }, [group]);

    // Search for students to add — only those not already in an active group.
    useEffect(() => {
        if (!isAddMemberOpen) return;
        let cancelled = false;
        setLoadingCandidates(true);
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/users/students', {
                    params: {
                        status: 'available',
                        search: memberSearch.trim() || undefined,
                        batch: groupBatch,
                        page: 1,
                        limit: 25,
                    },
                });
                if (cancelled) return;
                setCandidates(Array.isArray(res.data) ? res.data : (res.data?.data || []));
            } catch {
                if (!cancelled) setCandidates([]);
            } finally {
                if (!cancelled) setLoadingCandidates(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(t); };
    }, [isAddMemberOpen, memberSearch, groupBatch]);

    const closeAddMember = () => {
        setIsAddMemberOpen(false);
        setMemberSearch('');
        setSelectedIds(new Set());
        setRosterError('');
    };

    const handleAddMembers = async () => {
        if (selectedIds.size === 0) return;
        setRosterBusy(true);
        setRosterError('');
        try {
            const res = await api.post(`/groups/${group._id}/members`, { members: Array.from(selectedIds) });
            if (res.data?.group) setGroup(res.data.group);
            onUpdateSuccess();
            closeAddMember();
        } catch (err: any) {
            setRosterError(err?.response?.data?.message || 'Failed to add students.');
        } finally {
            setRosterBusy(false);
        }
    };

    const handleRemoveMember = async (member: any) => {
        if (!window.confirm(`Remove ${member.name} from group ${group.name || ''}?`)) return;
        setRosterBusy(true);
        setRosterError('');
        try {
            const res = await api.delete(`/groups/${group._id}/members/${member._id}`);
            if (res.data?.group) setGroup(res.data.group);
            onUpdateSuccess();
        } catch (err: any) {
            setRosterError(err?.response?.data?.message || 'Failed to remove the student.');
        } finally {
            setRosterBusy(false);
        }
    };

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

    const deliverableLink = (rawUrl: string | undefined, label: string) => {
        if (!rawUrl) return null;
        const url = resolveUploadUrl(rawUrl);
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
                    {isAdmin ? 'Back to Group Directory' : 'Back to Mentees'}
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
                        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 max-h-[460px] overflow-y-auto">
                            <div className="flex items-center justify-between gap-2 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-600" /> Group {group.name}
                                </h3>
                                {isAdmin && !group.isArchived && (
                                    <button
                                        onClick={() => { setRosterError(''); setIsAddMemberOpen(true); }}
                                        disabled={rosterBusy || group.members.length >= 3}
                                        title={group.members.length >= 3 ? 'This group is already at the 3-member limit' : 'Add a student to this group'}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                )}
                            </div>

                            {rosterError && (
                                <p className="mb-4 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    {rosterError}
                                </p>
                            )}

                            <div className="space-y-4">
                                {group.members.map((member: any) => (
                                    <div key={member._id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors group/member">
                                        <Avatar
                                            name={member.name}
                                            photoUrl={member.photoUrl}
                                            className="h-8 w-8 rounded-full shrink-0 text-xs"
                                            fallbackClassName="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate">{member.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{member.rollNumber || member.email}</p>
                                        </div>
                                        {isAdmin && !group.isArchived && group.members.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveMember(member)}
                                                disabled={rosterBusy}
                                                title={`Remove ${member.name} from this group`}
                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-red-500 transition-colors disabled:opacity-40 shrink-0 opacity-0 group-hover/member:opacity-100 focus:opacity-100"
                                            >
                                                <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {group.pendingMembers?.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-neutral-100">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-3">Pending invites</p>
                                    <div className="space-y-3">
                                        {group.pendingMembers.map((member: any) => (
                                            <div key={member._id} className="flex items-center gap-3 p-2 rounded-lg group/pending">
                                                <Avatar
                                                    name={member.name}
                                                    photoUrl={member.photoUrl}
                                                    className="h-8 w-8 rounded-full shrink-0 text-xs"
                                                    fallbackClassName="bg-amber-100 text-amber-700"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-700 text-sm truncate">{member.name}</p>
                                                    <p className="text-xs text-gray-400 truncate">{member.rollNumber || member.email}</p>
                                                </div>
                                                {isAdmin && !group.isArchived && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member)}
                                                        disabled={rosterBusy}
                                                        title={`Withdraw the invite to ${member.name}`}
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-red-500 transition-colors disabled:opacity-40 shrink-0 opacity-0 group-hover/pending:opacity-100 focus:opacity-100"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Faculty Mentor */}
                        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Users className="w-4 h-4 text-orange-600" /> Faculty Mentor
                            </h3>
                            <div className="flex items-center gap-3 p-2 bg-orange-50/50 rounded-lg border border-orange-100">
                                <Avatar
                                    name={faculty?.name || user?.name || 'F'}
                                    photoUrl={faculty?.photoUrl}
                                    className="h-9 w-9 rounded-full shrink-0 text-sm border border-orange-200"
                                    fallbackClassName="bg-orange-100 text-orange-700"
                                />
                                <div className="overflow-hidden">
                                    <p className="font-bold text-gray-900 text-sm truncate">{faculty?.name || user?.name || 'Unassigned'}</p>
                                    <p className="text-xs text-gray-500 truncate">{faculty?.department || user?.department || 'Faculty'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin: add students to this group */}
            {isAddMemberOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Add students to Group {group.name}</h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {group.members.length} of 3 seats filled{groupBatch ? ` · batch ${groupBatch}` : ''}
                                </p>
                            </div>
                            <button onClick={closeAddMember} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 pb-3 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    autoFocus
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    placeholder="Search by name, roll number or email..."
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-2">
                                Only students who are not already in an active group are listed.
                            </p>
                        </div>

                        <div className="px-6 flex-1 overflow-y-auto min-h-[120px]">
                            {loadingCandidates ? (
                                <div className="flex items-center justify-center py-10 text-neutral-400 gap-2 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                                </div>
                            ) : candidates.length === 0 ? (
                                <p className="text-center py-10 text-sm text-neutral-400">No available students found.</p>
                            ) : (
                                <div className="space-y-1.5 pb-2">
                                    {candidates.map((s: any) => {
                                        const selected = selectedIds.has(s._id);
                                        const wouldOverflow = !selected && group.members.length + selectedIds.size >= 3;
                                        return (
                                            <button
                                                key={s._id}
                                                type="button"
                                                disabled={wouldOverflow}
                                                onClick={() => setSelectedIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(s._id)) next.delete(s._id); else next.add(s._id);
                                                    return next;
                                                })}
                                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${selected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-neutral-200 hover:border-indigo-300'}`}
                                            >
                                                <Avatar
                                                    name={s.name}
                                                    photoUrl={s.photoUrl}
                                                    className="h-8 w-8 rounded-full shrink-0 text-xs"
                                                    fallbackClassName="bg-neutral-100 text-neutral-600"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-neutral-900 truncate">{s.name}</p>
                                                    <p className="text-xs text-neutral-500 truncate font-mono">{s.rollNumber || s.email}</p>
                                                </div>
                                                {s.branch && (
                                                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded shrink-0">{s.branch}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {rosterError && (
                            <p className="mx-6 mb-2 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 shrink-0">
                                {rosterError}
                            </p>
                        )}

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={closeAddMember}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddMembers}
                                disabled={rosterBusy || selectedIds.size === 0}
                                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md disabled:opacity-50"
                            >
                                {rosterBusy ? 'Adding…' : `Add ${selectedIds.size || ''} student${selectedIds.size === 1 ? '' : 's'}`.trim()}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

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
