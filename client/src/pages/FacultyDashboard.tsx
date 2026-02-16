import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Search, ChevronDown, Users, Clock, CheckCircle, XCircle, FileText, LayoutGrid, LayoutList, X, LogOut, ChevronRight, Layout, Settings, Menu, GraduationCap, Medal, Save } from 'lucide-react';
import FilePreview from '../components/FilePreview';
import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import MenteeGroupDetails from '../components/MenteeGroupDetails';

interface Project {
    _id: string;
    title: string;
    description: string;
    tags: string[];
    status: 'Pending' | 'Approved' | 'Rejected';
    semester?: number;
    group: {
        _id: string;
        name: string;
        members: {
            _id: string;
            name: string;
            email: string;
            rollNumber: string;
            branch?: string;
        }[];
    };
    attachments: string[];
    createdAt: string;
    feedback?: string;
    hasNewUpdate?: boolean;
    updates?: any[];
    updatedAt?: string; // Added for field
    midTermEvaluation?: { marks: number, remarks: string, date: string };
    endTermEvaluation?: { marks: number, remarks: string, date: string };
}

const MenteeCard = ({ item, activeTab, navigate, setSelectedProject }: any) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => {
            if (setSelectedProject) {
                setSelectedProject(item);
            }
        }}
        className={`bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all group flex flex-col cursor-pointer relative ${item.project?.hasNewUpdate ? 'ring-2 ring-red-400 ring-offset-2' : ''
            }`}
    >
        {/* Status Stripe */}
        <div className={`h-1.5 w-full ${(item.status || item.project?.status) === 'Approved' ? 'bg-green-500' :
            (item.status || item.project?.status) === 'Rejected' ? 'bg-red-500' :
                'bg-indigo-500'
            }`} />

        {item.project?.hasNewUpdate && (
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold uppercase rounded shadow-sm animate-pulse z-10">
                New Update
            </div>
        )}

        <div className="p-6 flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                {activeTab !== 'mentees' ? (
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${(item.status || item.project?.status) === 'Approved' ? 'bg-green-100 text-green-700' :
                        (item.status || item.project?.status) === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-indigo-100 text-indigo-700'
                        }`}>
                        {(item.status || item.project?.status) === 'Approved' ? <CheckCircle className="w-3 h-3" /> :
                            (item.status || item.project?.status) === 'Rejected' ? <XCircle className="w-3 h-3" /> :
                                <Clock className="w-3 h-3" />}
                        {item.status || item.project?.status || 'Active'}
                    </div>
                ) : <div />}

                {(item.semester || item.project?.semester) && (
                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">
                        Sem {item.semester || item.project?.semester}
                    </span>
                )}
            </div>

            <h3 className="text-lg font-bold text-neutral-900 line-clamp-2 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                {item.title || item.project?.title || item.name}
            </h3>

            <div className="flex items-center gap-2 text-sm text-neutral-600 font-medium mb-4">
                <Users className="w-4 h-4 text-neutral-400" />
                {item.group?.name || item.name}
            </div>

            <p className="text-sm text-neutral-500 line-clamp-3 mb-4 leading-relaxed">
                {activeTab === 'mentees' ? (item.project?.description || "No description provided.") : (item.description || "No description provided.")}
            </p>

            {/* Tags */}
            {((item.tags || item.project?.tags)?.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {(item.tags || item.project?.tags).slice(0, 3).map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 text-xs rounded-md border border-neutral-100">
                            {tag}
                        </span>
                    ))}
                    {(item.tags || item.project?.tags).length > 3 && <span className="text-xs text-neutral-400">+{item.tags.length - 3}</span>}
                </div>
            )}

            <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <span>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</span>

                {(activeTab === 'proposals' && item.status === 'Approved') ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/faculty/group/${item.group?._id}`);
                        }}
                        className="z-10 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                    >
                        See updates <ChevronDown className="w-3 h-3 -rotate-90" />
                    </button>
                ) : (
                    <span className="group-hover:translate-x-1 transition-transform text-indigo-600 font-medium flex items-center gap-1">
                        {activeTab === 'proposals' ? 'Review Details' : 'View Dashboard'} <ChevronDown className="w-3 h-3 -rotate-90" />
                    </span>
                )}
            </div>
        </div>
    </motion.div>
);

const FacultyDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') as 'proposals' | 'mentees' | 'profile' | 'directory' | null;
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeTab, setActiveTab] = useState<'proposals' | 'mentees' | 'profile' | 'directory' | 'mid-term' | 'end-term'>(initialTab || 'proposals');
    const [mentees, setMentees] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingMentees, setLoadingMentees] = useState(false);

    // Evaluation State
    const [evaluatingProject, setEvaluatingProject] = useState<any>(null);
    const [evaluationMarks, setEvaluationMarks] = useState<number>(0);
    const [evaluationRemarks, setEvaluationRemarks] = useState<string>('');
    const [evaluationType, setEvaluationType] = useState<'mid-term' | 'end-term' | null>(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBatch, setFilterBatch] = useState<string>('All');
    const [proposalView, setProposalView] = useState<'proposals' | 'approved'>('proposals');
    const [filterDirectoryYear, setFilterDirectoryYear] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Grouped' | 'Available'>('All');
    const [filterBranch, setFilterBranch] = useState<string>('All');

    // Group Details View State (integrated to fix sidebar issues)
    const [viewGroup, setViewGroup] = useState<any>(null);

    useEffect(() => {
        if (activeTab === 'proposals') {
            fetchProjects();
        } else if (activeTab === 'mentees' || activeTab === 'mid-term' || activeTab === 'end-term') {
            fetchMentees();
        } else if (activeTab === 'directory') {
            fetchStudents();
        }
    }, [activeTab]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects/faculty');
            setProjects(res.data);
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMentees = async () => {
        setLoadingMentees(true);
        try {
            const res = await api.get('/groups/mentees');
            setMentees(res.data);
        } catch (error) {
            console.error("Failed to fetch mentees", error);
        } finally {
            setLoadingMentees(false);
        }
    };

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const studentsRes = await api.get('/users/students');
            if (Array.isArray(studentsRes.data)) {
                setStudents(studentsRes.data);
            }
        } catch (error) {
            console.error("Failed to fetch students", error);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
        setActionLoading(id);
        try {
            const res = await api.put(`/projects/${id}/status`, { status, feedback });
            setProjects(prev => prev.map(p => p._id === id ? { ...p, status, feedback: res.data.feedback, updatedAt: res.data.updatedAt } : p));

            // Also update selectedProject if it's the one being modified
            if (selectedProject && selectedProject._id === id) {
                setSelectedProject(prev => prev ? { ...prev, status, feedback: res.data.feedback, updatedAt: res.data.updatedAt } : null);
            }

            setFeedback('');
            // Optional: Close dialog on success? Or let user see result?
            // User might want to close manually.
        } catch (error) {
            console.error(`Failed to ${status} project`, error);
            alert(`Failed to ${status} project`);
        } finally {
            setActionLoading(null);
        }
    };



    const handleGroupClick = async (group: any) => {
        setViewGroup(group);
        if (group.project?.hasNewUpdate) {
            try {
                await api.put(`/projects/${group.project._id}/updates/read`);
                // Update local state to reflect read status
                setMentees(prev => prev.map(m => m._id === group._id ? { ...m, project: { ...m.project, hasNewUpdate: false } } : m));
            } catch (error) {
                console.error("Failed to mark update as read", error);
            }
        }
    };

    const handleOpenEvaluation = (project: any, type: 'mid-term' | 'end-term') => {
        setEvaluatingProject(project);
        setEvaluationType(type);
        const existingEval = type === 'mid-term' ? project.project?.midTermEvaluation : project.project?.endTermEvaluation;
        setEvaluationMarks(existingEval?.marks || 0);
        setEvaluationRemarks(existingEval?.remarks || '');
    };

    const handleSubmitEvaluation = async () => {
        if (!evaluatingProject || !evaluationType) return;
        try {
            const projectId = evaluatingProject.project?._id || evaluatingProject._id; // Handle if passing mentee group or raw project
            await api.put(`/projects/${projectId}/evaluation`, {
                type: evaluationType,
                marks: evaluationMarks,
                remarks: evaluationRemarks
            });

            // Refresh Data
            await fetchMentees();
            setEvaluatingProject(null);
            setEvaluationType(null);
            setEvaluationMarks(0);
            setEvaluationRemarks('');
        } catch (error) {
            console.error("Failed to submit evaluation", error);
            alert("Failed to submit evaluation");
        }
    };


    const SidebarItem = ({ icon, label, active, onClick }: any) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
        >
            {icon}
            {label}
        </button>
    );

    // Filter Logic
    const getFilteredProjects = () => {
        return projects.filter(p => {
            let matches = true;

            const matchesSearch =
                p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.group.members.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) matches = false;

            if (filterBatch !== 'All') {
                const batchSuffix = filterBatch.slice(2);
                const hasMemberInBatch = p.group?.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                if (!hasMemberInBatch) matches = false;
            }

            if (activeTab === 'proposals') {
                if (proposalView === 'proposals') {
                    if ((p.status as string) !== 'Pending' && (p.status as string) !== 'Draft') matches = false;
                } else { // proposalView === 'approved'
                    if ((p.status as string) !== 'Approved') matches = false;
                }
            }

            return matches;
        });
    };

    const getFilteredMentees = () => {
        const filtered = mentees.filter(g => {
            const matchesSearch =
                g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.project?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.members.some((m: any) => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesBatch = filterBatch === 'All' || (() => {
                const batchSuffix = filterBatch.slice(2);
                return g.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
            })();

            return matchesSearch && matchesBatch;
        });

        // Sort: Has Update First
        return filtered.sort((a, b) => {
            const aUpdate = a.project?.hasNewUpdate ? 1 : 0;
            const bUpdate = b.project?.hasNewUpdate ? 1 : 0;
            return bUpdate - aUpdate;
        });
    };

    const filteredProjects = getFilteredProjects();
    const filteredMentees = getFilteredMentees();
    const displayItems = activeTab === 'proposals' ? filteredProjects : filteredMentees;

    // Calculate stats from approved projects based on current filter
    const approvedInView = projects.filter(p => {
        const isApproved = p.status === 'Approved';

        let matchesBatch = true;
        if (filterBatch !== 'All') {
            const batchSuffix = filterBatch.slice(2);
            const hasMemberInBatch = p.group?.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
            matchesBatch = hasMemberInBatch || false;
        }

        return isApproved && matchesBatch;
    });

    const currentTeamsCount = approvedInView.length;
    const currentStudentsCount = approvedInView.reduce((acc, p) => acc + (p.group?.members?.length || 0), 0);

    return (
        <div className="flex h-screen bg-neutral-50 font-jakarta text-neutral-900 overflow-hidden">
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
                        active={activeTab === 'directory'}
                        onClick={() => { setActiveTab('directory'); setViewGroup(null); }}
                    />
                    <SidebarItem
                        icon={<FileText className="w-5 h-5" />}
                        label="Project Proposals"
                        active={activeTab === 'proposals'}
                        onClick={() => { setActiveTab('proposals'); setViewGroup(null); }}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="My Mentees"
                        active={activeTab === 'mentees'}
                        onClick={() => { setActiveTab('mentees'); setViewGroup(null); }}
                    />
                    <SidebarItem
                        icon={<Settings className="w-5 h-5" />}
                        label="My Profile"
                        active={activeTab === 'profile'}
                        onClick={() => { setActiveTab('profile'); setViewGroup(null); }}
                    />

                    <div className="pt-4 border-t border-neutral-100 mt-4">
                        <p className="px-4 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Evaluations</p>
                        <SidebarItem
                            icon={<GraduationCap className="w-5 h-5" />}
                            label="Mid-Term Eval"
                            active={activeTab === 'mid-term'}
                            onClick={() => { setActiveTab('mid-term'); setViewGroup(null); }}
                        />
                        <SidebarItem
                            icon={<Medal className="w-5 h-5" />}
                            label="End-Term Eval"
                            active={activeTab === 'end-term'}
                            onClick={() => { setActiveTab('end-term'); setViewGroup(null); }}
                        />
                    </div>
                </nav>
                <div className="p-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
                            {user?.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-neutral-900 truncate">{user?.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
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
                        <h1 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
                            {activeTab === 'mentees' && viewGroup ? (
                                <>
                                    <span onClick={() => setViewGroup(null)} className="cursor-pointer hover:text-indigo-600 transition-colors">My Mentees</span>
                                    <ChevronRight className="w-5 h-5 text-neutral-400" />
                                    <span className="text-neutral-900">{viewGroup.name}</span>
                                </>
                            ) : (
                                activeTab === 'proposals' ? 'Project Proposals' :
                                    activeTab === 'mentees' ? 'My Mentees' :
                                        activeTab === 'directory' ? 'Student Directory' :
                                            activeTab === 'mid-term' ? 'Mid-Term Evaluation' :
                                                activeTab === 'end-term' ? 'End-Term Evaluation' :
                                                    'My Profile'
                            )}
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'profile' ? (
                        /* Profile View */
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-white p-10 rounded-3xl border border-neutral-200 shadow-sm text-center">
                                <div className="h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 font-bold text-3xl">
                                    {user?.name.charAt(0)}
                                </div>
                                <h2 className="text-3xl font-bold text-neutral-900">{user?.name}</h2>
                                <p className="text-lg text-neutral-500 mt-2">{user?.email}</p>
                                <div className="mt-8 flex justify-center gap-4">
                                    <div className="px-6 py-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                                        <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Role</p>
                                        <p className="font-semibold text-neutral-900">{user?.role}</p>
                                    </div>
                                    <div className="px-6 py-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                                        <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Department</p>
                                        <p className="font-semibold text-neutral-900">{user?.department || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto flex flex-col h-full">

                            {/* Top Toolbar: Search (Left) + Stats & Filters (Right) */}
                            {/* Top Toolbar: Search (Left) + Stats & Filters (Right) */}
                            {!viewGroup && (
                                <div className="flex flex-col gap-5 mb-8">
                                    {/* Row 1: Search Bar */}
                                    <div className="relative w-full">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                        <input
                                            type="text"
                                            placeholder={activeTab === 'directory' ? "Search students by name or roll number..." : "Search projects, students, groups..."}
                                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all bg-white shadow-sm text-base"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {/* Row 2: Filters (Left) and Stats/Toggles (Right) */}
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        {/* Filters - Left Side */}
                                        <div className="flex gap-4 items-center">
                                            {activeTab === 'proposals' && (
                                                <div className="flex p-1 bg-neutral-100 rounded-xl border border-neutral-200">
                                                    <button
                                                        onClick={() => setProposalView('proposals')}
                                                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${proposalView === 'proposals' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                                                    >
                                                        Proposals
                                                    </button>
                                                    <button
                                                        onClick={() => setProposalView('approved')}
                                                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${proposalView === 'approved' ? 'bg-white text-emerald-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                                                    >
                                                        Approved
                                                    </button>
                                                </div>
                                            )}

                                            {activeTab === 'directory' ? (
                                                <>
                                                    <select
                                                        className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                        value={filterStatus}
                                                        onChange={(e) => setFilterStatus(e.target.value as any)}
                                                    >
                                                        <option value="All">Status: All</option>
                                                        <option value="Grouped">Grouped</option>
                                                        <option value="Available">Available</option>
                                                    </select>
                                                    <select
                                                        className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                        value={filterBranch}
                                                        onChange={(e) => setFilterBranch(e.target.value)}
                                                    >
                                                        <option value="All">Branch: All</option>
                                                        <option value="CSE">CSE</option>
                                                        <option value="DSAI">DSAI</option>
                                                        <option value="ECE">ECE</option>
                                                    </select>
                                                    <select
                                                        className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                        value={filterDirectoryYear}
                                                        onChange={(e) => setFilterDirectoryYear(e.target.value)}
                                                    >
                                                        <option value="All">Batch: All</option>
                                                        {Array.from({ length: 10 }, (_, i) => 2020 + i).map(y => (
                                                            <option key={y} value={y.toString()}>{y}</option>
                                                        ))}
                                                    </select>
                                                </>
                                            ) : (
                                                <select
                                                    className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                    value={filterBatch}
                                                    onChange={(e) => setFilterBatch(e.target.value)}
                                                >
                                                    <option value="All">Batch: All</option>
                                                    {Array.from({ length: 10 }, (_, i) => 2020 + i).map(year => (
                                                        <option key={year} value={year.toString()}>{year}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>

                                        {/* Stats & View Toggle - Right Side */}
                                        <div className="flex items-center gap-4">
                                            {/* Stats Badges */}
                                            {activeTab === 'mentees' && filterBatch !== 'All' && (
                                                <div className="flex items-center gap-3">
                                                    <div className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl border border-indigo-100 flex items-center gap-3 shadow-sm">
                                                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                                                            <Users className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Batch {filterBatch} Teams</span>
                                                            <span className="text-base font-bold leading-none">
                                                                {currentTeamsCount} <span className="text-indigo-200 text-sm">/ {user?.maxGroups || 7}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="px-5 py-2.5 bg-white text-emerald-600 rounded-xl border border-emerald-100 flex items-center gap-3 shadow-sm">
                                                        <div className="p-1.5 bg-emerald-50 rounded-lg">
                                                            <Users className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Batch {filterBatch} Students</span>
                                                            <span className="text-base font-bold leading-none">
                                                                {currentStudentsCount} <span className="text-emerald-200 text-sm">/ {user?.maxStudents || 21}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* View Toggle (Only for Mentees tab) */}
                                            {activeTab === 'mentees' && (
                                                <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                                                    <button
                                                        onClick={() => setViewMode('grid')}
                                                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-400 hover:text-neutral-600'}`}
                                                    >
                                                        <LayoutGrid className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMode('list')}
                                                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-400 hover:text-neutral-600'}`}
                                                    >
                                                        <LayoutList className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Content Grid */}
                            {activeTab === 'directory' ? (
                                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-neutral-50 border-b border-neutral-200">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold text-neutral-500">Roll Number</th>
                                                <th className="px-6 py-3 font-semibold text-neutral-500">Name</th>
                                                <th className="px-6 py-3 font-semibold text-neutral-500">Email</th>
                                                <th className="px-6 py-3 font-semibold text-neutral-500">Branch</th>
                                                <th className="px-6 py-3 font-semibold text-neutral-500 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-100">
                                            {loadingStudents ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                        Loading students directory...
                                                    </td>
                                                </tr>
                                            ) : students.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                        No students found.
                                                    </td>
                                                </tr>
                                            ) : students.filter(s => {
                                                const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    s.rollNumber?.includes(searchTerm);
                                                const matchesStatus = filterStatus === 'All' ||
                                                    (filterStatus === 'Grouped' ? s.isGrouped : !s.isGrouped);
                                                const matchesBranch = filterBranch === 'All' || s.branch === filterBranch;
                                                const matchesYear = filterDirectoryYear === 'All' ||
                                                    (s.batch === filterDirectoryYear) ||
                                                    (s.rollNumber && (s.rollNumber.startsWith(filterDirectoryYear.slice(2)) || s.rollNumber.startsWith(filterDirectoryYear)));

                                                return matchesSearch && matchesStatus && matchesBranch && matchesYear;
                                            }).map(student => (
                                                <tr key={student._id} className="hover:bg-neutral-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-neutral-600">{student.rollNumber || '-'}</td>
                                                    <td className="px-6 py-4 font-medium text-neutral-900">{student.name}</td>
                                                    <td className="px-6 py-4 text-neutral-500">{student.email}</td>
                                                    <td className="px-6 py-4 text-neutral-500">{student.branch || '-'}</td>
                                                    <td className="px-6 py-4 text-center">
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
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (loading || loadingMentees) ? (
                                <div className="text-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                                    <p className="mt-4 text-gray-500">Loading...</p>
                                </div>
                            ) : displayItems.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-200">
                                    <div className="h-16 w-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText className="h-8 w-8 text-neutral-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-neutral-900">No items found</h3>
                                    <p className="text-neutral-500">Try adjusting your filters or search terms.</p>
                                </div>
                            ) : (
                                <>
                                    {viewMode === 'list' && activeTab === 'mentees' ? (
                                        <div className="space-y-12 pb-20">
                                            {/* Logic to render sections if filterBatch is All, else just one section */}
                                            {viewGroup ? (
                                                <MenteeGroupDetails
                                                    group={viewGroup}
                                                    user={user}
                                                    onBack={() => setViewGroup(null)}
                                                    onUpdateSuccess={fetchMentees}
                                                />
                                            ) : (
                                                (filterBatch === 'All' ? Array.from({ length: 10 }, (_, i) => 2020 + i).reverse() : [parseInt(filterBatch || '0')]).map(batchYear => {
                                                    if (filterBatch !== 'All' && batchYear === 0) return null; // Safe guard

                                                    const batchSuffix = batchYear.toString().slice(2);
                                                    const batchMentees = filterBatch === 'All'
                                                        ? displayItems.filter((item: any) => {
                                                            const members = item.members || item.group?.members || [];
                                                            return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                        })
                                                        : displayItems; // If specific batch filter, displayItems is already filtered

                                                    if (batchMentees.length === 0) return null;

                                                    const teamsCount = batchMentees.length;
                                                    const studentsCount = batchMentees.reduce((acc: number, item: any) => acc + (item.members?.length || item.group?.members?.length || 0), 0);

                                                    return (
                                                        <div key={batchYear} className="space-y-6">
                                                            {filterBatch === 'All' && (
                                                                <div className="flex items-center gap-6">
                                                                    <div className="flex items-baseline gap-3">
                                                                        <h3 className="text-2xl font-bold text-neutral-900">Batch {batchYear}</h3>
                                                                        <span className="text-sm font-medium text-neutral-400">{batchMentees.length} Active Projects</span>
                                                                    </div>
                                                                    <div className="h-px bg-neutral-100 flex-1"></div>
                                                                    <div className="flex gap-4">
                                                                        <div className="px-4 py-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 flex items-center gap-2 shadow-sm">
                                                                            <div className="p-1 bg-indigo-50 rounded-lg">
                                                                                <Users className="w-3 h-3" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Teams</span>
                                                                                <span className="text-sm font-bold leading-none">{teamsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="px-4 py-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 flex items-center gap-2 shadow-sm">
                                                                            <div className="p-1 bg-emerald-50 rounded-lg">
                                                                                <Users className="w-3 h-3" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Students</span>
                                                                                <span className="text-sm font-bold leading-none">{studentsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left">
                                                                        <thead className="bg-neutral-50 border-b border-neutral-100">
                                                                            <tr>
                                                                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider w-1/3">Project Details</th>
                                                                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Members</th>
                                                                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                                                                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Last Update</th>
                                                                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Action</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-neutral-100">
                                                                            {batchMentees.map((item: any) => (
                                                                                <tr
                                                                                    key={item._id}
                                                                                    onClick={() => handleGroupClick(item)}
                                                                                    className={`cursor-pointer transition-all group ${item.project?.hasNewUpdate
                                                                                        ? 'bg-amber-50/50 hover:bg-amber-50 relative'
                                                                                        : 'hover:bg-neutral-50'}`}
                                                                                >
                                                                                    {item.project?.hasNewUpdate && (
                                                                                        <td className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 animate-pulse"></td>
                                                                                    )}
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex flex-col gap-1">
                                                                                            <div className="flex items-start justify-between gap-2">
                                                                                                <span className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-base">
                                                                                                    {item.project?.title || item.name}
                                                                                                </span>
                                                                                                {item.project?.hasNewUpdate && (
                                                                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase rounded-md shadow-sm whitespace-nowrap">
                                                                                                        New Update
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                                                                                                <Users className="w-3 h-3" />
                                                                                                {item.name}
                                                                                            </span>
                                                                                            {item.project?.tags && item.project.tags.length > 0 && (
                                                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                                                    {item.project.tags.slice(0, 3).map((tag: string, i: number) => (
                                                                                                        <span key={i} className="px-1.5 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] rounded border border-neutral-200">
                                                                                                            {tag}
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex -space-x-2">
                                                                                            {item.members.slice(0, 3).map((m: any, idx: number) => (
                                                                                                <div key={idx} className="h-8 w-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-600 hover:z-10 transition-transform hover:scale-110" title={m.name}>
                                                                                                    {m.name.charAt(0)}
                                                                                                </div>
                                                                                            ))}
                                                                                            {item.members.length > 3 && (
                                                                                                <div className="h-8 w-8 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-xs font-bold text-neutral-500">
                                                                                                    +{item.members.length - 3}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${(item.status || item.project?.status) === 'Approved' ? 'bg-green-100 text-green-700' :
                                                                                            (item.status || item.project?.status) === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                                                                'bg-indigo-100 text-indigo-700'
                                                                                            }`}>
                                                                                            <div className={`w-1.5 h-1.5 rounded-full ${(item.status || item.project?.status) === 'Approved' ? 'bg-green-500' :
                                                                                                (item.status || item.project?.status) === 'Rejected' ? 'bg-red-500' :
                                                                                                    'bg-indigo-500'
                                                                                                }`} />
                                                                                            {item.status || item.project?.status || 'Active'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-neutral-500 font-mono text-xs">
                                                                                        {new Date(item.project?.updatedAt || item.createdAt).toLocaleDateString()}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-right">
                                                                                        <div className="inline-flex items-center gap-1 text-indigo-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                            View <ChevronRight className="w-3 h-3" />
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }))}
                                        </div>
                                    ) : activeTab === 'mid-term' || activeTab === 'end-term' ? (
                                        /* EVALUATION VIEW - Grouped by Semester */
                                        <div className="space-y-12 pb-20">
                                            {Array.from({ length: 10 }, (_, i) => 2020 + i).reverse().map(batchYear => {
                                                const batchSuffix = batchYear.toString().slice(2);
                                                const batchProjects = filteredMentees.filter((item: any) => {
                                                    const members = item.members || item.group?.members || [];
                                                    return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                });

                                                if (batchProjects.length === 0) return null;

                                                return (
                                                    <div key={batchYear} className="space-y-4">
                                                        <div className="flex items-center gap-4">
                                                            <h3 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
                                                                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm">
                                                                    {batchSuffix}
                                                                </span>
                                                                Batch {batchYear}
                                                            </h3>
                                                            <div className="h-px bg-neutral-200 flex-1"></div>
                                                            <span className="text-sm font-medium text-neutral-400 bg-white px-3 py-1 rounded-full border border-neutral-100 shadow-sm">
                                                                {batchProjects.length} Projects
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {batchProjects.map((item: any) => {
                                                                const projectData = item.project;
                                                                const evalData = activeTab === 'mid-term' ? projectData?.midTermEvaluation : projectData?.endTermEvaluation;
                                                                const isEvaluated = !!evalData;

                                                                return (
                                                                    <div key={item._id} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                                        {isEvaluated && (
                                                                            <div className="absolute top-0 right-0 p-3 bg-green-50 rounded-bl-2xl border-l border-b border-green-100 text-green-700 flex items-center gap-1.5 font-bold text-xs z-10">
                                                                                <CheckCircle className="w-4 h-4" /> Evaluated
                                                                            </div>
                                                                        )}

                                                                        <div className="mb-4">
                                                                            <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1 pr-8" title={projectData?.title}>{projectData?.title || 'Untitled Project'}</h3>
                                                                            <p className="text-sm text-neutral-500 font-medium flex items-center gap-1.5 align-middle">
                                                                                <Users className="w-4 h-4" /> {item.name}
                                                                            </p>
                                                                        </div>

                                                                        <div className="mb-6">
                                                                            <div className="flex -space-x-2 mb-2 pl-1">
                                                                                {item.members.slice(0, 4).map((m: any, idx: number) => (
                                                                                    <div key={idx} className="h-8 w-8 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-600 shadow-sm tooltip-trigger" title={m.name}>
                                                                                        {m.name.charAt(0)}
                                                                                    </div>
                                                                                ))}
                                                                                {item.members.length > 4 && (
                                                                                    <div className="h-8 w-8 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-xs font-bold text-neutral-500 shadow-sm">
                                                                                        +{item.members.length - 4}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex flex-col gap-3 group-hover:border-indigo-100 transition-colors">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Score</span>
                                                                                <span className={`text-xl font-bold ${isEvaluated ? 'text-indigo-600' : 'text-neutral-300'}`}>
                                                                                    {isEvaluated ? evalData.marks : '--'} <span className="text-sm text-neutral-400 font-medium">/ 100</span>
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleOpenEvaluation(item, activeTab as 'mid-term' | 'end-term')}
                                                                                className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${isEvaluated
                                                                                    ? 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-indigo-600 hover:border-indigo-200'
                                                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5'
                                                                                    }`}
                                                                            >
                                                                                {isEvaluated ? 'Edit Evaluation' : 'Evaluate Now'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Fallback if no projects found in semesters (e.g. data missing semester) */}
                                            {/* Note: In a real app, handle unclassified projects. For now, assuming all have semester or we filter tightly. */}
                                            {filteredMentees.length === 0 && (
                                                <div className="text-center py-20">
                                                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                                                        <FileText className="w-8 h-8" />
                                                    </div>
                                                    <h3 className="text-lg font-bold text-neutral-900 mb-2">No Projects Found</h3>
                                                    <p className="text-neutral-500 max-w-md mx-auto">
                                                        There are no projects assigned for evaluation matching your filters.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                    ) : (
                                        <div className="pb-20">
                                            {activeTab === 'mentees' && viewGroup ? (
                                                <MenteeGroupDetails
                                                    group={viewGroup}
                                                    user={user}
                                                    onBack={() => setViewGroup(null)}
                                                    onUpdateSuccess={fetchMentees}
                                                />
                                            ) : activeTab === 'mentees' && filterBatch === 'All' ? (
                                                <div className="space-y-12">
                                                    {Array.from({ length: 10 }, (_, i) => 2020 + i).reverse().map(batchYear => {
                                                        const batchSuffix = batchYear.toString().slice(2);
                                                        const batchMentees = displayItems.filter((item: any) => {
                                                            const members = item.members || item.group?.members || [];
                                                            return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                        });

                                                        if (batchMentees.length === 0) return null;

                                                        const teamsCount = batchMentees.length;
                                                        const studentsCount = batchMentees.reduce((acc: number, item: any) => acc + (item.members?.length || item.group?.members?.length || 0), 0);

                                                        return (
                                                            <div key={batchYear} className="space-y-6">
                                                                <div className="flex items-center gap-6">
                                                                    <div className="flex items-baseline gap-3">
                                                                        <h3 className="text-2xl font-bold text-neutral-900">Batch {batchYear}</h3>
                                                                        <span className="text-sm font-medium text-neutral-400">{batchMentees.length} Active Projects</span>
                                                                    </div>
                                                                    <div className="h-px bg-neutral-100 flex-1"></div>
                                                                    <div className="flex gap-4">
                                                                        <div className="px-4 py-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 flex items-center gap-2 shadow-sm">
                                                                            <div className="p-1 bg-indigo-50 rounded-lg">
                                                                                <Users className="w-3 h-3" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Teams</span>
                                                                                <span className="text-sm font-bold leading-none">{teamsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="px-4 py-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 flex items-center gap-2 shadow-sm">
                                                                            <div className="p-1 bg-emerald-50 rounded-lg">
                                                                                <Users className="w-3 h-3" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Students</span>
                                                                                <span className="text-sm font-bold leading-none">{studentsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                                                                    {batchMentees.map((item: any) => (
                                                                        <MenteeCard
                                                                            key={item._id}
                                                                            item={item}
                                                                            activeTab={activeTab}
                                                                            navigate={navigate}
                                                                            setSelectedProject={activeTab === 'mentees' ? handleGroupClick : setSelectedProject}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 auto-rows-fr">
                                                    {displayItems.map((item: any) => (
                                                        <MenteeCard
                                                            key={item._id}
                                                            item={item}
                                                            activeTab={activeTab}
                                                            navigate={navigate}
                                                            setSelectedProject={activeTab === 'mentees' ? handleGroupClick : setSelectedProject}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Project Details Modal */}
            <Dialog.Root open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[90vh] flex flex-col focus:outline-none">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
                            <Dialog.Title className="text-xl font-bold text-neutral-900">
                                {selectedProject?.title}
                            </Dialog.Title>
                            <Dialog.Close className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </Dialog.Close>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="space-y-6">
                                <div className="flex flex-wrap gap-2">

                                    <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-2">Description</h4>
                                    <p className="text-neutral-600 leading-relaxed">
                                        {selectedProject?.description}
                                    </p>
                                </div>

                                {selectedProject?.tags && selectedProject.tags.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-2">Technologie & Tags</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedProject.tags.map((tag: string, i: number) => (
                                                <span key={i} className="px-3 py-1 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-sm shadow-sm">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments */}
                                {selectedProject?.attachments && selectedProject.attachments.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-2">Project Files</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {selectedProject.attachments.map((url: string, i: number) => (
                                                <FilePreview key={i} url={url} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Group</h4>
                                        <p className="font-bold text-neutral-900">{selectedProject?.group?.name}</p>
                                    </div>
                                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Leader</h4>
                                        <p className="font-bold text-neutral-900">{(selectedProject as any)?.leader?.name}</p>
                                    </div>
                                </div>
                                {(selectedProject as any)?.members && (
                                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Team Members</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {(selectedProject as any).members.map((m: any) => (
                                                <span key={m._id} className="px-2 py-1 bg-white rounded border border-neutral-200 text-sm">{m.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Footer */}
                        {(selectedProject?.status === 'Pending' || (selectedProject?.status as any) === 'Draft') && (
                            <div className="p-6 border-t border-neutral-100 bg-neutral-50">
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-neutral-700 mb-1">Feedback / Remarks (Optional)</label>
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Add comments specifically for Rejection or modifications..."
                                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                        rows={2}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => selectedProject && handleAction(selectedProject._id, 'Approved')}
                                        disabled={!!actionLoading}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === 'Approved' ? 'Processing...' : <><CheckCircle className="w-4 h-4" /> Approve Proposal</>}
                                    </button>
                                    <button
                                        onClick={() => selectedProject && handleAction(selectedProject._id, 'Rejected')}
                                        disabled={!!actionLoading}
                                        className="flex-1 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === 'Rejected' ? 'Processing...' : <><XCircle className="w-4 h-4" /> Reject</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* View Dashboard Button for Approved Projects */}
                        {selectedProject?.status === 'Approved' && (
                            <div className="p-6 border-t border-neutral-100 bg-neutral-50">
                                <button
                                    onClick={() => {
                                        if (selectedProject?.group?._id) {
                                            navigate(`/faculty/group/${selectedProject.group._id}`);
                                        } else {
                                            // Fallback if no group ID (shouldn't happen for approved)
                                            console.error("No group ID for project", selectedProject);
                                        }
                                    }}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                >
                                    View Project Dashboard <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Evaluation Modal */}
            <Dialog.Root open={!!evaluatingProject} onOpenChange={(open) => !open && setEvaluatingProject(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col focus:outline-none max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
                            <Dialog.Title className="text-xl font-bold text-neutral-900">
                                {evaluationType === 'mid-term' ? 'Mid-Term Evaluation' : 'End-Term Evaluation'}
                            </Dialog.Title>
                            <Dialog.Close className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </Dialog.Close>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Project Info Section */}
                            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100 space-y-4">
                                <div>
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <h4 className="text-lg font-bold text-neutral-900">{evaluatingProject?.project?.title || evaluatingProject?.title}</h4>
                                        <span className="px-3 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap">
                                            {evaluatingProject?.group?.name || evaluatingProject?.name}
                                        </span>
                                    </div>
                                    <p className="text-neutral-600 text-sm leading-relaxed">
                                        {evaluatingProject?.project?.description || "No description provided."}
                                    </p>
                                </div>

                                {evaluatingProject?.project?.tags && evaluatingProject.project.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {evaluatingProject.project.tags.map((tag: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-white border border-neutral-200 text-neutral-500 rounded text-xs">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Team Members */}
                                <div>
                                    <h5 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Users className="w-3 h-3" /> Team Members
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {evaluatingProject?.members?.map((member: any) => (
                                            <div key={member._id} className="flex items-center gap-3 bg-white p-2 rounded-xl border border-neutral-100">
                                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-neutral-900 truncate">{member.name}</p>
                                                    <p className="text-xs text-neutral-500 truncate font-mono">{member.rollNumber}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-neutral-100 w-full"></div>

                            {/* Evaluation Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-neutral-700 mb-2">Marks (0-100)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={evaluationMarks}
                                            onChange={(e) => setEvaluationMarks(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-2xl font-bold font-mono text-center"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">/ 100</div>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-neutral-700 mb-2">Remarks & Feedback</label>
                                    <textarea
                                        value={evaluationRemarks}
                                        onChange={(e) => setEvaluationRemarks(e.target.value)}
                                        placeholder="Enter detailed feedback for the team..."
                                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm h-[120px] resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex gap-3">
                            <button
                                onClick={() => setEvaluatingProject(null)}
                                className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-600 font-bold rounded-xl hover:bg-neutral-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitEvaluation}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Submit Evaluation
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
};

export default FacultyDashboard;
