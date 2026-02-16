import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
    CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronUp, Users, ExternalLink, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


interface Project {
    _id: string;
    title: string;
    description: string;
    tags: string[];
    status: 'Pending' | 'Approved' | 'Rejected';
    group: {
        _id: string;
        name: string;
        members: {
            _id: string;
            name: string;
            email: string;
            rollNumber: string;
        }[];
    };
    attachments: string[];
    createdAt: string;
    feedback?: string;
}

const FacultyDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [activeActionId, setActiveActionId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<'proposals' | 'mentees' | 'profile'>('proposals');
    const [mentees, setMentees] = useState<any[]>([]);
    const [loadingMentees, setLoadingMentees] = useState(false);

    useEffect(() => {
        if (activeTab === 'proposals') {
            fetchProjects();
        } else if (activeTab === 'mentees') {
            fetchMentees();
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

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedIds(newExpanded);
    };

    const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
        setActionLoading(id);
        try {
            await api.put(`/projects/${id}/status`, { status, feedback });
            setProjects(projects.map(p => p._id === id ? { ...p, status, feedback } : p));
            setActiveActionId(null);
            setFeedback('');
        } catch (error) {
            console.error(`Failed to ${status} project`, error);
            alert(`Failed to ${status} project`);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
            case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Approved': return <CheckCircle className="w-4 h-4" />;
            case 'Rejected': return <XCircle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
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

    return (
        <div className="flex h-screen bg-neutral-50 font-jakarta text-neutral-900 overflow-hidden">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: isSidebarOpen ? 0 : -250 }}
                className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-neutral-200 transition-width duration-300 flex flex-col`}
            >
                <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Faculty Portal</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <SidebarItem
                        icon={<FileText className="w-5 h-5" />}
                        label="Project Proposals"
                        active={activeTab === 'proposals'}
                        onClick={() => setActiveTab('proposals')}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="My Mentees"
                        active={activeTab === 'mentees'}
                        onClick={() => setActiveTab('mentees')}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="My Profile"
                        active={activeTab === 'profile'}
                        onClick={() => setActiveTab('profile')}
                    />
                </nav>
                <div className="p-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {user?.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                        </div>
                    </div>
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
                <header className="flex items-center h-16 px-6 border-b border-neutral-200 bg-white justify-between">
                    <div className="flex items-center gap-4">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-neutral-100 rounded-lg">
                                <Menu className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-xl font-bold">
                            {activeTab === 'proposals' ? 'Project Proposals' : activeTab === 'mentees' ? 'My Mentees' : 'My Profile'}
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'proposals' ? (
                        <div className="max-w-5xl mx-auto">
                            <div className="mb-8 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">Received Proposals</h2>
                                    <p className="text-gray-500 mt-1">Review and manage student project submissions.</p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                                    <p className="mt-4 text-gray-500">Loading projects...</p>
                                </div>
                            ) : projects.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">No Proposals Yet</h3>
                                    <p className="text-gray-500 max-w-md mx-auto mt-2">
                                        You haven't received any project proposals from student groups yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {projects.map(project => (
                                        <motion.div
                                            key={project._id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`bg-white rounded-xl border transition-all shadow-sm overflow-hidden ${expandedIds.has(project._id) ? 'border-indigo-200 ring-4 ring-indigo-50/50' : 'border-gray-200 hover:border-indigo-100'
                                                }`}
                                        >
                                            <div
                                                onClick={() => toggleExpand(project._id)}
                                                className="p-6 cursor-pointer flex items-start justify-between group"
                                            >
                                                <div className="flex gap-4">
                                                    <div className={`mt-1 p-2 rounded-lg ${project.status === 'Pending' ? 'bg-yellow-50 text-yellow-600' :
                                                        project.status === 'Approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                                        }`}>
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                            {project.title}
                                                        </h3>
                                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Users className="w-4 h-4" /> {project.group.name}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(project.status)}`}>
                                                        {getStatusIcon(project.status)}
                                                        {project.status}
                                                    </div>
                                                    <button className="text-gray-400 hover:text-indigo-600 transition-colors">
                                                        {expandedIds.has(project._id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {expandedIds.has(project._id) && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="border-t border-gray-100 bg-gray-50/50"
                                                    >
                                                        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                            <div className="lg:col-span-2 space-y-6">
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Description</h4>
                                                                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{project.description}</p>
                                                                </div>

                                                                {project.attachments.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Attachments</h4>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {project.attachments.map((link, i) => (
                                                                                <a
                                                                                    key={i}
                                                                                    href={link}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-indigo-600 hover:text-indigo-800 hover:border-indigo-200 transition-colors"
                                                                                >
                                                                                    <ExternalLink className="w-3 h-3" /> Resource {i + 1}
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {project.status !== 'Pending' && project.feedback && (
                                                                    <div className={`border p-4 rounded-lg ${project.status === 'Approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                                                                        }`}>
                                                                        <h4 className={`text-sm font-semibold mb-1 ${project.status === 'Approved' ? 'text-green-800' : 'text-red-800'
                                                                            }`}>Admin Feedback:</h4>
                                                                        <p className={`text-sm ${project.status === 'Approved' ? 'text-green-700' : 'text-red-700'
                                                                            }`}>{project.feedback}</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="space-y-6">
                                                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                        <Users className="w-4 h-4" /> Group Members
                                                                    </h4>
                                                                    <div className="space-y-3">
                                                                        {project.group.members.map(member => (
                                                                            <div key={member._id} className="flex items-center gap-3 text-sm">
                                                                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-medium text-gray-600">
                                                                                    {member.name.charAt(0)}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-gray-900 font-medium">{member.name}</p>
                                                                                    <p className="text-gray-500 text-xs">{member.rollNumber}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {project.status === 'Pending' && (
                                                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Action Required</h4>

                                                                        {activeActionId === project._id ? (
                                                                            <div className="space-y-3 animate-fadeIn">
                                                                                <textarea
                                                                                    className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                                                    placeholder="Add feedback or comments (optional)..."
                                                                                    rows={3}
                                                                                    value={feedback}
                                                                                    onChange={e => setFeedback(e.target.value)}
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <button
                                                                                        onClick={() => handleAction(project._id, 'Approved')}
                                                                                        disabled={!!actionLoading}
                                                                                        className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                                                                    >
                                                                                        {actionLoading === project._id ? 'Processing...' : 'Approve'}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleAction(project._id, 'Rejected')}
                                                                                        disabled={!!actionLoading}
                                                                                        className="flex-1 bg-red-600 text-white text-sm py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                                                                    >
                                                                                        {actionLoading === project._id ? 'Processing...' : 'Reject'}
                                                                                    </button>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => setActiveActionId(null)}
                                                                                    className="w-full text-center text-xs text-gray-500 hover:text-gray-700 mt-2"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => setActiveActionId(project._id)}
                                                                                    className="flex-1 bg-indigo-600 text-white text-sm py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                                                                                >
                                                                                    Review Proposal
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'mentees' ? (
                        <div className="max-w-6xl mx-auto">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-800">My Mentees</h2>
                                <p className="text-gray-500 mt-1">Student groups working under your supervision.</p>
                            </div>

                            {loadingMentees ? (
                                <div className="text-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                                    <p className="mt-4 text-gray-500">Loading mentees...</p>
                                </div>
                            ) : mentees.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Users className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">No Mentees assigned</h3>
                                    <p className="text-gray-500 max-w-md mx-auto mt-2">
                                        You don't have any student groups assigned to you yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {mentees.map(group => (
                                        <div key={group._id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-full transition-all ${group.project?.hasNewUpdate ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-indigo-200'
                                            }`}>
                                            <div className="p-6 flex-1">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1" title={group.name}>{group.name}</h3>
                                                        {group.project?.hasNewUpdate && (
                                                            <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full animate-pulse">
                                                                New Update
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded font-medium shrink-0">
                                                        {group.members.length} Members
                                                    </span>
                                                </div>

                                                <div className="space-y-3 mb-6">
                                                    {group.members.slice(0, 3).map((member: any) => (
                                                        <div key={member._id} className="flex items-center gap-3 text-sm">
                                                            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center font-medium text-xs text-gray-600 shrink-0">
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            <span className="text-gray-700 truncate">{member.name}</span>
                                                        </div>
                                                    ))}
                                                    {group.members.length > 3 && (
                                                        <p className="text-xs text-gray-500 pl-9">+{group.members.length - 3} more</p>
                                                    )}
                                                </div>

                                                {group.project && (
                                                    <div className="pt-4 border-t border-gray-100">
                                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Project</p>
                                                        <p className="font-medium text-gray-900 line-clamp-2" title={group.project.title}>
                                                            {group.project.title}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 mt-auto">
                                                <button
                                                    onClick={() => navigate(`/faculty/group/${group._id}`)}
                                                    className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white p-8 rounded-xl border border-neutral-200 shadow-sm text-center">
                                <div className="h-20 w-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 font-bold text-2xl">
                                    {user?.name.charAt(0)}
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
                                <p className="text-gray-500">{user?.email}</p>
                                <div className="mt-6 flex justify-center gap-4">
                                    <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Role</p>
                                        <p className="font-medium text-gray-900">{user?.role}</p>
                                    </div>
                                    <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Department</p>
                                        <p className="font-medium text-gray-900">{user?.department || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default FacultyDashboard;
