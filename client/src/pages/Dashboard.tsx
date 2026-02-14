import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Users, Plus, FileText, Search, UserCheck, UserX, CheckSquare, Square, Menu, X, Home } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import Chat from '../components/Chat';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';

interface Group {
    _id: string;
    name: string;
    members: any[];
    status: string;
    project?: any;
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
    const [activeTab, setActiveTab] = useState<'directory' | 'project'>('directory');

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [creatingGroup, setCreatingGroup] = useState(false);

    useEffect(() => {
        if (user?.role === 'Student') {
            const fetchData = async () => {
                try {
                    // Fetch group info
                    const groupRes = await api.get('/groups/my').catch(() => null);
                    if (groupRes) setGroup(groupRes.data);

                    // Fetch all students
                    setLoadingStudents(true);
                    const studentsRes = await api.get('/users/students');
                    if (Array.isArray(studentsRes.data)) {
                        setStudents(studentsRes.data);
                    } else {
                        console.error("Unexpected response for students:", studentsRes.data);
                        setStudents([]);
                    }
                } catch (error) {
                    console.error("Error fetching dashboard data", error);
                } finally {
                    setLoading(false);
                    setLoadingStudents(false);
                }
            };
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const toggleStudentSelection = (id: string) => {
        // If already in a group, prevent selection (though UI should disable it)
        const student = students.find(s => s._id === id);
        if (student?.isGrouped) return;

        const newSelected = new Set(selectedStudents);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            if (newSelected.size >= 2) { // Max 2 others + self = 3
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
            setActiveTab('project'); // Redirect to project page logic
        } catch (error) {
            console.error("Failed to create group", error);
            alert("Failed to create group.");
        } finally {
            setCreatingGroup(false);
        }
    };

    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.rollNumber && student.rollNumber.includes(searchTerm))
    ).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

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
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="Student Directory"
                        active={activeTab === 'directory'}
                        onClick={() => setActiveTab('directory')}
                    />
                    <SidebarItem
                        icon={<FileText className="w-5 h-5" />}
                        label="My Project"
                        active={activeTab === 'project'}
                        onClick={() => setActiveTab('project')}
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
                            {activeTab === 'directory' ? 'Student Directory' : 'Project Workspace'}
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'directory' ? (
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
                                {!group && selectedStudents.size > 0 && (
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
                                                if (!student) return null; // Safety check
                                                const isSelected = selectedStudents.has(student._id);
                                                const isMe = student.email === user?.email;
                                                const isDisabled = !!group || student.isGrouped || isMe;

                                                return (
                                                    <tr
                                                        key={student._id}
                                                        className={`hover:bg-neutral-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                                    >
                                                        <td className="px-6 py-4">
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
                    ) : (
                        /* Project / Group View */
                        <div className="max-w-4xl mx-auto">
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
                            ) : (
                                <div className="space-y-8">
                                    {/* Group Header */}
                                    <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-2xl font-bold text-neutral-900">{group.name}</h2>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded font-medium">
                                                        Status: {group.status}
                                                    </span>
                                                    <span className="text-neutral-400 text-sm">•</span>
                                                    <span className="text-neutral-500 text-sm">{group.members.length} Members</span>
                                                </div>
                                            </div>
                                            {/* Chat Widget placed nicely */}
                                        </div>
                                        <div className="mt-6 border-t border-neutral-100 pt-6">
                                            <h4 className="text-sm font-semibold text-neutral-900 mb-3">Members</h4>
                                            <div className="flex gap-4">
                                                {group.members.map((m: any) => (
                                                    <div key={m._id} className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-100">
                                                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-xs font-bold">
                                                            {m.name.charAt(0)}
                                                        </div>
                                                        <span className="text-sm text-neutral-700">{m.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project Section */}
                                    <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-neutral-900">Project Status</h3>
                                            <p className="text-sm text-neutral-500">Manage your project proposal and submission.</p>
                                        </div>

                                        {group.project ? (
                                            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                                                <p className="font-medium text-neutral-900">Project Proposal Submitted</p>
                                                <p className="text-sm text-neutral-500 mt-1">Status: pending approval</p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-10 bg-neutral-50 border border-neutral-100 border-dashed rounded-xl">
                                                <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                                                <h4 className="font-medium text-neutral-900">No Project Proposal</h4>
                                                <p className="text-sm text-neutral-500 mb-6">Your group hasn't submitted a project proposal yet.</p>
                                                <button
                                                    onClick={() => navigate('/project/propose')}
                                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                                                >
                                                    Create Proposal
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-[400px] border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <Chat groupId={group._id} groupName={group.name} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
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

const FacultyDashboard = () => (
    <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">Faculty Dashboard</h1>
        <p className="text-neutral-500">Feature coming in next update.</p>
    </div>
);

export default Dashboard;
