import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Layout, Users, CheckSquare, MessageSquare, Menu, Clock, Calendar, X, ChevronRight, Plus, Archive, FileText, Search, Square } from 'lucide-react';
import FilePreview from '../components/FilePreview';
import AdminDashboard from './AdminDashboard';
import FacultyDashboard from './FacultyDashboard';
import Chat from '../components/Chat';
import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';

interface Group {
    _id: string;
    name: string;
    members: any[];
    status: string;
    project?: any;
    projects?: any[];
}

interface Student {
    _id: string;
    name: string;
    email: string;
    rollNumber: string;
    branch: string;
    semester: number;
    isGrouped: boolean;
}

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<'directory' | 'project' | 'group' | 'archive'>('directory');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterBranch, setFilterBranch] = useState<string>('all');

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isProposalWarningOpen, setIsProposalWarningOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [creatingGroup, setCreatingGroup] = useState(false);

    // Leave Group State
    const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
    const [leavePassword, setLeavePassword] = useState('');
    const [leavingGroup, setLeavingGroup] = useState(false);
    const [updateContent, setUpdateContent] = useState('');
    const [updateTitle, setUpdateTitle] = useState('');
    const [updateLinks, setUpdateLinks] = useState('');
    const [updateFiles, setUpdateFiles] = useState<FileList | null>(null);
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
    const [isUpdateSubmitting, setIsUpdateSubmitting] = useState(false);

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

    const fetchDashboardData = async () => {
        try {
            // Fetch group info
            const groupRes = await api.get('/groups/my').catch(() => null);
            if (groupRes) {
                setGroup(groupRes.data);
                setActiveTab('project');
            }
            // Initial fetch of students
            await fetchStudents();
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'Student') {
            fetchDashboardData();
        } else {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.role === 'Student') {
            fetchStudents();
        }
    }, [filterStatus, filterBranch]);

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
        if (!groupName.trim()) return;
        setCreatingGroup(true);
        try {
            await api.post('/groups', {
                name: groupName,
                members: Array.from(selectedStudents)
            });
            // Refresh state
            const groupRes = await api.get('/groups/my');
            setGroup(groupRes.data);
            setIsDialogOpen(false);
            setActiveTab('project');
        } catch (error) {
            console.error("Failed to create group", error);
            alert("Failed to create group.");
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

    const handlePostUpdate = async () => {
        if (!group?.project?._id || !updateTitle.trim() || !updateContent.trim()) return;

        setIsUpdateSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', updateTitle);
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
            // Refresh group data to show new update
            await fetchDashboardData();
            setUpdateTitle('');
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

    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.rollNumber && student.rollNumber.includes(searchTerm))
    ).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-neutral-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (user?.role === 'Admin') return <AdminDashboard />;
    if (user?.role === 'Faculty') return <FacultyDashboard />;

    return (
        <div className="flex h-screen bg-neutral-50 font-jakarta text-neutral-900 overflow-hidden">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: isSidebarOpen ? 0 : -250 }}
                className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-neutral-200 transition-width duration-300 flex flex-col`}
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
                            onClick={() => setActiveTab('directory')}
                        />
                    )}
                    {group && (
                        <>
                            <SidebarItem
                                icon={<FileText className="w-5 h-5" />}
                                label="My Project"
                                active={activeTab === 'project'}
                                onClick={() => setActiveTab('project')}
                            />
                            <SidebarItem
                                icon={<Users className="w-5 h-5" />}
                                label="My Group"
                                active={activeTab === 'group'}
                                onClick={() => setActiveTab('group')}
                            />
                        </>
                    )}
                    <SidebarItem
                        icon={<Archive className="w-5 h-5" />}
                        label="Archive"
                        active={activeTab === 'archive'}
                        onClick={() => setActiveTab('archive')}
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
                        <div>
                            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-0.5">
                                <span>Portal</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>{activeTab === 'directory' ? 'Directory' : 'My Project'}</span>
                            </div>
                            <h1 className="text-xl font-bold text-neutral-800">
                                {activeTab === 'directory' ? 'Student Directory' : 'Project Workspace'}
                            </h1>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'directory' && (
                        /* Directory View */
                        <div className="max-w-5xl mx-auto space-y-6">
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
                                {!group && (
                                    <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                        <Dialog.Trigger asChild>
                                            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                                                <Plus className="w-4 h-4" /> Form Group ({selectedStudents.size + 1})
                                            </button>
                                        </Dialog.Trigger>
                                        <Dialog.Portal>
                                            <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow" />
                                            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow">
                                                <Dialog.Title className="text-lg font-bold mb-4">Create New Group</Dialog.Title>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-neutral-700 mb-1">Group Name</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            placeholder="e.g. Phoenix Project"
                                                            value={groupName}
                                                            onChange={(e) => setGroupName(e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-neutral-700 mb-1">Members ({selectedStudents.size + 1})</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            <span className="px-2 py-1 bg-neutral-100 rounded text-xs text-neutral-600">You (Owner)</span>
                                                            {Array.from(selectedStudents).map(id => {
                                                                const s = students.find(stu => stu._id === id);
                                                                return s ? (
                                                                    <span key={id} className="px-2 py-1 bg-indigo-50 rounded text-xs text-indigo-700">{s.name}</span>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-3 mt-6">
                                                        <Dialog.Close asChild>
                                                            <button className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg">Cancel</button>
                                                        </Dialog.Close>
                                                        <button
                                                            onClick={handleCreateGroup}
                                                            disabled={!groupName.trim() || creatingGroup}
                                                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                                                        >
                                                            {creatingGroup ? 'Creating...' : 'Create Group'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </Dialog.Content>
                                        </Dialog.Portal>
                                    </Dialog.Root>
                                )}
                            </div>

                            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-neutral-50 border-b border-neutral-200">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold text-neutral-500 w-12"></th>
                                            <th className="px-6 py-3 font-semibold text-neutral-500">Roll Number</th>
                                            <th className="px-6 py-3 font-semibold text-neutral-500">Name</th>
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
                                                        <td className="px-6 py-4">
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
                                                        <td className="px-6 py-4 font-mono text-neutral-600">{student.rollNumber}</td>
                                                        <td className="px-6 py-4 font-medium text-neutral-900">
                                                            {student.name} {isMe && <span className="ml-2 text-xs text-neutral-400">(You)</span>}
                                                        </td>
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
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
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
                            ) : !group.project ? (
                                <div className="text-center py-20">
                                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-neutral-900">No Project Proposal</h3>
                                    <p className="text-neutral-500 mt-2">Your group hasn't submitted a project proposal yet.</p>
                                    <button
                                        onClick={() => navigate('/project/propose')}
                                        className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-sm"
                                    >
                                        Create Proposal
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                                    {/* Main Content: 3 Cols */}
                                    {/* Main Content: 3 Cols */}
                                    <div className="xl:col-span-3 space-y-6">



                                        {/* Project List */}
                                        {(group.projects || (group.project ? [group.project] : [])).map((project: any) => (
                                            <div key={project._id} className="space-y-6">
                                                {/* Project Status Stats */}
                                                <div className="bg-white p-8 rounded-2xl border border-neutral-100 shadow-xl shadow-neutral-100/50">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${project.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                    project.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                                        project.status === 'Archived' ? 'bg-gray-100 text-gray-700' :
                                                                            'bg-indigo-100 text-indigo-700'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'Approved' ? 'bg-emerald-500' :
                                                                        project.status === 'Rejected' ? 'bg-red-500' :
                                                                            project.status === 'Archived' ? 'bg-gray-500' :
                                                                                'bg-indigo-500'
                                                                        }`} />
                                                                    {project.status}
                                                                </span>
                                                                {project.semester && (
                                                                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                                                        Semester {project.semester}
                                                                    </span>
                                                                )}
                                                                {/* Show Faculty Name if available */}
                                                                {project.faculty && (
                                                                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                                                        <Users className="w-3 h-3" /> {project.faculty.name || 'Faculty'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h3 className="text-2xl font-bold text-neutral-900 mt-3 capitalize">{project.title}</h3>
                                                            <p className="text-neutral-500 mt-2 leading-relaxed max-w-2xl text-sm">{project.description}</p>
                                                        </div>

                                                        {(project.status === 'Rejected' || project.status === 'Draft' || project.status === 'Pending') && (
                                                            <div className="flex gap-2">
                                                                {(project.status === 'Rejected' || project.status === 'Draft' || project.status === 'Pending') && (
                                                                    <button
                                                                        onClick={() => navigate(`/project/propose?edit=${project._id}`)}
                                                                        className="text-sm border border-neutral-200 text-neutral-600 px-4 py-2 rounded-lg hover:bg-neutral-50 font-medium transition-colors"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                )}
                                                                {(project.status === 'Pending' || project.status === 'Draft') && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (confirm('Are you sure you want to delete this proposal?')) {
                                                                                try {
                                                                                    await api.delete(`/projects/${project._id}`);
                                                                                    window.location.reload();
                                                                                } catch (error) {
                                                                                    alert('Failed to delete proposal');
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 font-medium transition-colors"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {project.tags && project.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-6">
                                                            {project.tags.map((tag: string, i: number) => (
                                                                <span key={i} className="px-3 py-1 bg-neutral-50 text-neutral-600 rounded-md text-xs font-medium border border-neutral-100">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Attachments Section */}
                                                    {project.attachments && project.attachments.length > 0 && (
                                                        <div className="mb-6">
                                                            <h5 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                                                                <FileText className="w-4 h-4" /> Attachments
                                                            </h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {project.attachments.map((url: string, index: number) => (
                                                                    <FilePreview key={index} url={url} description={`Attachment ${index + 1}`} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {project.feedback && (
                                                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                                            <h5 className="text-sm font-semibold text-orange-800 mb-1 flex items-center gap-2">
                                                                <MessageSquare className="w-4 h-4" /> Faculty Feedback
                                                            </h5>
                                                            <p className="text-sm text-orange-700">{project.feedback}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Timeline Updates (Only show if this is the ACTIVE project or has specific updates?) 
                                           Usually timeline is for the APPROVED project. 
                                           But maybe we want to see updates for any? 
                                           Lets show updates for this specific project card.
                                        */}
                                                {project.status === 'Approved' && (
                                                    <div className="space-y-6">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                                                <Clock className="w-5 h-5 text-indigo-600" /> Project Timeline
                                                            </h3>
                                                            <button
                                                                onClick={() => setIsUpdateDialogOpen(true)}
                                                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                                            >
                                                                <Plus className="w-4 h-4" /> New Update
                                                            </button>
                                                        </div>

                                                        <div className="relative pl-4">
                                                            {/* Vertical Line */}
                                                            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-neutral-200/60" />

                                                            {project.updates && project.updates.slice().reverse().map((update: any, i: number) => (
                                                                <div key={i} className="relative pl-12 pb-8 group">
                                                                    {/* Dot */}
                                                                    <div className="absolute left-[20px] top-6 w-3 h-3 rounded-full bg-white border-2 border-indigo-600 ring-4 ring-neutral-50 z-10" />

                                                                    <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <div>
                                                                                {update.title && <h4 className="font-bold text-neutral-900">{update.title}</h4>}
                                                                                <span className="text-xs text-neutral-400 flex items-center gap-1 mt-1">
                                                                                    <Calendar className="w-3 h-3" />
                                                                                    {new Date(update.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                                    <span className="mx-1">•</span>
                                                                                    {new Date(update.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <p className="text-sm text-neutral-600 mb-4 whitespace-pre-wrap leading-relaxed">
                                                                            {update.content}
                                                                        </p>

                                                                        {/* Attachments & Links */}
                                                                        {(update.links?.length > 0 || update.attachments?.length > 0) && (
                                                                            <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100 mt-2">
                                                                                {update.links?.map((link: string, lIdx: number) => (
                                                                                    <a key={`l-${lIdx}`} href={link} target="_blank" rel="noopener noreferrer"
                                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 border border-neutral-200 hover:border-indigo-200 transition-colors">
                                                                                        <FileText className="w-3 h-3" /> Link {lIdx + 1}
                                                                                    </a>
                                                                                ))}
                                                                                {update.attachments?.map((url: string, aIdx: number) => (
                                                                                    <FilePreview key={`a-${aIdx}`} url={url} description={`Attachment ${aIdx + 1}`} />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {(!project.updates || project.updates.length === 0) && (
                                                                <div className="text-center py-12 ml-6 bg-white border border-dashed border-neutral-200 rounded-xl">
                                                                    <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400">
                                                                        <Clock className="w-6 h-6" />
                                                                    </div>
                                                                    <p className="text-neutral-500 font-medium">No updates posted yet.</p>
                                                                    <p className="text-xs text-neutral-400 mt-1">Share your first progress update using the button above.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Sticky Sidebar: Team & Mentor & Help */}
                                    <div className="xl:col-span-1 space-y-6">
                                        <div className="sticky top-6 space-y-6">
                                            {/* Team Members */}
                                            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm relative">
                                                <h4 className="font-bold text-neutral-900 mb-4 flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-indigo-600" /> Team Members
                                                </h4>
                                                <div className="space-y-3">
                                                    {group.members.map((m: any) => (
                                                        <div key={m._id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors cursor-default">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                                                                {m.name.charAt(0)}
                                                            </div>
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
                                                {group.projects?.some((p: any) => p.faculty) ? (
                                                    <div className="flex items-center gap-3 p-2 bg-orange-50/50 rounded-lg border border-orange-100 mb-4">
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                                                            {group.projects.find((p: any) => p.faculty)?.faculty?.name?.charAt(0) || 'F'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-neutral-900">{group.projects.find((p: any) => p.faculty)?.faculty?.name || 'Assigned Faculty'}</p>
                                                            <p className="text-xs text-neutral-500">{group.projects.find((p: any) => p.faculty)?.faculty?.department || 'Department'}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200 text-center mb-4">
                                                        <p className="text-xs text-neutral-500">No mentor assigned yet.</p>
                                                    </div>
                                                )}

                                                {/* Create New Proposal Button */}
                                                {!group.projects?.some((p: any) => p.status === 'Approved') && (
                                                    <button
                                                        onClick={() => setIsProposalWarningOpen(true)}
                                                        className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-left"
                                                    >
                                                        <div className="p-1.5 bg-indigo-500/30 rounded-lg shrink-0">
                                                            <Plus className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-sm leading-snug">
                                                            {group.projects?.some((p: any) => p.faculty)
                                                                ? <>Create another proposal<br />under <span className="font-bold">{group.projects.find((p: any) => p.faculty)?.faculty?.name?.split(' ')[0]}</span>?</>
                                                                : "Create New Proposal"
                                                            }
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'group' && (
                        /* My Group View */
                        <div className="max-w-5xl mx-auto space-y-6">
                            {group ? (
                                <div className="space-y-8">
                                    <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-2xl font-bold text-neutral-900">{group.name}</h2>
                                                <p className="text-neutral-500 mt-1 text-sm">Group ID: <span className="font-mono bg-neutral-100 px-1 rounded">{group._id}</span></p>
                                                <div className="flex items-center gap-2 mt-4">
                                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded font-medium">
                                                        Status: {group.status}
                                                    </span>
                                                    {group.project?.semester && (
                                                        <span className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs rounded font-medium border border-neutral-200">
                                                            Semester {group.project.semester}
                                                        </span>
                                                    )}
                                                    <span className="text-neutral-400 text-sm">•</span>
                                                    <span className="text-neutral-500 text-sm">{group.members.length} Members</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsLeaveDialogOpen(true)}
                                                className="text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors border border-red-200 bg-white"
                                            >
                                                Leave Group
                                            </button>
                                        </div>

                                        <div className="mt-8">
                                            <h3 className="text-lg font-bold text-neutral-900 mb-4">Group Members</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {group.members.map((m: any) => (
                                                    <div key={m._id} className="flex items-center gap-4 p-4 bg-white border border-neutral-200 rounded-xl hover:border-indigo-200 transition-colors">
                                                        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold shrink-0">
                                                            {m.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-neutral-900">{m.name}</p>
                                                            <p className="text-sm text-neutral-500">{m.email}</p>
                                                            <p className="text-xs text-neutral-400 mt-0.5">{m.rollNumber || 'No Roll No'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20">We couldn't find your group information.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'archive' && (
                        /* Archive View */
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm text-center">
                                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                                    <Archive className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-bold text-neutral-900 mb-2">Project Archive</h2>
                                <p className="text-neutral-500 max-w-md mx-auto">
                                    Access past projects and research papers. This section allows you to explore the history of projects submitted by students.
                                </p>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                    {/* Placeholder Archive Items */}
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="p-4 rounded-xl border border-neutral-200 hover:border-indigo-200 hover:bg-neutral-50 transition-colors cursor-pointer group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded">202{5 - i}</span>
                                                <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-indigo-400" />
                                            </div>
                                            <h4 className="font-bold text-neutral-900 mb-1">Archive Project Title {i}</h4>
                                            <p className="text-sm text-neutral-500 line-clamp-2">This is a description of a past project that was completed in a previous academic year.</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div > {/* Closing main content flex */}

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
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow max-h-[90vh] overflow-y-auto">
                        <Dialog.Title className="text-lg font-bold mb-4">Post Project Update</Dialog.Title>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Update Title</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Week 2 Progress"
                                    value={updateTitle}
                                    onChange={(e) => setUpdateTitle(e.target.value)}
                                />
                            </div>
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
                                    disabled={!updateTitle.trim() || !updateContent.trim() || isUpdateSubmitting}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                                >
                                    {isUpdateSubmitting ? 'Posting...' : 'Post Update'}
                                </button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Leave Group Dialog */}
            <Dialog.Root open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow">
                        <Dialog.Title className="text-lg font-bold mb-2 text-red-600">Leave Group</Dialog.Title>
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

            {/* Proposal Warning Dialog */}
            <Dialog.Root open={isProposalWarningOpen} onOpenChange={setIsProposalWarningOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white p-6 rounded-2xl shadow-xl focus:outline-none data-[state=open]:animate-contentShow">
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
