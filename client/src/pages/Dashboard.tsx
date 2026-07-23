import React, { useEffect, useState } from 'react';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { Layout, Users, CheckSquare, MessageSquare, Menu, Clock, Calendar, X, ChevronRight, Plus, Archive, FileText, Search, Square, AlertCircle, Trash2, AlertTriangle, Trophy, Star, Pencil } from 'lucide-react';
import FilePreview from '../components/FilePreview';
import AdminDashboard from './AdminDashboard';
import FacultyDashboard from './FacultyDashboard';
import Chat from '../components/Chat';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { GlobalEventBanner } from '../components/GlobalEventBanner';

interface Group {
    _id: string;
    name: string;
    members: any[];
    pendingMembers?: any[];
    status: string;
    project?: any;
    projects?: any[];
    targetBatch?: string;
    inviteCode?: string;
    groupNo?: number | string;
}

interface Student {
    _id: string;
    name: string;
    email: string;
    rollNumber: string;
    branch: string;
    semester: number;
    isGrouped: boolean;
    targetBatch?: string;
}

const Dashboard: React.FC = () => {
    const { user, logout, activeEvents, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialStudentTab = searchParams.get('tab') as 'directory' | 'project' | 'group' | 'archive' | 'results' | null;
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    // On desktop the sidebar is docked open; on mobile it starts collapsed so it
    // doesn't cover the content (it opens as an overlay when toggled).
    const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
    );
    const [activeTab, setActiveTab] = useState<'directory' | 'project' | 'group' | 'archive' | 'results'>(initialStudentTab || 'directory');

    // Switch tab and, on mobile where the sidebar is an overlay, close it so the
    // selected view is visible.
    const selectTab = (tab: 'directory' | 'project' | 'group' | 'archive' | 'results') => {
        setActiveTab(tab);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };


    useEffect(() => {
        const current = searchParams.get('tab');
        if (current !== activeTab) {
            const next = new URLSearchParams(searchParams);
            next.set('tab', activeTab);
            setSearchParams(next, { replace: true });
        }
    }, [activeTab]);
    const getBatch = (roll?: string) => {
        if (!roll) return 'Unknown';
        return '20' + roll.toString().substring(0, 2);
    };
    const myBatch = user?.targetBatch || getBatch(user?.rollNumber);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterBranch, setFilterBranch] = useState<string>('all');

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isProposalWarningOpen, setIsProposalWarningOpen] = useState(false);
    const [creatingGroup, setCreatingGroup] = useState(false);

    // Confirmation State
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [estimatedGroupNumber, setEstimatedGroupNumber] = useState<number | null>(null);
    const [isFetchingGroupNo, setIsFetchingGroupNo] = useState(false);

    // Leave Group State
    const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
    const [leavePassword, setLeavePassword] = useState('');
    const [leavingGroup, setLeavingGroup] = useState(false);
    const [updateContent, setUpdateContent] = useState('');
    const [updateLinks, setUpdateLinks] = useState('');
    const [updateFiles, setUpdateFiles] = useState<FileList | null>(null);
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
    const [isUpdateSubmitting, setIsUpdateSubmitting] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);

    // Archive State
    const [archivedGroups, setArchivedGroups] = useState<any[]>([]);
    const [archivedOrphanProjects, setArchivedOrphanProjects] = useState<any[]>([]);
    const [loadingArchive, setLoadingArchive] = useState(false);

    const fetchArchivedProjects = async () => {
        setLoadingArchive(true);
        try {
            const res = await api.get('/projects/archived');
            setArchivedGroups(res.data.groups ?? []);
            setArchivedOrphanProjects(res.data.orphanProjects ?? []);
        } catch (error) {
            console.error('Failed to fetch archived projects', error);
        } finally {
            setLoadingArchive(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'archive' && user?.role === 'Student') {
            fetchArchivedProjects();
        }
    }, [activeTab]);

    // Submission State
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [submitEvalType, setSubmitEvalType] = useState('mid_term_evaluation');
    const [submitReport, setSubmitReport] = useState<File | null>(null);
    const [submitPPT, setSubmitPPT] = useState<File | null>(null);
    const [submitPlagiarism, setSubmitPlagiarism] = useState<File | null>(null);
    const [isSubmittingFiles, setIsSubmittingFiles] = useState(false);

    const handleSubmitFiles = async () => {
        if (!submitReport && !submitPPT) {
            alert('Please select at least one file to submit.');
            return;
        }
        const approved = ((group?.projects || (group?.project ? [group.project] : [])) as any[]).find((p: any) => p.status === 'Approved');
        if (!approved?._id) {
            alert('No approved project to submit to.');
            return;
        }
        setIsSubmittingFiles(true);
        const formData = new FormData();
        formData.append('evalType', submitEvalType);
        if (submitReport) formData.append('report', submitReport);
        if (submitPPT) formData.append('ppt', submitPPT);
        if (submitPlagiarism) formData.append('plagiarismReport', submitPlagiarism);

        try {
            await api.put(`/projects/${approved._id}/submissions`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Files submitted successfully!');
            setIsSubmitDialogOpen(false);
            setSubmitReport(null);
            setSubmitPPT(null);
            setSubmitPlagiarism(null);
            window.location.reload();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to submit files.');
        } finally {
            setIsSubmittingFiles(false);
        }
    };

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'all') params.append('status', filterStatus);
            if (filterBranch !== 'all') params.append('branch', filterBranch);

            const studentsRes = await api.get(`/users/students?${params.toString()}`);
            if (Array.isArray(studentsRes.data)) {
                setStudents(studentsRes.data);
            } else {
                setStudents([]);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
        } finally {
            setLoadingStudents(false);
        }
    };

    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [invitesLoading, setInvitesLoading] = useState(false);
    const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

    const fetchPendingInvites = async () => {
        setInvitesLoading(true);
        try {
            const res = await api.get('/groups/my/invites');
            setPendingInvites(res.data || []);
        } catch {
            setPendingInvites([]);
        } finally {
            setInvitesLoading(false);
        }
    };

    const handleRespondToInvite = async (groupId: string, action: 'accept' | 'reject') => {
        setRespondingInviteId(groupId);
        try {
            await api.post(`/groups/${groupId}/${action}`);
            await fetchPendingInvites();
            if (action === 'accept') await fetchDashboardData();
        } catch (err: any) {
            alert(err.response?.data?.message || `Failed to ${action} invite.`);
        } finally {
            setRespondingInviteId(null);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const groupRes = await api.get('/groups/my').catch(() => null);
            if (groupRes) {
                setGroup(groupRes.data);
                setActiveTab('project');
            }
            await fetchStudents();
            await fetchPendingInvites();
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    // AuthContext reads /auth/me once at app mount, so an admin edit made mid-session (a
    // roll-number change re-derives the student's branch) leaves the cached user stale against
    // everything fetched later. Re-read it when this dashboard opens. Keyed on role, which
    // refreshUser cannot change, so this runs once rather than looping on its own result.
    useEffect(() => {
        if (user?.role === 'Student') refreshUser();
    }, [user?.role]);

    // Keyed on identity, not object reference: refreshUser hands back a new user object with the
    // same id, and that must not re-trigger a full dashboard fetch.
    useEffect(() => {
        if (user?.role === 'Student') {
            fetchDashboardData();
        } else {
            setLoading(false);
        }
    }, [user?._id, user?.role]);

    useEffect(() => {
        if (user?.role === 'Student') {
            fetchStudents();
        }
    }, [filterStatus, filterBranch]);

    const handleReviewGroup = async () => {
        setIsFetchingGroupNo(true);
        try {
            const res = await api.get(`/groups/next-number?batch=${myBatch}`);
            setEstimatedGroupNumber(res.data.nextNumber);
            setShowConfirmation(true);
        } catch (error) {
            console.error("Failed to fetch group number", error);
            // Default to showing confirmation anyway if it fails
            setShowConfirmation(true);
        } finally {
            setIsFetchingGroupNo(false);
        }
    };

    const toggleStudentSelection = (id: string) => {
        const student = students.find(s => s._id === id);
        if (student?.isGrouped) return;

        const newSelected = new Set(selectedStudents);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            if (newSelected.size >= 2) {
                alert("You can select up to 2 other students only.");
                return;
            }
            newSelected.add(id);
        }
        setSelectedStudents(newSelected);
    };

    const handleCreateGroup = async () => {
        setCreatingGroup(true);
        try {
            const payload: any = { members: Array.from(selectedStudents) };
            await api.post('/groups', payload);
            // Refresh state
            const groupRes = await api.get('/groups/my');
            setGroup(groupRes.data);
            setIsDialogOpen(false);
            setActiveTab('project');
        } catch (error: any) {
            console.error("Failed to create group", error);
            alert(error.response?.data?.message || "Failed to create group.");
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!leavePassword) return;
        setLeavingGroup(true);
        try {
            await api.post('/groups/leave', { password: leavePassword });
            setGroup(null);
            setActiveTab('directory');
            setIsLeaveDialogOpen(false);
            setLeavePassword('');
        } catch (error: any) {
            console.error("Failed to leave group", error);
            alert(error.response?.data?.message || "Failed to leave group");
        } finally {
            setLeavingGroup(false);
            window.location.reload();
        }
    };

    // ── Manage invites on an already-formed group ────────────────────────────
    const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [addMemberSelected, setAddMemberSelected] = useState<Set<string>>(new Set());
    const [addMemberSearch, setAddMemberSearch] = useState('');
    const [addingMembers, setAddingMembers] = useState(false);

    const handleCancelInvite = async (memberId: string) => {
        if (!group?._id) return;
        setCancellingInviteId(memberId);
        try {
            await api.post(`/groups/${group._id}/cancel-invite`, { memberId });
            const groupRes = await api.get('/groups/my');
            setGroup(groupRes.data);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to cancel invite.');
        } finally {
            setCancellingInviteId(null);
        }
    };

    const handleAddMembers = async () => {
        if (!group?._id || addMemberSelected.size === 0) return;
        setAddingMembers(true);
        try {
            await api.post(`/groups/${group._id}/invite`, { members: Array.from(addMemberSelected) });
            const groupRes = await api.get('/groups/my');
            setGroup(groupRes.data);
            setIsAddMemberOpen(false);
            setAddMemberSelected(new Set());
            setAddMemberSearch('');
            await fetchStudents();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to add members.');
        } finally {
            setAddingMembers(false);
        }
    };

    const handlePostUpdate = async () => {
        if (!group?.project?._id || !updateContent.trim()) return;

        setIsUpdateSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('content', updateContent);
            formData.append('links', updateLinks);

            if (updateFiles) {
                for (let i = 0; i < updateFiles.length; i++) {
                    formData.append('files', updateFiles[i]);
                }
            }

            await api.post(`/projects/${group.project._id}/updates`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await fetchDashboardData();
            setUpdateContent('');
            setUpdateLinks('');
            setUpdateFiles(null);
            setIsUpdateDialogOpen(false);
        } catch (error) {
            console.error("Failed to post update", error);
            alert("Failed to post update");
        } finally {
            setIsUpdateSubmitting(false);
        }
    };

    // Branch restriction is now per-batch: the viewing student is restricted only if THEIR batch
    // is in the event's branchRestrictedBatches. Falls back to the legacy whole-semester boolean
    // (all participating batches) for events created before per-batch restriction existed.
    const activeGFEvent = activeEvents?.find((e: any) => e.type === 'group_formation_project_proposal');
    const restrictedBatches: string[] = Array.isArray((activeGFEvent as any)?.branchRestrictedBatches)
        ? (activeGFEvent as any).branchRestrictedBatches.map(String)
        : ((activeGFEvent as any)?.branchRestricted ? (((activeGFEvent as any)?.participatingBatches ?? []).map(String)) : []);
    const isBranchRestricted = restrictedBatches.includes(myBatch);

    // When my batch is branch-restricted, the set of branches I may group with. Mirrors the
    // server's per-batch clustering: by default only my own branch (single-branch); if the admin
    // configured a cluster containing my branch, everyone in that cluster is allowed. null = no
    // restriction / unknown branch (don't filter — incomplete data must not empty the directory).
    const allowedBranchSet: Set<string> | null = (() => {
        const myBranchNorm = (user?.branch ?? '').trim().toUpperCase();
        if (!isBranchRestricted || !myBranchNorm) return null;
        const groups = (activeGFEvent as any)?.branchRestrictionGroups;
        const entry = Array.isArray(groups) ? groups.find((g: any) => String(g.batch) === String(myBatch)) : null;
        const clusters: string[][] = entry && Array.isArray(entry.clusters)
            ? entry.clusters.map((c: string) => String(c).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)).filter((c: string[]) => c.length > 0)
            : [];
        const myCluster = clusters.find(c => c.includes(myBranchNorm));
        return new Set(myCluster && myCluster.length ? myCluster : [myBranchNorm]);
    })();
    const allowedBranchesLabel = allowedBranchSet ? Array.from(allowedBranchSet).join(' / ') : (user?.branch || '');

    // My own directory row. Matched on id, falling back to email for rows fetched before
    // ids were selected.
    const isSelf = (s: { _id?: string; email?: string }) =>
        (!!user?._id && s._id === user._id) || (!!user?.email && s.email === user.email);

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             student.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        // Trust server-side batch/cohort filtering.
        // Client only filters locally by search and grouping status (if needed later)
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'available' ? !student.isGrouped : student.isGrouped);
        const matchesBranch = filterBranch === 'all' || student.branch === filterBranch;
        // When the viewing student's batch is branch-restricted, hide students whose branch isn't
        // in my allowed cluster. Resilient: don't hide anyone when either branch is unknown (so
        // incomplete data can't empty the directory), and never hide ME. allowedBranchSet is built
        // from the cached auth user, which can lag my own freshly-fetched row (an admin roll-number
        // edit re-derives my branch mid-session), and a directory without me in it reads as a bug.
        const theirBranchNorm = (student.branch ?? '').trim().toUpperCase();
        const matchesBranchRestriction = isSelf(student) || !allowedBranchSet || !theirBranchNorm
            || allowedBranchSet.has(theirBranchNorm);

        return matchesSearch && matchesStatus && matchesBranch && matchesBranchRestriction;
    }).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-neutral-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (user?.role === 'Admin') return <AdminDashboard />;
    if (user?.role === 'Faculty') return <FacultyDashboard />;

    // Final Deadline Check for students without groups
    const groupFormationEvent = activeEvents?.find(e => e.type === 'group_formation_project_proposal');
    const isFormationActive = groupFormationEvent && new Date(groupFormationEvent.extensionDate || groupFormationEvent.endDate) > new Date();

    const _allGroupProjects = (group?.projects || (group?.project ? [group.project] : [])) as any[];
    const approvedProjectForSidebar = _allGroupProjects.find((p: any) => p.status === 'Approved');
    const hasMidTermSubs = !!(approvedProjectForSidebar?.submissions?.midTermReport || approvedProjectForSidebar?.submissions?.midTermPPT);
    const hasEndTermSubs = !!(approvedProjectForSidebar?.submissions?.endTermReport || approvedProjectForSidebar?.submissions?.endTermPPT);
    const midTermActive = activeEvents?.some(e => e.type === 'mid_term_evaluation');
    const endTermActive = activeEvents?.some(e => e.type === 'end_term_evaluation');
    const myStudentEvals = ((approvedProjectForSidebar?.studentEvaluations || []) as any[]).filter(
        (e: any) => String(e.student?._id ?? e.student) === String(user?._id)
    );
    const hasEvaluations = myStudentEvals.length > 0;



    return (
        <div className="flex h-full bg-neutral-50 font-jakarta text-neutral-900 overflow-hidden">
            {/* Mobile backdrop — closes the overlay sidebar when tapped */}
            {isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    aria-hidden="true"
                />
            )}
            {/* Sidebar — fixed overlay on mobile, docked column on desktop */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: isSidebarOpen ? 0 : -250 }}
                className={`fixed lg:relative z-50 h-full w-64 ${isSidebarOpen ? 'lg:w-64' : 'lg:w-0'} flex-shrink-0 bg-white border-r border-neutral-200 transition-width duration-300 flex flex-col`}
            >
                <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Portal</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {!group && (
                        <SidebarItem
                            icon={<Layout className="w-5 h-5" />}
                            label="Student Directory"
                            active={activeTab === 'directory'}
                            onClick={() => selectTab('directory')}
                        />
                    )}
                    {group && (
                        <>
                            <SidebarItem
                                icon={<FileText className="w-5 h-5" />}
                                label="My Project"
                                active={activeTab === 'project'}
                                onClick={() => selectTab('project')}
                            />
                            <SidebarItem
                                icon={<Users className="w-5 h-5" />}
                                label="My Group"
                                active={activeTab === 'group'}
                                onClick={() => selectTab('group')}
                            />
                            {approvedProjectForSidebar && (
                                <div className="pt-3 border-t border-neutral-100 mt-2 space-y-1">
                                    <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Deliverables</p>
                                    <button
                                        onClick={() => selectTab('project')}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${hasMidTermSubs ? 'text-emerald-700 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-50'}`}
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        Mid-Term Files
                                        {hasMidTermSubs && <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full" />}
                                        {midTermActive && !hasMidTermSubs && <span className="ml-auto text-[9px] text-amber-600 font-bold uppercase">Open</span>}
                                    </button>
                                    <button
                                        onClick={() => selectTab('project')}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${hasEndTermSubs ? 'text-indigo-700 hover:bg-indigo-50' : 'text-neutral-400 hover:bg-neutral-50'}`}
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        End-Term Files
                                        {hasEndTermSubs && <span className="ml-auto w-2 h-2 bg-indigo-500 rounded-full" />}
                                        {endTermActive && !hasEndTermSubs && <span className="ml-auto text-[9px] text-amber-600 font-bold uppercase">Open</span>}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                    <SidebarItem
                        icon={<Archive className="w-5 h-5" />}
                        label="Archive"
                        active={activeTab === 'archive'}
                        onClick={() => selectTab('archive')}
                    />
                    {approvedProjectForSidebar && hasEvaluations && (
                        <SidebarItem
                            icon={<Trophy className="w-5 h-5" />}
                            label="My Results"
                            active={activeTab === 'results'}
                            onClick={() => selectTab('results')}
                        />
                    )}
                </nav>
                <div className="p-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 mb-4">
                        <Avatar
                            name={user?.name}
                            photoUrl={user?.photoUrl}
                            className="h-8 w-8 rounded-full object-cover shrink-0 border border-neutral-200"
                            fallbackClassName="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0"
                        />
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                {user?.name}
                                {user?.targetBatch && user?.targetBatch !== getBatch(user?.rollNumber) && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded border border-amber-200">Dropper</span>
                                )}
                            </p>
                            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <a
                        href="/userManual.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mb-2 flex items-center justify-center gap-2 rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                    >
                        <FileText className="w-4 h-4" /> Help &amp; User Manual
                    </a>
                    <button
                        onClick={logout}
                        className="w-full rounded-lg border border-neutral-200 py-2 text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="flex items-center h-16 px-4 sm:px-6 gap-2 border-b border-neutral-200 bg-white justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-neutral-100 rounded-lg shrink-0">
                                <Menu className="w-5 h-5" />
                            </button>
                        )}
                        <div className="min-w-0">
                            <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500 mb-0.5">
                                <span>Portal</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>
                                    {activeTab === 'directory' ? 'Directory' :
                                     activeTab === 'results' ? 'Results' :
                                     activeTab === 'archive' ? 'Archive' : 'My Project'}
                                </span>
                            </div>
                            <h1 className="text-lg sm:text-xl font-bold text-neutral-800 truncate">
                                {activeTab === 'directory' ? 'Student Directory' :
                                 activeTab === 'results' ? 'My Results' :
                                 activeTab === 'archive' ? 'Project Archive' : 'Project Workspace'}
                            </h1>
                        </div>
                    </div>
                    <GlobalEventBanner />
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {/* Status Banners */}
                    <div className="max-w-5xl mx-auto space-y-4 mb-6">
                        {user?.isParticipating === false && (
                            <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-pulse">
                                <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-rose-900 uppercase tracking-tight">Portal Access Restricted</h3>
                                    <p className="text-xs text-rose-700 font-medium mt-0.5">
                                        You have been marked as non-participating for the current cycle. Group formation and project features are disabled.
                                    </p>
                                </div>
                            </div>
                        )}

                        {user?.targetBatch && user?.targetBatch !== getBatch(user?.rollNumber) && (
                            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">Active Batch Override</h3>
                                        <p className="text-xs text-amber-700 font-medium mt-0.5">
                                            You are participating in the <span className="font-bold underline">Batch {user.targetBatch}</span> cycle (Dropper Status).
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden sm:block px-3 py-1 bg-white rounded-lg border border-amber-200 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                    Admin Configured
                                </div>
                            </div>
                        )}
                    </div>
                    {activeTab === 'directory' && (
                        /* Directory View */
                        <div className="max-w-5xl mx-auto space-y-6">
                            {pendingInvites.length > 0 && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                                    <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Pending Group Invitations
                                    </h3>
                                    <div className="space-y-3">
                                        {pendingInvites.map((inv: any) => (
                                            <div key={inv._id} className="bg-white p-4 rounded-xl border border-indigo-100 flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-bold text-neutral-900 text-sm">
                                                        {inv.name}
                                                        {inv.groupNo !== undefined && <span className="ml-2 text-xs font-medium text-neutral-500">#{inv.groupNo}</span>}
                                                    </p>
                                                    <p className="text-xs text-neutral-500 mt-0.5">
                                                        Invited by {inv.createdBy?.name || 'group creator'} ·
                                                        {' '}{(inv.members?.length || 0)} accepted / {(inv.pendingMembers?.length || 0)} pending
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleRespondToInvite(inv._id, 'reject')}
                                                        disabled={respondingInviteId === inv._id}
                                                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 disabled:opacity-50"
                                                    >
                                                        Decline
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespondToInvite(inv._id, 'accept')}
                                                        disabled={respondingInviteId === inv._id}
                                                        className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                                                    >
                                                        Accept
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {invitesLoading && <p className="text-xs text-neutral-400 mt-2">Refreshing...</p>}
                                </div>
                            )}
                            {!group && !isFormationActive ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-red-100 shadow-[0_30px_70px_-20px_rgba(220,38,38,0.12)] relative overflow-hidden"
                                >
                                    {/* Decorative background element */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-16 -mt-16 opacity-50" />
                                    
                                    <div className="w-20 h-20 bg-red-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-200 rotate-3">
                                        <AlertCircle className="w-10 h-10" />
                                    </div>

                                    <h1 className="text-3xl font-black text-neutral-900 mb-4 tracking-tight leading-tight uppercase text-center">
                                        Group Formation <br />is Closed
                                    </h1>
                                    
                                    <div className="h-1 w-12 bg-red-600 mx-auto mb-6 rounded-full" />

                                    <p className="text-neutral-500 text-lg font-medium leading-relaxed mb-8 text-center">
                                        The official deadline for forming or joining a group has passed. Access to the student directory is now restricted.
                                    </p>



                                    <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100 text-left mb-8">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Required Action</span>
                                        </div>
                                        <p className="text-neutral-900 font-bold text-sm leading-snug">
                                            You are not assigned to any group. Please contact the <span className="text-red-600 underline underline-offset-4 decoration-2">Minor Project Administrator</span> immediately for manual allocation.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={() => window.location.reload()}
                                            className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-200 active:scale-95 text-center"
                                        >
                                            Refresh Status
                                        </button>
                                    </div>
                                    
                                    <p className="mt-6 text-[11px] font-bold text-neutral-300 uppercase tracking-widest text-center">
                                        Minor Project Management System • {new Date().getFullYear()}
                                    </p>
                                </motion.div>
                            ) : (
                                <>
                            {group && (
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-indigo-900">You are in a group: {group.name}</p>
                                            <p className="text-sm text-indigo-700">Go to Project page to manage via sidebar.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('project')}
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                    >
                                        View Project →
                                    </button>
                                </div>
                            )}

                            {isBranchRestricted && user?.branch && !group && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-sm text-amber-800">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                    <span><strong>Branch restriction active:</strong> Only {allowedBranchesLabel} students are shown — your group must stay within {allowedBranchSet && allowedBranchSet.size > 1 ? `these branches (${allowedBranchesLabel})` : 'your branch'} this semester.</span>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                                <div className="relative w-full sm:w-96">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="available">Available</option>
                                        <option value="grouped">Grouped</option>
                                    </select>
                                    <select
                                        value={filterBranch}
                                        onChange={(e) => setFilterBranch(e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    >
                                        <option value="all">All Branches</option>
                                        <option value="CSE">CSE</option>
                                        <option value="ECE">ECE</option>
                                        <option value="DSAI">DSAI</option>
                                    </select>
                                </div>
                                {!group && activeEvents?.some(e => e.type === 'group_formation_project_proposal') && (
                                    <Dialog.Root open={isDialogOpen} onOpenChange={(open) => {
                                        setIsDialogOpen(open);
                                        if (!open) {
                                            setShowConfirmation(false);
                                            setEstimatedGroupNumber(null);
                                        }
                                    }}>
                                        <Dialog.Portal>
                                            <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow" />
                                            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow">
                                                <Dialog.Title className="text-lg font-bold mb-4">Create New Group</Dialog.Title>
                                                {!showConfirmation ? (
                                                    <>
                                                        <div className="text-sm text-neutral-600 mb-4">
                                                            You are about to create a group. Your group number will be generated later upon project submission.
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Members ({selectedStudents.size + 1})</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="px-2 py-1 bg-neutral-100 rounded text-xs text-neutral-600 border border-neutral-200">You (Owner)</span>
                                                                {Array.from(selectedStudents).map(id => {
                                                                    const s = students.find(stu => stu._id === id);
                                                                    return s ? (
                                                                        <span key={id} className="px-2 py-1 bg-indigo-50 rounded text-xs text-indigo-700 border border-indigo-100">{s.name}</span>
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-end gap-3 mt-8">
                                                            <Dialog.Close asChild>
                                                                <button className="px-4 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-50 rounded-lg transition-colors">Cancel</button>
                                                            </Dialog.Close>
                                                            <button
                                                                onClick={handleReviewGroup}
                                                                disabled={isFetchingGroupNo}
                                                                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 shadow-lg shadow-indigo-100 flex items-center gap-2"
                                                            >
                                                                {isFetchingGroupNo ? (
                                                                    <>
                                                                        <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                                        Calculating...
                                                                    </>
                                                                ) : 'Review & Form Group'}
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                                        <div className="bg-indigo-50/50 p-6 rounded-2xl border-2 border-dashed border-indigo-200 mb-6 text-center">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2 block">Proposed Group Identity</span>
                                                            <div className="text-5xl font-black text-indigo-600 tracking-tighter mb-2">
                                                                {estimatedGroupNumber ? (
                                                                    <span>G-{estimatedGroupNumber}</span>
                                                                ) : 'G-??'}
                                                            </div>
                                                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Batch {myBatch}</p>
                                                        </div>

                                                        <div className="space-y-4 mb-8">
                                                            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                                                <span className="text-xs font-bold text-neutral-400 uppercase">Team Size</span>
                                                                <span className="text-sm font-black text-neutral-900">{selectedStudents.size + 1} Students</span>
                                                            </div>
                                                            <div className="p-4 bg-neutral-900 rounded-2xl text-white">
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-3 block">Confirmed Members</span>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                        <span className="text-sm font-bold truncate">{user?.name} (You)</span>
                                                                    </div>
                                                                    {Array.from(selectedStudents).map(id => {
                                                                        const s = students.find(stu => stu._id === id);
                                                                        return s ? (
                                                                            <div key={id} className="flex items-center gap-2 opacity-80">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                                                                                <span className="text-sm font-medium truncate">{s.name}</span>
                                                                            </div>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <button 
                                                                onClick={() => setShowConfirmation(false)}
                                                                className="flex-1 px-4 py-3 text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-widest"
                                                            >
                                                                Back
                                                            </button>
                                                            <button 
                                                                onClick={handleCreateGroup}
                                                                disabled={creatingGroup}
                                                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.1em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50"
                                                            >
                                                                {creatingGroup ? 'Creating...' : 'Confirm & Create'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Dialog.Content>
                                        </Dialog.Portal>
                                    </Dialog.Root>
                                )}
                            </div>

                            {/* overflow-x-auto, not overflow-hidden: at phone widths the five columns are
                                wider than the viewport, and clipping them put Branch and Status —
                                the two fields you pick a teammate on — permanently out of reach.
                                min-w keeps the columns readable instead of crushing them. */}
                            <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto shadow-sm">
                                <table className="w-full text-left text-sm min-w-[560px]">
                                    <thead className="bg-neutral-50 border-b border-neutral-200">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-3 font-semibold text-neutral-500 w-12"></th>
                                            <th className="px-4 sm:px-6 py-3 font-semibold text-neutral-500">Roll Number</th>
                                            <th className="px-4 sm:px-6 py-3 font-semibold text-neutral-500">Name</th>
                                            <th className="px-4 sm:px-6 py-3 font-semibold text-neutral-500">Branch</th>
                                            <th className="px-4 sm:px-6 py-3 font-semibold text-neutral-500 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {loadingStudents ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                    Loading students directory...
                                                </td>
                                            </tr>
                                        ) : filteredStudents.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                    No students found.
                                                </td>
                                            </tr>
                                        ) :
                                            filteredStudents.map(student => {
                                                if (!student) return null;
                                                const isSelected = selectedStudents.has(student._id);
                                                const isMe = student.email === user?.email;
                                                const isDisabled = !!group || student.isGrouped || isMe;

                                                return (
                                                    <tr
                                                        key={student._id}
                                                        className={`hover:bg-neutral-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                                    >
                                                        <td className="px-4 sm:px-6 py-4">
                                                            {isMe ? (
                                                                <span className="text-sm font-medium text-neutral-400">Me</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => toggleStudentSelection(student._id)}
                                                                    disabled={isDisabled}
                                                                    className={`text-neutral-400 transition-colors ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-indigo-600 cursor-pointer'}`}
                                                                >
                                                                    {isSelected ? (
                                                                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                                                                    ) : (
                                                                        <Square className="w-5 h-5" />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className={`px-4 sm:px-6 py-4 font-mono ${student.targetBatch && student.targetBatch !== getBatch(student.rollNumber) ? 'text-red-600 font-bold' : 'text-neutral-600'}`}>
                                                            {student.rollNumber}
                                                            {student.targetBatch && student.targetBatch !== getBatch(student.rollNumber) && (
                                                                <span className="ml-2 text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-tighter shadow-sm w-fit font-bold">Dropper</span>
                                                            )}
                                                        </td>
                                                        <td className={`px-4 sm:px-6 py-4 font-medium ${student.targetBatch && student.targetBatch !== getBatch(student.rollNumber) ? 'text-red-700' : 'text-neutral-900'}`}>
                                                            {student.name} {isMe && <span className="ml-2 text-xs text-neutral-400">(You)</span>}
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 text-neutral-500">{student.branch || '-'}</td>
                                                        <td className="px-4 sm:px-6 py-4 text-center">
                                                            {student.isGrouped ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                                    Grouped
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                                                                    Available
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

                    {activeTab === 'project' && (
                        /* Project View */
                        <div className="max-w-7xl mx-auto">
                            {!group ? (
                                <div className="text-center py-20">
                                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                                        <Users className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-neutral-900">No Group Found</h3>
                                    <p className="text-neutral-500 mt-2">You need to join or form a group to view this page.</p>
                                    <button
                                        onClick={() => setActiveTab('directory')}
                                        className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                                    >
                                        Go to Directory
                                    </button>
                                </div>
                            ) : (!group.project && (!group.projects || group.projects.length === 0)) ? (
                                <div className="text-center py-20">
                                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-neutral-900">No Project Proposal</h3>
                                    <p className="text-neutral-500 mt-2">Your group hasn't submitted a project proposal yet.</p>
                                    {activeEvents?.some((e: any) => e.type === 'group_formation_project_proposal') ? (
                                        <button
                                            onClick={() => navigate('/project/propose')}
                                            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-sm"
                                        >
                                            Create Proposal
                                        </button>
                                    ) : (
                                        <p className="mt-6 px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg inline-block text-sm font-medium">Project proposal submission is currently closed.</p>
                                    )}
                                </div>
                            ) : (() => {
                                const allGroupProjects = (group.projects || (group.project ? [group.project] : [])) as any[];
                                const approvedProject = allGroupProjects.find(p => p.status === 'Approved');
                                
                                return (
                                    <div className={`grid grid-cols-1 ${approvedProject ? 'xl:grid-cols-4' : 'xl:grid-cols-1'} gap-8`}>
                                        {/* Main Content */}
                                        <div className={`${approvedProject ? 'xl:col-span-3' : 'xl:col-span-1'} space-y-6`}>
                                            {/* Project Tabs & Logic */}
                                            {(() => {
                                                if (approvedProject) {
                                                    return (
                                                    <div className="space-y-6">
                                                        {/* Project Status Stats */}
                                                        <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-xl shadow-neutral-100/50">
                                                            <div className="flex justify-between items-start mb-6">
                                                                <div>
                                                                    <div className="flex items-center gap-3">
                                                                        {approvedProject.isArchived ? (
                                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-amber-100 text-amber-700">
                                                                                <Archive className="w-3 h-3" />
                                                                                Archived Project
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-emerald-100 text-emerald-700">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                Active Project
                                                                            </span>
                                                                        )}
                                                                        {approvedProject.semester && (
                                                                            <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                                                                Semester {approvedProject.semester}
                                                                            </span>
                                                                        )}
                                                                        {approvedProject.faculty && (
                                                                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                                                                <Users className="w-3 h-3" /> {approvedProject.faculty.name || 'Faculty'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h3 className="text-2xl font-bold text-neutral-900 mt-3 capitalize">{approvedProject.title}</h3>
                                                                    <p className="text-neutral-500 mt-2 leading-relaxed max-w-2xl text-sm">{approvedProject.description}</p>
                                                                </div>
                                                                {/* Members can refine an active project's details; it stays approved (mentor stays locked). */}
                                                                {!approvedProject.isArchived && (
                                                                    <button
                                                                        onClick={() => navigate(`/project/propose?edit=${approvedProject._id}`)}
                                                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                                                                        title="Edit project details"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {approvedProject.tags && approvedProject.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mb-6">
                                                                    {approvedProject.tags.map((tag: string, i: number) => (
                                                                        <span key={i} className="px-3 py-1 bg-neutral-50 text-neutral-600 rounded-md text-xs font-medium border border-neutral-100">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {approvedProject.attachments && approvedProject.attachments.length > 0 && (
                                                                <div className="mb-6">
                                                                    <h5 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                                                                        <FileText className="w-4 h-4" /> Attachments
                                                                    </h5>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {approvedProject.attachments.map((url: string, index: number) => (
                                                                            <FilePreview key={index} url={url} description={`Attachment ${index + 1}`} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Final Deliverables Tray */}
                                                        {(midTermActive || endTermActive) && <div className="mb-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                                                    <Archive className="w-5 h-5 text-emerald-600" /> Final Deliverables
                                                                </h3>
                                                                {!approvedProject.isArchived && (midTermActive || endTermActive) && (
                                                                    <button
                                                                        onClick={() => setIsSubmitDialogOpen(true)}
                                                                        className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors border border-emerald-200"
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" /> Upload / Replace
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {[
                                                                    { label: 'Mid-Term', keys: { report: 'midTermReport', ppt: 'midTermPPT', plag: 'midTermPlagiarism' }, accent: 'indigo' },
                                                                    { label: 'End-Term', keys: { report: 'endTermReport', ppt: 'endTermPPT', plag: 'endTermPlagiarism' }, accent: 'emerald' },
                                                                ].map(({ label, keys, accent }) => {
                                                                    const subs = approvedProject.submissions || {};
                                                                    const slots = [
                                                                        { name: 'Report', url: subs[keys.report] },
                                                                        { name: 'Presentation', url: subs[keys.ppt] },
                                                                        { name: 'Plagiarism Report', url: subs[keys.plag] },
                                                                    ];
                                                                    return (
                                                                        <div key={label} className="bg-white p-4 rounded-xl border border-neutral-200">
                                                                            <div className="flex items-center justify-between mb-3">
                                                                                <h4 className="text-sm font-bold text-neutral-800">{label} Evaluation</h4>
                                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-${accent}-50 text-${accent}-700 border border-${accent}-100`}>
                                                                                    {slots.filter(s => s.url).length} / 3
                                                                                </span>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                {slots.map((slot) => (
                                                                                    <div key={slot.name} className="flex items-center justify-between text-xs">
                                                                                        <span className="text-neutral-600 font-medium">{slot.name}</span>
                                                                                        {slot.url ? (
                                                                                            <a href={slot.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-1">
                                                                                                <FileText className="w-3 h-3" /> View
                                                                                            </a>
                                                                                        ) : (
                                                                                            <span className="text-neutral-400 italic">Not submitted</span>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>}

                                                        <div className="space-y-6">
                                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                                                    <Clock className="w-5 h-5 text-indigo-600" /> Project Timeline
                                                                </h3>
                                                                {!approvedProject.isArchived && (
                                                                    <div className="flex gap-2">
                                                                        {(midTermActive || endTermActive) && (
                                                                        <button
                                                                            onClick={() => setIsSubmitDialogOpen(true)}
                                                                            className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm"
                                                                        >
                                                                            <FileText className="w-4 h-4" /> Upload Files
                                                                        </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => setIsUpdateDialogOpen(true)}
                                                                            className="text-sm font-bold text-indigo-700 flex items-center gap-1.5 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-sm"
                                                                        >
                                                                            <Plus className="w-4 h-4" /> New Update
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="relative pl-4">
                                                                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-neutral-200/60" />

                                                                {approvedProject.updates && approvedProject.updates.slice().reverse().map((update: any, i: number) => (
                                                                    <div key={i} className="relative pl-12 pb-8 group">
                                                                        <div className="absolute left-[20px] top-6 w-3 h-3 rounded-full bg-white border-2 border-indigo-600 ring-4 ring-neutral-50 z-10" />
                                                                        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div>
                                                                                    {update.createdBy?.name && (
                                                                                        <h4 className="font-bold text-neutral-900">
                                                                                            {update.createdBy.name}
                                                                                            {update.createdBy.role && (
                                                                                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                                                                                    {update.createdBy.role}
                                                                                                </span>
                                                                                            )}
                                                                                        </h4>
                                                                                    )}
                                                                                    <span className="text-xs text-neutral-400 flex items-center gap-1 mt-1">
                                                                                        <Calendar className="w-3 h-3" />
                                                                                        {new Date(update.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-sm text-neutral-600 mb-4 whitespace-pre-wrap leading-relaxed">
                                                                                {update.content}
                                                                            </p>
                                                                            {(update.links?.length > 0 || update.attachments?.length > 0) && (
                                                                                <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100 mt-2">
                                                                                    {update.links?.map((link: string, lIdx: number) => (
                                                                                        <a key={`l-${lIdx}`} href={link} target="_blank" rel="noopener noreferrer"
                                                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 border border-neutral-200 hover:border-indigo-200 transition-colors">
                                                                                            <FileText className="w-3 h-3" /> Link {lIdx + 1}
                                                                                        </a>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {(!approvedProject.updates || approvedProject.updates.length === 0) && (
                                                                    <div className="text-center py-12 ml-6 bg-white border border-dashed border-neutral-200 rounded-xl">
                                                                        <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400">
                                                                            <Clock className="w-6 h-6" />
                                                                        </div>
                                                                        <p className="text-neutral-500 font-medium">No updates posted yet.</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                // PROPOSAL PHASE: Show Cards
                                                return (
                                                    <div className="space-y-8">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm shadow-indigo-500/5">
                                                            <div>
                                                                <h3 className="text-xl font-bold text-neutral-900">Project Proposals</h3>
                                                                <p className="text-sm text-neutral-500 mt-1">Manage your drafts and sent proposals</p>
                                                            </div>
                                                            {(() => {
                                                                const hasActivePending = allGroupProjects.some(p => p.status === 'Pending' || p.status === 'Approved');
                                                                const hasPendingMembers = (group.pendingMembers ?? []).length > 0;
                                                                const isDisabled = hasActivePending || hasPendingMembers;
                                                                const disabledReason = hasActivePending
                                                                    ? 'One proposal is already pending or approved.'
                                                                    : hasPendingMembers
                                                                    ? 'All invited members must accept or decline first.'
                                                                    : '';
                                                                return isDisabled ? (
                                                                    <div
                                                                        title={disabledReason}
                                                                        className="px-6 py-2.5 bg-neutral-100 text-neutral-400 rounded-xl font-bold cursor-not-allowed flex items-center gap-2 w-fit border border-neutral-200 text-sm"
                                                                    >
                                                                        <Plus className="w-5 h-5" />
                                                                        {hasActivePending ? 'Proposal Already Pending' : 'Invites Pending'}
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (allGroupProjects.filter(p => p.status !== 'Rejected' && p.status !== 'Archived').length > 0) {
                                                                                setIsProposalWarningOpen(true);
                                                                            } else {
                                                                                navigate('/project/propose');
                                                                            }
                                                                        }}
                                                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center gap-2 w-fit"
                                                                    >
                                                                        <Plus className="w-5 h-5" />
                                                                        Create New Proposal
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                            {allGroupProjects.filter(p => !['Archived', 'Rejected'].includes(p.status)).map((project: any) => (
                                                                <div key={project._id} className="group bg-white rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all flex flex-col overflow-hidden relative sm:aspect-square">
                                                                    {/* Accent Top Bar */}
                                                                    <div className={`h-1.5 w-full bg-indigo-600`} />

                                                                    <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between overflow-hidden">
                                                                        <div>
                                                                            {/* Top Status & Semester */}
                                                                            <div className="flex justify-between items-center mb-6">
                                                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${project.status === 'Draft' ? 'bg-neutral-100 text-neutral-500' : 'bg-indigo-50 text-indigo-700'}`}>
                                                                                    <Clock className="w-3 h-3" />
                                                                                    {project.status === 'Draft' ? 'DRAFT • SAVED' : 'SENT • PENDING'}
                                                                                </span>
                                                                                <span className="px-2 py-1 bg-neutral-100 text-neutral-500 rounded text-[10px] font-bold">
                                                                                    Sem {project.semester || '4'}
                                                                                </span>
                                                                            </div>

                                                                            {/* Project Title */}
                                                                            <h4 className="text-lg sm:text-xl font-bold text-neutral-900 leading-tight mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                                                                {project.title || 'Untitled Project Idea'}
                                                                            </h4>

                                                                            {/* Description */}
                                                                            <p className="text-sm text-neutral-500 line-clamp-2 mb-4 leading-relaxed">
                                                                                {project.description || 'No description provided.'}
                                                                            </p>

                                                                            {/* Tag Badges */}
                                                                            {project.faculty && (
                                                                                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-indigo-600 bg-indigo-50/50 w-fit px-3 py-1.5 rounded-xl border border-indigo-100">
                                                                                    <Users className="w-3.5 h-3.5" />
                                                                                    <span>{project.faculty.name}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                                                {(project.tags || []).slice(0, 2).map((tag: string, i: number) => (
                                                                                    <span key={i} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 text-[10px] rounded border border-neutral-100 font-bold uppercase">
                                                                                        {tag}
                                                                                    </span>
                                                                                ))}
                                                                                {project.status === 'Draft' && (
                                                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded border border-amber-100 font-bold uppercase">
                                                                                        Draft
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>                                                                        {/* Footer Card */}
                                                                        <div className="pt-4 border-t border-neutral-100 flex items-center justify-between mt-4">
                                                                            <span className="text-[11px] text-neutral-400 font-bold">
                                                                                {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                                                                            </span>
                                                                            <div className="flex items-center gap-3">
                                                                                <button 
                                                                                    onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        if (confirm('Permanently delete this proposal?')) {
                                                                                            try {
                                                                                                await api.delete(`/projects/${project._id}`);
                                                                                                window.location.reload();
                                                                                            } catch (e) { alert('Delete failed'); }
                                                                                        }
                                                                                    }}
                                                                                    className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                    title="Delete Draft"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                                <button 
                                                                                     onClick={() => {
                                                                                         if (project.status === 'Draft') {
                                                                                             navigate(`/project/propose?edit=${project._id}`);
                                                                                         } else {
                                                                                             setSelectedProject(project);
                                                                                         }
                                                                                     }}
                                                                                     className="text-[12px] font-black text-indigo-600 flex items-center gap-1 hover:translate-x-1 transition-transform"
                                                                                 >
                                                                                    {project.status === 'Draft' ? 'Finish' : 'View Details'} <ChevronRight className="w-4 h-4" />
                                                                                 </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {allGroupProjects.filter(p => p.status === 'Rejected').length > 0 && (
                                                            <div className="space-y-4">
                                                                <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em] ml-2">Rejected Proposals</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 hover:opacity-100 transition-opacity">
                                                                    {allGroupProjects.filter(p => p.status === 'Rejected').map((project: any) => (
                                                                        <div key={project._id} className="bg-white p-6 rounded-3xl border border-red-100">
                                                                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[9px] font-black uppercase rounded mb-3 inline-block">Rejected</span>
                                                                            <h4 className="font-bold text-neutral-900 mb-1">{project.title}</h4>
                                                                            {project.faculty && (
                                                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 mb-2">
                                                                                    <Users className="w-3 h-3" />
                                                                                    <span>{project.faculty.name}</span>
                                                                                </div>
                                                                            )}
                                                                            <p className="text-xs text-neutral-500 line-clamp-1 mb-3">{project.feedback}</p>
                                                                            <button onClick={() => navigate(`/project/propose?edit=${project._id}`)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Revise Proposal</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>

                                    {/* Sticky Sidebar: Team & Mentor & Help */}
                                    {approvedProject && (
                                        <div className="xl:col-span-1 space-y-6">
                                            <div className="sticky top-6 space-y-6">
                                                {/* Team Members */}
                                                <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm relative">
                                                    <h4 className="font-bold text-neutral-900 mb-4 flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-indigo-600" /> Group {group.name}
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {group.members.map((m: any) => (
                                                            <div key={m._id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors cursor-default">
                                                                <Avatar
                                                                    name={m.name}
                                                                    photoUrl={m.photoUrl}
                                                                    className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0 border border-neutral-200"
                                                                    fallbackClassName="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0"
                                                                />
                                                                <div className="overflow-hidden flex-1">
                                                                    <p className="text-sm font-medium text-neutral-900 truncate">{m.name}</p>
                                                                    <p className="text-xs text-neutral-500 truncate">{m.email}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Mentor */}
                                                <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm relative">
                                                    <h4 className="font-bold text-neutral-900 mb-4 text-sm flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-orange-600" /> Faculty Mentor
                                                    </h4>
                                                    {approvedProject.faculty ? (
                                                        <div className="flex items-center gap-3 p-2 bg-orange-50/50 rounded-lg border border-orange-100 mb-4">
                                                            <Avatar
                                                                name={approvedProject.faculty.name || 'F'}
                                                                photoUrl={approvedProject.faculty.photoUrl}
                                                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-orange-200"
                                                                fallbackClassName="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs shrink-0"
                                                            />
                                                            <div>
                                                                <p className="text-sm font-medium text-neutral-900">{approvedProject.faculty.name || 'Assigned Faculty'}</p>
                                                                <p className="text-xs text-neutral-500">{approvedProject.faculty.department || 'Department'}</p>
                                                            </div>
                                                        </div>
                                                    ) : approvedProject.archivedMentorName ? (
                                                        <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg border border-neutral-200 mb-4">
                                                            <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-xs">
                                                                {approvedProject.archivedMentorName.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-neutral-900">{approvedProject.archivedMentorName}</p>
                                                                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Former Mentor</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200 text-center mb-4">
                                                            <p className="text-xs text-neutral-500">No mentor assigned yet.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                    {activeTab === 'group' && (
                        /* My Group View - Revamped */
                        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {group ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Left Column: Team & Details */}
                                    <div className="lg:col-span-2 space-y-8">
                                        {/* Hero Group Card */}
                                        <div className="relative overflow-hidden bg-white p-5 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-0 opacity-50" />
                                            <div className="relative z-10">
                                                {/* Stacks on phones: side by side, the status badge had nowhere to go and
                                                    its text was clipped off the right edge of the card. */}
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                    <div>
                                                        <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight mb-2">
                                                            G-{group.name}
                                                        </h1>
                                                        {/* The ObjectId has no break opportunities, so it needs an explicit
                                                            one or it forces the pill wider than the card. */}
                                                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 text-neutral-500 font-medium font-mono text-xs sm:text-sm bg-neutral-50 px-3 py-1.5 rounded-2xl sm:rounded-full w-fit max-w-full border border-neutral-100">
                                                            <span className="opacity-50 text-[10px] font-bold uppercase tracking-widest shrink-0">Team ID</span>
                                                            <span className="break-all sm:break-normal">{group._id}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-start sm:items-end gap-2 text-left sm:text-right shrink-0">
                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ring-1 ring-inset ${
                                                            group.status === 'Approved' 
                                                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' 
                                                                : (group.projects?.length && group.projects?.length > 0)
                                                                    ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                                                                    : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                                                        }`}>
                                                            {group.status === 'Approved' 
                                                                ? 'Project Approved' 
                                                                : (group.projects?.length && group.projects?.length > 0)
                                                                    ? 'Group Formed • Proposal Submitted'
                                                                    : 'Group Formed • Proposal Not Created'}
                                                        </span>
                                                        {(!group.projects || group.projects.length === 0) && group.status !== 'Approved' && (
                                                            <span className="text-[10px] font-bold text-amber-500 animate-pulse">Action Required: Create a Proposal</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Two columns on phones rather than one cramped flex row: the
                                                    wide tracking made each label wrap to three lines and the
                                                    values wrap to two. Tighter tracking below sm keeps them on
                                                    one line each; the divider is desktop-only. */}
                                                <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-12 mt-6 pt-6 sm:mt-8 sm:pt-8 border-t border-neutral-100">
                                                    <div className="min-w-0">
                                                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider sm:tracking-[0.2em] mb-2 px-0.5">Target Batch</h4>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                                                            <span className="text-lg sm:text-xl font-black text-neutral-900 leading-none whitespace-nowrap">
                                                                Batch {group.targetBatch || getBatch(group.members[0]?.rollNumber)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="hidden sm:block h-10 w-px bg-neutral-100"></div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider sm:tracking-[0.2em] mb-2 px-0.5">Team Size</h4>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-5 h-5 text-indigo-500 shrink-0" />
                                                            <span className="text-lg sm:text-xl font-black text-neutral-900 leading-none whitespace-nowrap">
                                                                {group.members.length} <span className="text-neutral-400">/ 3</span> Members
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Members Grid */}
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">Team Roster</h3>
                                                {(() => {
                                                    const used = group.members.length + (group.pendingMembers?.length || 0);
                                                    const isFull = used >= 3;
                                                    const hasSentProposal = _allGroupProjects.some((p: any) => p.status === 'Pending' || p.status === 'Approved');
                                                    if (isFull) return null;
                                                    const disabled = !isFormationActive || hasSentProposal;
                                                    const reason = !isFormationActive
                                                        ? 'Group formation is closed.'
                                                        : hasSentProposal
                                                        ? 'Withdraw or get the proposal rejected before adding members.'
                                                        : '';
                                                    return disabled ? (
                                                        <div title={reason} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-400 text-xs font-bold cursor-not-allowed border border-neutral-200">
                                                            <Plus className="w-4 h-4" /> Add Member
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setAddMemberSelected(new Set()); setAddMemberSearch(''); setIsAddMemberOpen(true); }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-sm shadow-indigo-200"
                                                        >
                                                            <Plus className="w-4 h-4" /> Add Member
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {group.members.map((m: any) => (
                                                    <div key={m._id} className="group relative bg-white p-5 rounded-3xl border border-neutral-200 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
                                                        <div className="flex items-center gap-4">
                                                            <Avatar
                                                                name={m.name}
                                                                photoUrl={m.photoUrl}
                                                                className="w-14 h-14 rounded-2xl object-cover shadow-lg shadow-indigo-200 transition-transform group-hover:scale-110 border border-neutral-200"
                                                                fallbackClassName="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-200 transition-transform group-hover:scale-110"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                {/* flex-wrap so the branch/dropper chips drop to their own line
                                                                    instead of squeezing the name to a few characters. */}
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <p className="font-black text-neutral-900 truncate">{m.name}</p>
                                                                    <span className="shrink-0 text-[9px] font-black bg-neutral-900 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                        {m.branch || 'GEN'}
                                                                    </span>
                                                                    {(getBatch(m.rollNumber) !== (group.targetBatch || getBatch(group.members[0]?.rollNumber))) && (
                                                                        <span className="shrink-0 text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse border border-red-200">
                                                                            Dropper
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-neutral-500 truncate mb-1">{m.email}</p>
                                                                <p className="text-[10px] font-bold font-mono text-neutral-400">{m.rollNumber}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Pending (invited) members */}
                                            {(group.pendingMembers ?? []).length > 0 && (
                                                <div className="mt-6">
                                                    <h3 className="text-sm font-black text-amber-500 uppercase tracking-[0.2em] mb-3 ml-1">Invited — Awaiting Response</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {(group.pendingMembers ?? []).map((m: any) => (
                                                            <div key={m._id} className="relative bg-amber-50 p-4 rounded-2xl border border-amber-200 opacity-80">
                                                                {isFormationActive && (
                                                                    <button
                                                                        onClick={() => handleCancelInvite(m._id)}
                                                                        disabled={cancellingInviteId === m._id}
                                                                        title="Cancel this invite"
                                                                        className="absolute top-2 right-2 p-1.5 rounded-lg text-amber-600 hover:text-white hover:bg-red-500 transition-colors disabled:opacity-40"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar
                                                                        name={m.name || '?'}
                                                                        photoUrl={m.photoUrl}
                                                                        className="w-11 h-11 rounded-xl object-cover border border-amber-200"
                                                                        fallbackClassName="w-11 h-11 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center text-lg font-black"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                                            <p className="font-bold text-neutral-800 truncate text-sm">{m.name}</p>
                                                                            <span className="shrink-0 text-[9px] font-black bg-amber-400 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                                Pending
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-neutral-500 truncate">{m.email}</p>
                                                                        <p className="text-[10px] font-bold font-mono text-neutral-400">{m.rollNumber}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="mt-2 text-xs text-amber-700 font-medium flex items-center gap-1.5">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                        Proposal submission is blocked until all invites are resolved.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Actions & Warnings */}
                                    <div className="space-y-6">
                                        {/* Leave Management */}
                                        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                                            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Team Management</h4>
                                            <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                                                Leaving the group will remove your access to the current project and materials. 
                                                If you are the last member, the group will be dissolved.
                                            </p>
                                            
                                            {group.status === 'Approved' || group.status === 'ProposalPending' || (group.projects ?? []).some((p: any) => p.status === 'Approved' || p.status === 'Pending') ? (
                                                <div className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-neutral-50 text-neutral-400 border-2 border-neutral-100 text-center cursor-not-allowed select-none">
                                                    {group.status === 'Approved' || (group.projects ?? []).some((p: any) => p.status === 'Approved')
                                                        ? 'Locked — project proposal accepted'
                                                        : 'Locked — withdraw your proposal to leave'}
                                                </div>
                                            ) : (
                                            <button
                                                onClick={() => setIsLeaveDialogOpen(true)}
                                                disabled={!activeEvents?.some(e => e.type === 'group_formation_project_proposal' && new Date(e.extensionDate || e.endDate) > new Date())}
                                                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                                                    activeEvents?.some(e => e.type === 'group_formation_project_proposal' && new Date(e.extensionDate || e.endDate) > new Date())
                                                        ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-2 border-red-100 hover:border-red-600'
                                                        : 'bg-neutral-50 text-neutral-400 border-2 border-neutral-100 cursor-not-allowed'
                                                }`}
                                            >
                                                Leave Group
                                            </button>
                                            )}
                                        </div>

                                        {/* Pro-tip Card */}
                                        <div className="bg-neutral-900 p-6 rounded-3xl text-white relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3">Group Status</h4>
                                            <div className="space-y-4">
                                                <div className="flex gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="text-xs text-neutral-300 leading-relaxed font-bold">
                                                            Team Status: <span className="text-white underline decoration-indigo-400 underline-offset-4">
                                                                {group.status === 'Approved' ? 'Approved' : (group.projects?.length && group.projects?.length > 0 ? 'Submitted' : 'Drafting')}
                                                            </span>
                                                        </p>
                                                        <p className="text-[10px] text-neutral-500 mt-1">
                                                            {group.status === 'Approved' 
                                                                ? 'Your project has been accepted by a mentor.' 
                                                                : (group.projects?.length && group.projects?.length > 0)
                                                                    ? 'Your proposal is waiting for faculty review.'
                                                                    : 'Your team is formed but no proposal has been created.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 mt-1.5 shrink-0" />
                                                    <p className="text-xs text-neutral-400 leading-relaxed">Ensure all members have verified their emails to receive system notifications.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-neutral-200">
                                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-300">
                                        <Users className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-xl font-bold text-neutral-900">No Group Found</h2>
                                    <p className="text-neutral-500 mt-1 max-w-xs mx-auto">It seems you aren't part of any group yet or something went wrong while fetching data.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'archive' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
                                        <Archive className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-neutral-900">Project Archive</h2>
                                        <p className="text-sm text-neutral-500">Your past projects from previous academic cycles.</p>
                                    </div>
                                </div>

                                {loadingArchive ? (
                                    <div className="text-center py-12 text-neutral-400">Loading archive...</div>
                                ) : archivedGroups.length === 0 && archivedOrphanProjects.length === 0 ? (
                                    <div className="text-center py-12 text-neutral-400">
                                        <Archive className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                        <p className="font-medium">No archived projects yet.</p>
                                        <p className="text-sm mt-1">Projects from past academic cycles will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {archivedGroups.map((g: any) => {
                                            const project = g.project;
                                            const batchLabel = g.targetBatch || (g.members?.[0]?.rollNumber ? '20' + String(g.members[0].rollNumber).substring(0, 2) : '—');
                                            const mentorName = project?.archivedMentorName || project?.faculty?.name || 'No mentor';
                                            return (
                                                <div key={g._id} className="p-5 rounded-xl border border-neutral-200 hover:border-indigo-200 hover:bg-neutral-50 transition-colors">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex gap-2">
                                                            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded font-medium">Batch {batchLabel}</span>
                                                            {g.name && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded font-medium">Group {g.name}</span>}
                                                        </div>
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded font-medium">Archived</span>
                                                    </div>
                                                    {project ? (
                                                        <>
                                                            <h4 className="font-bold text-neutral-900 mb-1 line-clamp-2">{project.title}</h4>
                                                            <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{project.description || 'No description.'}</p>
                                                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                                                                <Users className="w-3.5 h-3.5" />
                                                                <span>{mentorName}</span>
                                                            </div>
                                                            {project.tags?.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-3">
                                                                    {project.tags.slice(0, 3).map((tag: string) => (
                                                                        <span key={tag} className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-xs rounded">{tag}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {(project.midTermEvaluation || project.endTermEvaluation || project.finalReportEvaluation) && (
                                                                <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-3 text-xs text-neutral-600">
                                                                    {project.midTermEvaluation?.totalMarks != null && (
                                                                        <span><span className="font-semibold">Mid:</span> {project.midTermEvaluation.totalMarks}</span>
                                                                    )}
                                                                    {project.endTermEvaluation?.totalMarks != null && (
                                                                        <span><span className="font-semibold">End:</span> {project.endTermEvaluation.totalMarks}</span>
                                                                    )}
                                                                    {project.finalReportEvaluation?.totalMarks != null && (
                                                                        <span><span className="font-semibold">Final:</span> {project.finalReportEvaluation.totalMarks}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <p className="text-sm text-neutral-400 italic">No project associated with this group.</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {archivedOrphanProjects.map((p: any) => (
                                            <div key={p._id} className="p-5 rounded-xl border border-neutral-200 hover:border-indigo-200 hover:bg-neutral-50 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex gap-2">
                                                        {p.archivedBatch && <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded font-medium">Batch {p.archivedBatch}</span>}
                                                        {p.archivedGroupName && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded font-medium">Group {p.archivedGroupName}</span>}
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded font-medium">Archived</span>
                                                </div>
                                                <h4 className="font-bold text-neutral-900 mb-1 line-clamp-2">{p.title}</h4>
                                                <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{p.description || 'No description.'}</p>
                                                {p.archivedMentorName && (
                                                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                                                        <Users className="w-3.5 h-3.5" />
                                                        <span>{p.archivedMentorName}</span>
                                                    </div>
                                                )}
                                                {(p.midTermEvaluation || p.endTermEvaluation || p.finalReportEvaluation) && (
                                                    <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-3 text-xs text-neutral-600">
                                                        {p.midTermEvaluation?.totalMarks != null && (
                                                            <span><span className="font-semibold">Mid:</span> {p.midTermEvaluation.totalMarks}</span>
                                                        )}
                                                        {p.endTermEvaluation?.totalMarks != null && (
                                                            <span><span className="font-semibold">End:</span> {p.endTermEvaluation.totalMarks}</span>
                                                        )}
                                                        {p.finalReportEvaluation?.totalMarks != null && (
                                                            <span><span className="font-semibold">Final:</span> {p.finalReportEvaluation.totalMarks}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'results' && (() => {
                        if (!hasEvaluations) {
                            return (
                                <div className="max-w-4xl mx-auto">
                                    <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-neutral-200">
                                        <Trophy className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                                        <h2 className="text-xl font-bold text-neutral-900">Results Not Available Yet</h2>
                                        <p className="text-neutral-500 mt-1 max-w-xs mx-auto text-sm">Your results will appear here once the faculty has completed and saved your evaluation.</p>
                                    </div>
                                </div>
                            );
                        }

                        const approvedProject = approvedProjectForSidebar;
                        const midEval = myStudentEvals.find((e: any) => e.evalType === 'mid-term');
                        const endEval = myStudentEvals.find((e: any) => e.evalType === 'end-term');
                        const midRemarks = approvedProject?.midTermEvaluation?.remarks;
                        const endRemarks = approvedProject?.endTermEvaluation?.remarks;
                        const totalMarks = (midEval?.marks ?? 0) + (endEval?.marks ?? 0);

                        const EvalCard = ({ title, evalData, remarks, accent, rubricGuideLabels, rubricPanelLabels }: {
                            title: string;
                            evalData: any;
                            remarks?: string;
                            accent: string;
                            rubricGuideLabels: Record<string, string>;
                            rubricPanelLabels: Record<string, string>;
                        }) => {
                            const guideEntries = evalData?.guide ? Object.entries(evalData.guide) : [];
                            const panel1Entries = evalData?.panel1 ? Object.entries(evalData.panel1) : (evalData?.panel ? Object.entries(evalData.panel) : []);
                            const panel2Entries = evalData?.panel2 ? Object.entries(evalData.panel2) : [];

                            return (
                                <div className={`bg-white rounded-3xl border border-${accent}-100 shadow-sm overflow-hidden`}>
                                    <div className={`bg-${accent}-50 px-7 py-5 border-b border-${accent}-100 flex items-center justify-between`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 bg-${accent}-100 rounded-xl text-${accent}-700`}>
                                                <Trophy className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-neutral-900 text-base">{title}</h3>
                                                {evalData?.attendance && (
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${evalData.attendance === 'present' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {evalData.attendance === 'present' ? 'Present' : 'Absent'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {evalData?.marks != null ? (
                                                <>
                                                    <p className={`text-3xl font-black text-${accent}-700 leading-none`}>{evalData.marks}</p>
                                                    <p className="text-[10px] text-neutral-400 font-medium mt-0.5">Total Marks</p>
                                                </>
                                            ) : (
                                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest bg-neutral-100 px-3 py-1.5 rounded-full">Not Evaluated</span>
                                            )}
                                        </div>
                                    </div>

                                    {evalData ? (
                                        <div className="p-7 space-y-5">
                                            {evalData.stars != null && evalData.stars > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Performance</span>
                                                    <div className="flex items-center gap-0.5 ml-2">
                                                        {[1,2,3,4,5].map(i => (
                                                            <Star key={i} className={`w-4 h-4 ${i <= evalData.stars ? 'text-amber-400 fill-amber-400' : 'text-neutral-200 fill-neutral-200'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {guideEntries.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Guide Evaluation</p>
                                                    <div className="space-y-2">
                                                        {guideEntries.map(([key, val]: any) => (
                                                            <div key={key} className="flex items-center justify-between text-sm">
                                                                <span className="text-neutral-600 font-medium capitalize">
                                                                    {rubricGuideLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                                                                </span>
                                                                <span className="font-bold text-neutral-900 tabular-nums">{val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {panel1Entries.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">
                                                        {panel2Entries.length > 0 ? 'Panel Evaluator 1' : 'Panel Evaluation'}
                                                    </p>
                                                    <div className="space-y-2">
                                                        {panel1Entries.map(([key, val]: any) => (
                                                            <div key={key} className="flex items-center justify-between text-sm">
                                                                <span className="text-neutral-600 font-medium capitalize">
                                                                    {rubricPanelLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                                                                </span>
                                                                <span className="font-bold text-neutral-900 tabular-nums">{val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {panel2Entries.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Panel Evaluator 2</p>
                                                    <div className="space-y-2">
                                                        {panel2Entries.map(([key, val]: any) => (
                                                            <div key={key} className="flex items-center justify-between text-sm">
                                                                <span className="text-neutral-600 font-medium capitalize">
                                                                    {rubricPanelLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                                                                </span>
                                                                <span className="font-bold text-neutral-900 tabular-nums">{val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {remarks && (
                                                <div className="pt-4 border-t border-neutral-100">
                                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Faculty Remarks</p>
                                                    <p className="text-sm text-neutral-700 leading-relaxed bg-neutral-50 rounded-xl p-3 border border-neutral-100">{remarks}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-7 text-center text-neutral-400">
                                            <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
                                            <p className="text-sm font-medium">Evaluation not yet completed</p>
                                            <p className="text-xs mt-1">Your marks will appear here once the evaluation is done.</p>
                                        </div>
                                    )}
                                </div>
                            );
                        };

                        return (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <>
                                    {/* Summary card */}
                                        <div className="bg-neutral-900 rounded-3xl p-7 text-white relative overflow-hidden">
                                            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
                                            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/5 rounded-full" />
                                            <div className="relative flex items-start justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-2">Project Results</p>
                                                    <h2 className="text-xl font-black text-white leading-tight mb-1 max-w-sm">{approvedProject.title}</h2>
                                                    <p className="text-xs text-neutral-400 font-medium">Group {group?.name} · {approvedProject?.faculty?.name || 'No Mentor'}</p>
                                                </div>
                                                <div className="text-right shrink-0 ml-6">
                                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Combined Total</p>
                                                    <p className="text-5xl font-black text-white leading-none">{totalMarks}</p>
                                                    <p className="text-xs text-neutral-500 mt-1">marks earned</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <EvalCard
                                                title="Mid-Term Evaluation"
                                                evalData={midEval}
                                                remarks={midRemarks}
                                                accent="emerald"
                                                rubricGuideLabels={{ dataElicitation: 'Data Elicitation', problemDefinition: 'Problem Definition', planning: 'Planning' }}
                                                rubricPanelLabels={{ literatureSurvey: 'Literature Survey', presentationSkills: 'Presentation Skills', technicalUnderstanding: 'Technical Understanding' }}
                                            />
                                            <EvalCard
                                                title="End-Term Evaluation"
                                                evalData={endEval}
                                                remarks={endRemarks}
                                                accent="indigo"
                                                rubricGuideLabels={{ requirementSpecification: 'Requirement Specification', systemDesign: 'System Design', implementation: 'Implementation', projectManagement: 'Project Management', planningVsExecution: 'Planning vs Execution' }}
                                                rubricPanelLabels={{ testingAndResults: 'Testing & Results', innovationAndRelevance: 'Innovation & Relevance', presentationAndViva: 'Presentation & Viva', conceptualDepth: 'Conceptual Depth' }}
                                            />
                                        </div>
                                </>
                            </div>
                        );
                    })()}
                </main>
            </div > {/* Closing main content flex */}

            {/* Floating "Form Group" button; ticked teammates' names appear as plain text to its left.
                Hidden while the checkout dialog is open (would otherwise float over it). */}
            {!group
                && !isDialogOpen
                && activeTab === 'directory'
                && activeEvents?.some(e => e.type === 'group_formation_project_proposal') && (
                <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 flex items-center gap-2 sm:gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-3rem)]">
                    {/* The tray: one background panel holding all the picked names */}
                    <AnimatePresence>
                        {selectedStudents.size > 0 && (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.9, x: 12 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9, x: 12 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-white rounded-xl border border-neutral-200 shadow-lg shadow-neutral-300/40 min-w-0"
                            >
                                <AnimatePresence initial={false}>
                                    {Array.from(selectedStudents).map(id => {
                                        const s = students.find(stu => stu._id === id);
                                        if (!s) return null;
                                        return (
                                            <motion.span
                                                key={id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                                className="flex items-center gap-1 text-sm font-semibold text-neutral-700 whitespace-nowrap"
                                            >
                                                {s.name}
                                                <button
                                                    onClick={() => toggleStudentSelection(s._id)}
                                                    className="text-neutral-300 hover:text-red-500 transition-colors shrink-0"
                                                    aria-label={`Remove ${s.name}`}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </motion.span>
                                        );
                                    })}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        layout
                        onClick={() => setIsDialogOpen(true)}
                        className="px-4 sm:px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-300/50 hover:bg-indigo-700 active:scale-95 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Form Group ({selectedStudents.size + 1})
                    </motion.button>
                </div>
            )}

            {/* Chat Sidebar */}
            {
                group && (
                    <>
                        <Chat
                            groupId={group._id}
                            groupName={group.name}
                            isOpen={isChatOpen}
                            onClose={() => setIsChatOpen(false)}
                        />
                        {!isChatOpen && (
                            <button
                                onClick={() => setIsChatOpen(true)}
                                className="fixed bottom-6 right-6 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105 z-30 flex items-center gap-2 font-medium"
                            >
                                <MessageSquare className="w-5 h-5" />
                                Chat with your team
                            </button>
                        )}
                    </>
                )
            }

            {/* Post Update Dialog */}
            <Dialog.Root open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow max-h-[90vh] overflow-y-auto">
                        <Dialog.Title className="text-lg font-bold mb-4">Post Project Update</Dialog.Title>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Details</label>
                                <textarea
                                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                                    placeholder="Describe what you worked on..."
                                    value={updateContent}
                                    onChange={(e) => setUpdateContent(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Attachment Links (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Comma separated URLs (e.g. github.com/..., drive.google.com/...)"
                                    value={updateLinks}
                                    onChange={(e) => setUpdateLinks(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Upload Files (Images/Docs)</label>
                                <input
                                    type="file"
                                    multiple
                                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    onChange={(e) => setUpdateFiles(e.target.files)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setIsUpdateDialogOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePostUpdate}
                                    disabled={!updateContent.trim() || isUpdateSubmitting}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                                >
                                    {isUpdateSubmitting ? 'Posting...' : 'Post Update'}
                                </button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* File Submission Dialog */}
            <Dialog.Root open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] transition-all" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-2xl z-[101] focus:outline-none border border-neutral-100 font-jakarta max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <Dialog.Title className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                                <FileText className="w-6 h-6 text-emerald-600" />
                                Submit Documents
                            </Dialog.Title>
                            <Dialog.Close className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100">
                                <X className="w-5 h-5" />
                            </Dialog.Close>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-neutral-700 mb-2">Evaluation Type</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-neutral-50"
                                    value={submitEvalType}
                                    onChange={(e) => setSubmitEvalType(e.target.value)}
                                >
                                    <option value="mid_term_evaluation">Mid-Term Evaluation</option>
                                    <option
                                        value="end_term_evaluation"
                                        disabled={activeEvents?.some(e => e.type === 'mid_term_evaluation')}
                                        title={activeEvents?.some(e => e.type === 'mid_term_evaluation') ? 'End-Term submission is locked while Mid-Term evaluation is active' : undefined}
                                    >
                                        End-Term Evaluation{activeEvents?.some(e => e.type === 'mid_term_evaluation') ? ' (locked — mid-term in progress)' : ''}
                                    </option>
                                </select>
                                {activeEvents?.some(e => e.type === 'mid_term_evaluation') && submitEvalType === 'end_term_evaluation' && (
                                    <p className="text-xs text-amber-600 font-medium mt-1">End-Term submissions are unavailable while Mid-Term evaluation is active.</p>
                                )}
                            </div>

                            <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-neutral-700 mb-1">Project Report (PDF/Word)</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setSubmitReport(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                    />
                                    {submitReport && <p className="text-[10px] mt-1 text-emerald-600 font-medium ml-2">Selected: {submitReport.name}</p>}
                                </div>

                                <div className="h-px bg-neutral-200 w-full" />

                                <div>
                                    <label className="block text-sm font-bold text-neutral-700 mb-1">Presentation (PPT/PDF)</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.ppt,.pptx"
                                        onChange={(e) => setSubmitPPT(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    />
                                    {submitPPT && <p className="text-[10px] mt-1 text-indigo-600 font-medium ml-2">Selected: {submitPPT.name}</p>}
                                </div>

                                <div className="h-px bg-neutral-200 w-full" />
                                <div>
                                    <label className="block text-sm font-bold text-neutral-700 mb-1">Plagiarism Report (PDF)</label>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setSubmitPlagiarism(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                                    />
                                    {submitPlagiarism && <p className="text-[10px] mt-1 text-red-600 font-medium ml-2">Selected: {submitPlagiarism.name}</p>}
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <button
                                    onClick={handleSubmitFiles}
                                    disabled={(!submitReport && !submitPPT) || isSubmittingFiles}
                                    className="w-full py-3.5 bg-neutral-900 text-white rounded-xl font-bold uppercase tracking-widest text-sm shadow-xl shadow-neutral-200 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmittingFiles ? 'Uploading...' : 'Submit Documents'}
                                </button>
                                <p className="text-[10px] text-center mt-3 text-neutral-400 font-medium px-4">
                                    Files are securely uploaded and stored. You can overwrite them by submitting again before the evaluation.
                                </p>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Leave Group Dialog */}
            <Dialog.Root open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] transition-all" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-2xl z-[101] focus:outline-none border border-neutral-100 animate-in fade-in zoom-in-95 duration-200">
                        <Dialog.Title className="text-2xl font-black mb-2 text-red-600 tracking-tight">Leave Group</Dialog.Title>
                        <Dialog.Description className="text-neutral-500 mb-4">
                            Are you sure you want to leave this group? This action cannot be undone.
                            If you are the last member, the group will be dissolved.
                            Please enter your password to confirm.
                        </Dialog.Description>
                        <div className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    placeholder="Enter your password"
                                    value={leavePassword}
                                    onChange={(e) => setLeavePassword(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setIsLeaveDialogOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLeaveGroup}
                                    disabled={!leavePassword || leavingGroup}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                                >
                                    {leavingGroup ? 'Leaving...' : 'Confirm Leave'}
                                </button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Add Member Dialog */}
            <Dialog.Root open={isAddMemberOpen} onOpenChange={(open) => { setIsAddMemberOpen(open); if (!open) { setAddMemberSelected(new Set()); setAddMemberSearch(''); } }}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-lg bg-white p-6 sm:p-8 rounded-3xl shadow-2xl z-[101] focus:outline-none border border-neutral-100 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <Dialog.Title className="text-2xl font-black mb-1 text-indigo-600 tracking-tight">Add Members</Dialog.Title>
                        {(() => {
                            const used = (group?.members?.length || 0) + (group?.pendingMembers?.length || 0);
                            const remaining = Math.max(0, 3 - used);
                            return (
                                <Dialog.Description className="text-neutral-500 mb-4 text-sm">
                                    You can invite {remaining} more {remaining === 1 ? 'person' : 'people'} (max 3 per group). They’ll appear as pending until they accept.
                                    {isBranchRestricted && <span className="block mt-1 text-amber-600 font-medium">This batch is branch-restricted — only {allowedBranchesLabel} students are shown.</span>}
                                </Dialog.Description>
                            );
                        })()}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                value={addMemberSearch}
                                onChange={(e) => setAddMemberSearch(e.target.value)}
                                placeholder="Search by name or roll number"
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2">
                            {(() => {
                                const used = (group?.members?.length || 0) + (group?.pendingMembers?.length || 0);
                                const remaining = Math.max(0, 3 - used);
                                const memberIds = new Set([
                                    ...((group?.members || []).map((m: any) => m._id)),
                                    ...((group?.pendingMembers || []).map((m: any) => m._id)),
                                ]);
                                const term = addMemberSearch.toLowerCase();
                                const available = students.filter(s => {
                                    if (s.isGrouped) return false;
                                    if (memberIds.has(s._id)) return false;
                                    const theirBranchNorm = (s.branch ?? '').trim().toUpperCase();
                                    const branchOk = !allowedBranchSet || !theirBranchNorm || allowedBranchSet.has(theirBranchNorm);
                                    if (!branchOk) return false;
                                    if (!term) return true;
                                    return (s.name?.toLowerCase().includes(term) || s.rollNumber?.toLowerCase().includes(term));
                                }).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

                                if (available.length === 0) {
                                    return <p className="text-sm text-neutral-400 text-center py-8">No available students match.</p>;
                                }
                                return available.map(s => {
                                    const selected = addMemberSelected.has(s._id);
                                    const atCap = !selected && addMemberSelected.size >= remaining;
                                    return (
                                        <button
                                            key={s._id}
                                            disabled={atCap}
                                            onClick={() => {
                                                const next = new Set(addMemberSelected);
                                                if (selected) next.delete(s._id); else next.add(s._id);
                                                setAddMemberSelected(next);
                                            }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-50' : atCap ? 'border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed' : 'border-neutral-200 hover:border-indigo-300'}`}
                                        >
                                            {selected ? <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" /> : <Square className="w-5 h-5 text-neutral-300 shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-neutral-800 truncate text-sm">{s.name}</p>
                                                    <span className="shrink-0 text-[9px] font-black bg-neutral-900 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">{s.branch || 'GEN'}</span>
                                                </div>
                                                <p className="text-[10px] font-bold font-mono text-neutral-400">{s.rollNumber}</p>
                                            </div>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-neutral-100">
                            <button onClick={() => setIsAddMemberOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg">Cancel</button>
                            <button onClick={handleAddMembers} disabled={addMemberSelected.size === 0 || addingMembers} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
                                {addingMembers ? 'Sending…' : `Send Invite${addMemberSelected.size > 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Proposal Warning Dialog */}
            <Dialog.Root open={isProposalWarningOpen} onOpenChange={setIsProposalWarningOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow">
                        <Dialog.Title className="text-lg font-bold mb-2 text-indigo-600">Multiple Proposals</Dialog.Title>
                        <Dialog.Description className="text-neutral-500 mb-4">
                            You are about to create another project proposal.
                            <br /><br />
                            Please note that if <strong>any</strong> of your proposals is <strong>Approved</strong> by a faculty member, all other Pending, Draft, or Rejected proposals will be automatically <strong>Archived</strong>.
                        </Dialog.Description>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsProposalWarningOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => navigate('/project/propose')}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                            >
                                Proceed
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Project Details Modal for Sent Projects */}
            <Dialog.Root open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-2xl bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden max-h-[90vh] flex flex-col focus:outline-none border border-neutral-100 font-jakarta">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-100 bg-neutral-50/50 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <Dialog.Title className="text-xl font-bold text-neutral-900 leading-none mb-1">
                                        {selectedProject?.title}
                                    </Dialog.Title>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">G-{group?.name || 'TBD'}</span>
                                        <span className="text-[10px] text-neutral-400 font-medium">• Submitted {new Date(selectedProject?.createdAt || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <Dialog.Close className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </Dialog.Close>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            <div>
                                <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Project Overview</h4>
                                <p className="text-neutral-700 leading-relaxed text-sm whitespace-pre-wrap mb-6">
                                    {selectedProject?.description || "No description provided."}
                                </p>

                                {selectedProject?.faculty && (
                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 mb-8">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5" /> Proposed Faculty Mentor
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                name={selectedProject.faculty.name || 'F'}
                                                photoUrl={selectedProject.faculty.photoUrl}
                                                className="w-10 h-10 rounded-full object-cover border border-indigo-200 shadow-sm"
                                                fallbackClassName="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm"
                                            />
                                            <div>
                                                <p className="text-sm font-bold text-neutral-900">{selectedProject.faculty.name}</p>
                                                <p className="text-[11px] text-neutral-500 font-medium">{selectedProject.faculty.department}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedProject?.tags && selectedProject.tags.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Technologies & Focus</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedProject.tags.map((tag: string, i: number) => (
                                            <span key={i} className="px-3 py-1 bg-neutral-50 border border-neutral-200 text-neutral-600 rounded-lg text-xs font-bold transition-colors hover:border-indigo-300">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Project Assets</h4>
                                {selectedProject?.attachments && selectedProject.attachments.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {selectedProject.attachments.map((url: string, i: number) => {
                                            const fileName = url.split('/').pop()?.split('-').pop() || `File ${i + 1}`;
                                            const isLink = url.startsWith('http') && !url.includes('/uploads/');
                                            return (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-2xl hover:border-indigo-500 group transition-all shadow-sm">
                                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors border border-indigo-100">
                                                        {isLink ? <Layout className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-neutral-900 truncate">{isLink ? "Web Link" : fileName}</p>
                                                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest leading-none mt-0.5">{isLink ? "External Resource" : "Document Asset"}</p>
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 border-2 border-dashed border-neutral-200 rounded-3xl text-center bg-neutral-50/30">
                                        <p className="text-xs text-neutral-400 font-medium">No attachments provided.</p>
                                    </div>
                                )}
                            </div>

                            {selectedProject?.feedback && (
                                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm">
                                    <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> Faculty Feedback & Remarks
                                    </h4>
                                    <p className="text-xs text-amber-700 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-amber-200/50">{selectedProject.feedback}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">Read Only Mode — Integrity Protected</span>
                            </div>
                            <button onClick={() => setSelectedProject(null)} className="px-8 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
                                Close
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div >
    );
};

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
    >
        <span className={active ? 'text-indigo-600' : 'text-neutral-400'}>{icon}</span>
        {label}
    </button>
);

export default Dashboard;
