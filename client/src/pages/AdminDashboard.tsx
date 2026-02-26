import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Search, Users, Clock, CheckCircle, FileText, LayoutGrid, X, LogOut, ChevronRight, ChevronDown, ChevronUp, Settings, Menu, Calendar, Download, AlertCircle, TrendingUp, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import MenteeGroupDetails from '../components/MenteeGroupDetails';
import AutoCreatePanelsModal from '../components/AutoCreatePanelsModal';

const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'students' | 'groups' | 'faculty' | 'events' | 'exports' | 'panels'>('students');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Data State
    const [students, setStudents] = useState<any[]>([]);
    const [faculty, setFaculty] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [panels, setPanels] = useState<any[]>([]);
    const [showAutoCreateModal, setShowAutoCreateModal] = useState(false);
    const [autoCreateFaculties, setAutoCreateFaculties] = useState<any[]>([]);
    const [showAutoCreateBatchSelect, setShowAutoCreateBatchSelect] = useState(false);
    const [autoCreateBatchYear, setAutoCreateBatchYear] = useState('');
    const [showCreatePanel, setShowCreatePanel] = useState(false);
    const [newPanelFaculty, setNewPanelFaculty] = useState<string[]>([]);
    const [newPanelBatch, setNewPanelBatch] = useState<string>('');

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBatch, setFilterBatch] = useState<string>('All');
    const [filterBranch, setFilterBranch] = useState<string>('All');
    const [filterGroupStatus, setFilterGroupStatus] = useState<string>('All'); // Added group status filter
    const [filterFaculty, setFilterFaculty] = useState<string>('All'); // Added faculty filter
    const [viewGroup, setViewGroup] = useState<any>(null); // Re-added viewGroup state
    const [exportBatch, setExportBatch] = useState<string>('All'); // For export filtering
    const [editingFaculty, setEditingFaculty] = useState<any>(null);
    const [showLimitSettings, setShowLimitSettings] = useState(false);
    const [sortOption, setSortOption] = useState<string>('Default'); // Added sort state
    const [collapsedPanelsBatches, setCollapsedPanelsBatches] = useState<Record<string, boolean>>({});

    // Limits State
    const [globalMaxStudents, setGlobalMaxStudents] = useState<number>(21);
    const [globalMaxGroups, setGlobalMaxGroups] = useState<number>(7);
    const [batchLimits, setBatchLimits] = useState<Record<number, { maxStudents: number, maxGroups: number }>>({});


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'students') {
                    const res = await api.get('/users/students');
                    setStudents(Array.isArray(res.data) ? res.data : []);
                } else if (activeTab === 'faculty') {
                    const res = await api.get('/users/faculty');
                    setFaculty(Array.isArray(res.data) ? res.data : []);

                    // Fetch groups to calculate load
                    const groupsRes = await api.get('/groups');
                    setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
                } else if (activeTab === 'groups') {
                    // Assuming endpoint exists for admin to see all groups
                    // If this fails, we might need a different endpoint, e.g., /groups
                    const res = await api.get('/groups');
                    setGroups(Array.isArray(res.data) ? res.data : []);

                    // Also fetch faculty for the filter dropdown if not already loaded
                    if (faculty.length === 0) {
                        const facultyRes = await api.get('/users/faculty');
                        setFaculty(Array.isArray(facultyRes.data) ? facultyRes.data : []);
                    }
                } else if (activeTab === 'panels') {
                    const res = await api.get(`/panels?batchYear=${filterBatch}`);
                    setPanels(Array.isArray(res.data) ? res.data : []);
                }
            } catch (error) {
                console.error(`Failed to fetch ${activeTab}`, error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        if (activeTab === 'groups') {
            setViewGroup(null); // Reset detail view on tab change
        }
    }, [activeTab, filterBatch]);

    // Reset sort when tab changes
    useEffect(() => {
        setSortOption('Default');
    }, [activeTab]);


    const handleAutoCreateClick = () => {
        setAutoCreateBatchYear(filterBatch !== 'All' ? filterBatch : new Date().getFullYear().toString());
        setShowAutoCreateBatchSelect(true);
    };

    const processAutoCreate = async () => {
        if (!autoCreateBatchYear) return;

        const batchSuffix = autoCreateBatchYear.slice(2);

        let currentFaculty = faculty;
        let currentGroups = groups;

        // Ensure we have loaded both faculties and groups to map workload accurately
        if (currentFaculty.length === 0 || currentGroups.length === 0) {
            try {
                const [facultyRes, groupsRes] = await Promise.all([
                    api.get('/users/faculty'),
                    api.get('/groups')
                ]);
                currentFaculty = Array.isArray(facultyRes.data) ? facultyRes.data : [];
                currentGroups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
                setFaculty(currentFaculty);
                setGroups(currentGroups);
            } catch (error) {
                console.error("Failed to fetch data for auto creation", error);
                alert("Failed to load required faculty or group data.");
                return;
            }
        }

        // Calculate workload for ALL faculties regarding this batch
        const batchGroups = currentGroups.filter((g: any) => {
            return g.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
        });

        const facultiesWithWorkload = currentFaculty.map(f => {
            let count = 0;
            batchGroups.forEach(g => {
                if (g.project && (g.project.faculty === f._id || g.project.faculty?._id === f._id)) {
                    count++;
                }
            });
            return { _id: f._id, name: f.name, email: f.email, groupCount: count };
        });

        if (facultiesWithWorkload.length === 0) {
            alert("There are no faculties available to assign.");
            return;
        }

        setAutoCreateFaculties(facultiesWithWorkload);
        setShowAutoCreateBatchSelect(false);
        setShowAutoCreateModal(true);
    };

    const confirmAutoCreatePanels = async (newPanels: any[]) => {
        try {
            // Fetch existing panels for this batch explicitly from DB before delete
            const batchYearNum = parseInt(autoCreateBatchYear);
            const resExisting = await api.get(`/panels?batchYear=${batchYearNum}`);
            const existingPanelsForBatch = Array.isArray(resExisting.data) ? resExisting.data : [];

            for (const p of existingPanelsForBatch) {
                await api.delete(`/panels/${p._id}`);
            }

            // Create new panels
            for (const p of newPanels) {
                await api.post('/panels', p);
            }

            setShowAutoCreateModal(false);
            const res = await api.get(`/panels?batchYear=${filterBatch}`);
            setPanels(Array.isArray(res.data) ? res.data : []);
            alert("Panels Auto-Created and Saved Successfully!");
        } catch (e: any) {
            alert("Error saving panels: " + (e.response?.data?.message || e.message));
            console.error("Panel save error:", e.response?.data || e);
            throw e;
        }
    };

    const refreshGroups = async () => {
        try {
            const res = await api.get('/groups');
            setGroups(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to refresh groups", error);
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

    const handleEditFaculty = (faculty: any) => {
        setEditingFaculty(faculty);
        setShowLimitSettings(false);

        // Initialize limits from faculty data
        setGlobalMaxStudents(faculty.maxStudents || 21);
        setGlobalMaxGroups(faculty.maxGroups || 7);

        const initialBatchLimits: any = {};
        // Initialize defaults for recent batches
        const currentYear = new Date().getFullYear();
        // Generate batches from currentYear - 7 to currentYear - 1
        const batches = Array.from({ length: 7 }, (_, i) => (currentYear - 7) + i);
        batches.forEach(year => {
            const config = (faculty.batchConfigs || []).find((c: any) => c.batchYear === year);
            if (config) {
                initialBatchLimits[year] = { maxStudents: config.maxStudents, maxGroups: config.maxGroups };
            } else {
                initialBatchLimits[year] = { maxStudents: faculty.maxStudents || 21, maxGroups: faculty.maxGroups || 7 };
            }
        });
        setBatchLimits(initialBatchLimits);
    };

    const handleSaveLimits = async () => {
        if (!editingFaculty) return;
        try {
            const batchConfigs = Object.entries(batchLimits).map(([year, limits]: any) => ({
                batchYear: parseInt(year),
                maxStudents: limits.maxStudents,
                maxGroups: limits.maxGroups
            }));

            await api.put(`/users/${editingFaculty._id}`, {
                maxStudents: globalMaxStudents,
                maxGroups: globalMaxGroups,
                batchConfigs
            });

            // Refresh faculty list
            const res = await api.get('/users/faculty');
            setFaculty(Array.isArray(res.data) ? res.data : []);
            setEditingFaculty(null);
            setShowLimitSettings(false);
        } catch (e) {
            console.error("Failed to update faculty limits", e);
            alert("Failed to update faculty limits");
        }
    };

    const updateBatchLimit = (year: number, field: 'maxStudents' | 'maxGroups', value: number) => {
        setBatchLimits(prev => ({
            ...prev,
            [year]: {
                ...prev[year],
                [field]: value
            }
        }));
    };

    const getFilteredStudents = () => {
        return students.filter(s => {
            const matchesSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNumber?.includes(searchTerm);
            const matchesBranch = filterBranch === 'All' || s.branch === filterBranch;
            const matchesBatch = filterBatch === 'All' || (() => {
                const batchSuffix = filterBatch.slice(2);
                return s.rollNumber && s.rollNumber.startsWith(batchSuffix);
            })();
            const matchesGroupStatus = filterGroupStatus === 'All' ||
                (filterGroupStatus === 'Grouped' ? s.isGrouped : !s.isGrouped);

            return matchesSearch && matchesBranch && matchesBatch && matchesGroupStatus;
        }).sort((a, b) => {
            if (sortOption === 'Name (A-Z)') return a.name.localeCompare(b.name);
            if (sortOption === 'Name (Z-A)') return b.name.localeCompare(a.name);
            if (sortOption === 'Roll No (Asc)') return (a.rollNumber || '').localeCompare(b.rollNumber || '');
            if (sortOption === 'Roll No (Desc)') return (b.rollNumber || '').localeCompare(a.rollNumber || '');
            return 0;
        });
    };

    // Filter Logic for Groups
    const getFilteredGroups = () => {
        if (!groups) return [];
        return groups.filter(g => {
            // Allow all groups to be visible, or filter based on a new status filter if needed.
            // For now, removing the strict 'Approved' check so Admin can see all groups forming.
            // if ((g.status !== 'Approved') && (g.project?.status !== 'Approved')) return false;

            const matchesSearch =
                g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.project?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.members?.some((m: any) => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesBatch = filterBatch === 'All' || (() => {
                const batchSuffix = filterBatch.slice(2);
                return g.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
            })();

            const matchesFaculty = filterFaculty === 'All' || g.project?.faculty?._id === filterFaculty || g.project?.faculty === filterFaculty;

            return matchesSearch && matchesBatch && matchesFaculty;
        }).sort((a, b) => {
            if (sortOption === 'Name (A-Z)') return a.name.localeCompare(b.name);
            if (sortOption === 'Name (Z-A)') return b.name.localeCompare(a.name);
            if (sortOption === 'Project (A-Z)') return (a.project?.title || '').localeCompare(b.project?.title || '');
            return 0;
        });
    };

    const displayGroups = getFilteredGroups();

    // Helper to get faculty stats per batch
    const getFacultyBatchStats = (facultyId: string) => {
        const stats: Record<string, { students: number, groups: number }> = {};

        // Iterate over all APPROVED groups to calculate stats
        // Note: We should ideally use 'groups' state here, but need to ensure it contains ALL groups, not just filtered ones.
        // Assuming 'groups' contains all fetched groups.
        groups.forEach(g => {
            // Check if this group belongs to the faculty
            // The group.project.faculty might be populated. 
            // Ideally we need to check if the project is approved assigned to this faculty.
            if (g.project?.faculty?._id === facultyId || g.project?.faculty === facultyId) {
                // Determine batch from members
                const batchYear = g.members && g.members.length > 0 && g.members[0].rollNumber
                    ? '20' + g.members[0].rollNumber.substring(0, 2)
                    : 'Unknown';

                if (!stats[batchYear]) {
                    stats[batchYear] = { students: 0, groups: 0 };
                }
                stats[batchYear].groups += 1;
                stats[batchYear].students += g.members.length;
            }
        });

        return stats;
    };

    const handleExportStudents = async () => {
        try {
            const response = await api.get(`/users/students/export?batch=${exportBatch}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `students_${exportBatch}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export students');
        }
    };


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
                            <Settings className="w-5 h-5" />
                        </div>
                        Admin Portal
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="Student Directory"
                        active={activeTab === 'students'}
                        onClick={() => setActiveTab('students')}
                    />
                    <SidebarItem
                        icon={<LayoutGrid className="w-5 h-5" />}
                        label="Group Directory"
                        active={activeTab === 'groups'}
                        onClick={() => setActiveTab('groups')}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="Faculty Directory"
                        active={activeTab === 'faculty'}
                        onClick={() => setActiveTab('faculty')}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="Evaluation Panels"
                        active={activeTab === 'panels'}
                        onClick={() => setActiveTab('panels')}
                    />
                    <SidebarItem
                        icon={<Calendar className="w-5 h-5" />}
                        label="Setup Events"
                        active={activeTab === 'events'}
                        onClick={() => setActiveTab('events')}
                    />
                    <SidebarItem
                        icon={<Download className="w-5 h-5" />}
                        label="Data Exports"
                        active={activeTab === 'exports'}
                        onClick={() => setActiveTab('exports')}
                    />
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
                        <h1 className="text-xl font-bold text-neutral-800">
                            {activeTab === 'students' && 'Student Directory'}
                            {activeTab === 'groups' && 'Group Directory'}
                            {activeTab === 'faculty' && 'Faculty Directory'}
                            {activeTab === 'panels' && 'Evaluation Panels'}
                            {activeTab === 'events' && 'Setup Events'}
                            {activeTab === 'exports' && 'Data Exports'}
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-6 md:p-8">
                    <div className="max-w-7xl mx-auto min-h-full flex flex-col">
                        {/* Common Toolbar for Directories */}
                        {(activeTab === 'students' || activeTab === 'groups' || activeTab === 'faculty' || activeTab === 'panels') && !viewGroup && (
                            <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-start md:items-center">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all bg-white shadow-sm text-base"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-4">
                                    {(activeTab === 'students' || activeTab === 'groups' || activeTab === 'panels') && (
                                        <select
                                            className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                            value={filterBatch}
                                            onChange={(e) => setFilterBatch(e.target.value)}
                                        >
                                            <option value="All">Batch: All</option>
                                            {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                                <option key={year} value={year.toString()}>{year}-{year + 4}</option>
                                            ))}
                                        </select>
                                    )}

                                    {activeTab === 'students' && (
                                        <>
                                            <select
                                                className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                value={filterGroupStatus}
                                                onChange={(e) => setFilterGroupStatus(e.target.value as any)}
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
                                                <option value="ECE">ECE</option>
                                                <option value="DSAI">DSAI</option>
                                            </select>
                                        </>
                                    )}

                                    {activeTab === 'groups' && (
                                        <>
                                            {/* Faculty Filter Dropdown */}
                                            <select
                                                className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors max-w-[200px]"
                                                value={filterFaculty}
                                                onChange={(e) => setFilterFaculty(e.target.value)}
                                            >
                                                <option value="All">Faculty: All</option>
                                                {faculty.map((f: any) => (
                                                    <option key={f._id} value={f._id}>
                                                        {f.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                    {/* Sort Dropdown */}
                                    <select
                                        className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value)}
                                    >
                                        <option value="Default">Sort By: Default</option>
                                        {activeTab === 'students' && (
                                            <>
                                                <option value="Name (A-Z)">Name (A-Z)</option>
                                                <option value="Name (Z-A)">Name (Z-A)</option>
                                                <option value="Roll No (Asc)">Roll No (Asc)</option>
                                                <option value="Roll No (Desc)">Roll No (Desc)</option>
                                            </>
                                        )}
                                        {activeTab === 'faculty' && (
                                            <>
                                                <option value="Name (A-Z)">Name (A-Z)</option>
                                                <option value="Name (Z-A)">Name (Z-A)</option>
                                                <option value="Load (High-Low)">Load (High-Low)</option>
                                                <option value="Load (Low-High)">Load (Low-High)</option>
                                            </>
                                        )}
                                        {activeTab === 'groups' && (
                                            <>
                                                <option value="Name (A-Z)">Group Name (A-Z)</option>
                                                <option value="Name (Z-A)">Group Name (Z-A)</option>
                                                <option value="Project (A-Z)">Project Title (A-Z)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Content */}
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'students' && (
                                    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-neutral-50 border-b border-neutral-200">
                                                <tr>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Roll Number</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Name</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Email</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Branch</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {getFilteredStudents().map((student) => (
                                                    <tr key={student._id} className="hover:bg-neutral-50">
                                                        <td className="px-6 py-4 font-mono text-neutral-600">{student.rollNumber || '-'}</td>
                                                        <td className="px-6 py-4 font-medium text-neutral-900">{student.name}</td>
                                                        <td className="px-6 py-4 text-neutral-500">{student.email}</td>
                                                        <td className="px-6 py-4 text-neutral-500">{student.branch || '-'}</td>
                                                        <td className="px-6 py-4">
                                                            {student.isGrouped ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    In Group
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                    Unassigned
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {students.length === 0 && (
                                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-neutral-400">No students found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {activeTab === 'faculty' && (
                                    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-neutral-50 border-b border-neutral-200">
                                                <tr>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Name</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Email</th>

                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Current Load</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {faculty
                                                    .map((f: any) => {
                                                        const load = groups.filter((g: any) => {
                                                            if (!g.project) return false;

                                                            // Handle faculty reference (id string or object)
                                                            let facultyId = null;
                                                            if (typeof g.project.faculty === 'string') {
                                                                facultyId = g.project.faculty;
                                                            } else if (g.project.faculty && g.project.faculty._id) {
                                                                facultyId = g.project.faculty._id;
                                                            }

                                                            // Ensure ids are strings for comparison
                                                            const isAssigned = facultyId && String(facultyId) === String(f._id);

                                                            // Count approved groups/projects
                                                            const isApproved = g.status === 'Approved' || g.project?.status === 'Approved';
                                                            return isAssigned && isApproved;
                                                        }).length;
                                                        return { ...f, calculatedLoad: load };
                                                    })
                                                    .filter((f: any) => f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || f.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                                                    .sort((a: any, b: any) => {
                                                        if (sortOption === 'Name (A-Z)') return a.name.localeCompare(b.name);
                                                        if (sortOption === 'Name (Z-A)') return b.name.localeCompare(a.name);
                                                        if (sortOption === 'Load (High-Low)') return b.calculatedLoad - a.calculatedLoad;
                                                        if (sortOption === 'Load (Low-High)') return a.calculatedLoad - b.calculatedLoad;
                                                        return 0;
                                                    })
                                                    .map((f: any) => (
                                                        <tr key={f._id} className="hover:bg-neutral-50 px-6 py-4">
                                                            <td className="px-6 py-4 font-medium text-neutral-900">{f.name}</td>
                                                            <td className="px-6 py-4 text-neutral-500">{f.email}</td>

                                                            <td className="px-6 py-4 text-neutral-500">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${f.calculatedLoad > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
                                                                    {f.calculatedLoad} Groups
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => handleEditFaculty(f)}
                                                                    className="text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                                                                >
                                                                    <Settings className="w-4 h-4" /> Configure Profile
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {faculty.length === 0 && (
                                                    <tr><td colSpan={3} className="px-6 py-8 text-center text-neutral-400">No faculty found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {activeTab === 'groups' && (
                                    <>
                                        {viewGroup ? (
                                            <MenteeGroupDetails
                                                group={viewGroup}
                                                user={user}
                                                onBack={() => setViewGroup(null)}
                                                onUpdateSuccess={refreshGroups}
                                            />
                                        ) : (
                                            <div className="pb-20">
                                                {(filterBatch === 'All' ? Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).reverse() : [parseInt(filterBatch)]).map(batchYear => {
                                                    const batchSuffix = batchYear.toString().slice(2);
                                                    const batchGroups = displayGroups.filter((g: any) => {
                                                        const members = g.members || [];
                                                        if (filterBatch !== 'All') return true; // Already filtered
                                                        return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                    });

                                                    if (batchGroups.length === 0) return null;

                                                    return (
                                                        <div key={batchYear} className="mb-10">
                                                            {filterBatch === 'All' && (
                                                                <div className="sticky top-0 z-20 bg-neutral-50/95 backdrop-blur py-3 -mx-6 px-6 md:-mx-8 md:px-8 border-b border-neutral-200/50 flex items-center gap-6 mb-4">
                                                                    <div className="flex items-baseline gap-3">
                                                                        <h3 className="text-xl font-bold text-neutral-900">Batch {batchYear}-{batchYear + 4}</h3>
                                                                        <span className="text-sm font-medium text-neutral-400">{batchGroups.length} Groups</span>
                                                                    </div>
                                                                    <div className="h-px bg-neutral-100 flex-1 opacity-0"></div>
                                                                </div>
                                                            )}

                                                            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                                                <table className="w-full text-left">
                                                                    <thead className="bg-neutral-50 border-b border-neutral-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Group / Project</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Faculty</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Action</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-neutral-100">
                                                                        {batchGroups.map((item: any) => (
                                                                            <tr key={item._id} onClick={() => setViewGroup(item)} className="hover:bg-neutral-50 cursor-pointer transition-colors group">
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                                                                        <span className="text-sm text-neutral-500 line-clamp-1 mb-1">
                                                                                            {item.project?.title || 'No Project'}
                                                                                        </span>
                                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                                            {item.members?.map((m: any, idx: number) => (
                                                                                                <span key={idx} className="text-xs text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                                                                                    {m.name}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                                                                                            {item.project?.faculty?.name?.charAt(0) || '?'}
                                                                                        </div>
                                                                                        <span className="text-sm font-medium text-neutral-700">
                                                                                            {item.project?.faculty?.name || 'Unassigned'}
                                                                                        </span>
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
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}


                                {activeTab === 'panels' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={handleAutoCreateClick} className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 transition">
                                                Auto Create Panels
                                            </button>
                                            <button onClick={() => setShowCreatePanel(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
                                                Create New Panel
                                            </button>
                                        </div>
                                        {Object.entries(
                                            panels.reduce((acc: any, panel: any) => {
                                                const year = panel.batchYear;
                                                acc[year] = acc[year] || [];
                                                acc[year].push(panel);
                                                return acc;
                                            }, {})
                                        ).sort(([a]: any, [b]: any) => Number(b) - Number(a)).map(([year, yearPanels]: any) => {
                                            const isCollapsed = collapsedPanelsBatches[year] || false;
                                            return (
                                                <div key={year} className="space-y-4 mb-8">
                                                    {filterBatch === 'All' && (
                                                        <div
                                                            className="flex items-center gap-4 cursor-pointer group"
                                                            onClick={() => setCollapsedPanelsBatches(prev => ({ ...prev, [year]: !prev[year] }))}
                                                        >
                                                            <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 group-hover:bg-indigo-200 transition-colors">
                                                                Batch {year}-{parseInt(year) + 4}
                                                                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                                            </div>
                                                            <div className="h-px bg-neutral-200 flex-1 group-hover:bg-indigo-200 transition-colors"></div>
                                                        </div>
                                                    )}
                                                    {!isCollapsed && (
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {yearPanels.map((panel: any, index: number) => (
                                                                <div key={panel._id} className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <div>
                                                                            <h3 className="text-lg font-bold text-neutral-900">Panel {index + 1}</h3>
                                                                            <p className="text-sm text-neutral-500">Batch {panel.batchYear}-{parseInt(panel.batchYear) + 4}</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (confirm('Delete panel?')) {
                                                                                    await api.delete(`/panels/${panel._id}`);
                                                                                    const res = await api.get(`/panels?batchYear=${filterBatch}`);
                                                                                    setPanels(Array.isArray(res.data) ? res.data : []);
                                                                                }
                                                                            }}
                                                                            className="text-red-500 hover:bg-red-50 p-2 rounded text-sm transition-colors"
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <h4 className="text-sm font-semibold text-neutral-700">Faculty Members:</h4>
                                                                        {panel.faculty.map((f: any) => (
                                                                            <div key={f._id} className="text-sm text-neutral-600 bg-neutral-50 p-2 rounded border border-neutral-100 flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                                                                {f.name} ({f.email})
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        {panels.length === 0 && (
                                            <div className="text-center text-neutral-500 py-10 bg-white rounded-xl border border-neutral-200">
                                                No panels found.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'events' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Event Card: Group Formation */}
                                        <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm hover:shadow-md transition-all">
                                            <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                                                <Users className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-bold text-neutral-900 mb-2">Group Formation</h3>
                                            <p className="text-neutral-500 text-sm mb-6">Initiate the process for students to form groups and submit project proposals.</p>
                                            <div className="flex items-center gap-2 mb-6 text-sm font-medium text-neutral-600">
                                                <Clock className="w-4 h-4 text-orange-500" /> Duration: 2 Weeks
                                            </div>
                                            <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                                                Start Process
                                            </button>
                                        </div>

                                        {/* Event Card: Mid-term */}
                                        <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm hover:shadow-md transition-all">
                                            <div className="h-12 w-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                                                <AlertCircle className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-bold text-neutral-900 mb-2">Mid-Term Evaluation</h3>
                                            <p className="text-neutral-500 text-sm mb-6">Open the evaluation portal for faculty to grade mid-term progress. Results shown to students.</p>
                                            <button className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200">
                                                Open Evaluations
                                            </button>
                                        </div>

                                        {/* Event Card: End-term */}
                                        <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm hover:shadow-md transition-all">
                                            <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                                                <CheckCircle className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-bold text-neutral-900 mb-2">End-Term Evaluation</h3>
                                            <p className="text-neutral-500 text-sm mb-6">Final evaluation phase. Allow marks entry and publish final results.</p>
                                            <button className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">
                                                Start Final Exams
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'exports' && (
                                    <div className="max-w-3xl mx-auto space-y-6">
                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Student Data Export</h3>
                                                    <p className="text-sm text-neutral-500">Export student details filtered by batch.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={exportBatch}
                                                    onChange={(e) => setExportBatch(e.target.value)}
                                                    className="px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                                >
                                                    <option value="All">All Batches</option>
                                                    {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                                        <option key={year} value={year.toString()}>{year}-{year + 4}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={handleExportStudents}
                                                    className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" /> Export Excel
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                                    <LayoutGrid className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Groups & Projects CSV</h3>
                                                    <p className="text-sm text-neutral-500">Export detailed list of groups and projects.</p>
                                                </div>
                                            </div>
                                            <button className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2">
                                                <Download className="w-4 h-4" /> Export
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                                    <TrendingUp className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Evaluation Report</h3>
                                                    <p className="text-sm text-neutral-500">Export marks and evaluation results.</p>
                                                </div>
                                            </div>
                                            <button className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2">
                                                <Download className="w-4 h-4" /> Export
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
                {/* Edit Faculty Modal */}
                {/* Faculty Profile Dialog */}

                {showCreatePanel && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Create Panel</h3>
                                <button onClick={() => setShowCreatePanel(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year (Start Year)</label>
                                    <select value={newPanelBatch} onChange={(e) => setNewPanelBatch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                        <option value="">Select Batch</option>
                                        {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                            <option key={year} value={year.toString()}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Faculty Members (Max 3)</label>
                                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                        {faculty.map((f: any) => (
                                            <label key={f._id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={newPanelFaculty.includes(f._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            if (newPanelFaculty.length >= 3) return;
                                                            setNewPanelFaculty([...newPanelFaculty, f._id]);
                                                        } else {
                                                            setNewPanelFaculty(newPanelFaculty.filter(id => id !== f._id));
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm">{f.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{newPanelFaculty.length}/3 selected</p>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setShowCreatePanel(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await api.post('/panels', { faculty: newPanelFaculty, batchYear: parseInt(newPanelBatch) });
                                            setShowCreatePanel(false);
                                            setNewPanelFaculty([]);
                                            setNewPanelBatch('');
                                            const res = await api.get(`/panels?batchYear=${filterBatch}`);
                                            setPanels(Array.isArray(res.data) ? res.data : []);
                                        } catch (e: any) { alert(e.response?.data?.message || 'Error creating panel'); }
                                    }}
                                    disabled={!newPanelBatch || newPanelFaculty.length === 0}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    Create Panel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {editingFaculty && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-neutral-50">
                                <h3 className="text-xl font-bold text-gray-900">Faculty Profile</h3>
                                <button onClick={() => setEditingFaculty(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto">
                                {/* Profile Header */}
                                <div className="flex items-start gap-6 mb-8">
                                    <div className="h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600 border-4 border-white shadow-lg">
                                        {editingFaculty.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{editingFaculty.name}</h2>

                                        <p className="text-neutral-400 text-sm flex items-center gap-2">
                                            <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-600 font-mono">{editingFaculty.email}</span>
                                            <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">{editingFaculty.department || 'Dept N/A'}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Global Limits Edit Section (Replaced by Button) */}
                                <div className="bg-neutral-50 rounded-2xl p-6 mb-8 border border-neutral-200 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                                            <Settings className="w-4 h-4 text-indigo-600" /> Mentorship Limits
                                        </h4>
                                        <p className="text-sm text-neutral-500">Configure global and batch-specific capacity.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowLimitSettings(true)}
                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2"
                                    >
                                        <Settings className="w-4 h-4" /> Set Mentorship Limits
                                    </button>
                                </div>

                                {/* Batch-wise Stats */}
                                <div>
                                    <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <LayoutGrid className="w-4 h-4 text-indigo-600" /> Batch-wise Mentorship
                                    </h4>
                                    <div className="space-y-3">
                                        {Object.entries(getFacultyBatchStats(editingFaculty._id)).length > 0 ? (
                                            Object.entries(getFacultyBatchStats(editingFaculty._id))
                                                .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                                                .map(([batch, stats]: any) => (
                                                    <div
                                                        key={batch}
                                                        onClick={() => {
                                                            setFilterBatch(batch);
                                                            setFilterFaculty(editingFaculty._id);
                                                            setActiveTab('groups');
                                                            setEditingFaculty(null);
                                                        }}
                                                        className="flex items-center justify-between bg-white border border-neutral-200 p-4 rounded-xl hover:border-indigo-200 transition-colors cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm group-hover:bg-indigo-100 transition-colors">
                                                                '{batch.slice(2)}
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Batch {parseInt(batch)}-{parseInt(batch) + 4}</h5>
                                                                <p className="text-xs text-neutral-500">Active Mentorship</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 flex flex-col items-center min-w-[80px]">
                                                                <span className="text-lg font-bold text-orange-600">{stats.groups}</span>
                                                                <span className="text-[10px] font-bold text-orange-400 uppercase">Groups</span>
                                                            </div>
                                                            <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex flex-col items-center min-w-[80px]">
                                                                <span className="text-lg font-bold text-emerald-600">{stats.students}</span>
                                                                <span className="text-[10px] font-bold text-emerald-400 uppercase">Students</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-8 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-neutral-400">
                                                No active mentorships found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-neutral-50 flex justify-end gap-3 mt-auto">
                                <button
                                    onClick={() => setEditingFaculty(null)}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Limit Settings Modal */}
                {showLimitSettings && editingFaculty && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-neutral-50">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Configure Mentorship Limits</h3>
                                    <p className="text-sm text-neutral-500">Set global and batch-specific limits for {editingFaculty.name}</p>
                                </div>
                                <button onClick={() => setShowLimitSettings(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-8">
                                {/* Global Settings */}
                                <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                                    <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Settings className="w-4 h-4" /> Global Defaults
                                    </h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                            <label className="block text-xs font-semibold text-indigo-500 mb-2">MAX STUDENT LIMIT</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={globalMaxStudents}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        setGlobalMaxStudents(val);
                                                        // Update batch limits that match old global? No, keep explicit.
                                                    }}
                                                    className="w-full text-lg font-bold text-gray-900 border-none focus:ring-0 p-0"
                                                />
                                                <span className="text-sm text-neutral-400">students</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                            <label className="block text-xs font-semibold text-indigo-500 mb-2">MAX GROUP LIMIT</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={globalMaxGroups}
                                                    onChange={(e) => setGlobalMaxGroups(parseInt(e.target.value))}
                                                    className="w-full text-lg font-bold text-gray-900 border-none focus:ring-0 p-0"
                                                />
                                                <span className="text-sm text-neutral-400">groups</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Batch Specific Settings */}
                                <div>
                                    <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <LayoutGrid className="w-4 h-4 text-neutral-500" /> Batch-Specific Overrides
                                    </h4>
                                    <div className="space-y-4">
                                        {Object.entries(batchLimits).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([year, limits]: any) => (
                                            <div key={year} className="flex items-center justify-between bg-white border border-neutral-200 p-4 rounded-xl hover:border-neutral-300 transition-colors">
                                                <div className="flex items-center gap-4 w-1/3">
                                                    <div className="h-10 w-10 bg-neutral-100 text-neutral-600 rounded-lg flex items-center justify-center font-bold text-sm">
                                                        '{year.slice(2)}
                                                    </div>
                                                    <span className="font-bold text-gray-900">Batch {year}-{parseInt(year) + 4}</span>
                                                </div>

                                                <div className="flex gap-4 flex-1">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Max Students</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                            value={limits.maxStudents}
                                                            onChange={(e) => updateBatchLimit(parseInt(year), 'maxStudents', parseInt(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Max Groups</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                            value={limits.maxGroups}
                                                            onChange={(e) => updateBatchLimit(parseInt(year), 'maxGroups', parseInt(e.target.value))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-neutral-50 flex justify-end gap-3 mt-auto">
                                <button
                                    onClick={() => setShowLimitSettings(false)}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveLimits}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save Configuration
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
                {showAutoCreateBatchSelect && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Select Batch for Auto-Create</h3>
                                <button onClick={() => setShowAutoCreateBatchSelect(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year (Start Year)</label>
                                    <select value={autoCreateBatchYear} onChange={(e) => setAutoCreateBatchYear(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                        <option value="">Select Batch</option>
                                        {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                            <option key={year} value={year.toString()}>{year}</option>
                                        ))}
                                    </select>
                                </div>

                                {autoCreateBatchYear && (
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-red-800">Warning: Destructive Action</h4>
                                            <p className="text-xs text-red-600 mt-0.5">Continuing will permanently delete and overwrite all existing panel data for this chosen batch.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setShowAutoCreateBatchSelect(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button
                                    onClick={processAutoCreate}
                                    disabled={!autoCreateBatchYear}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    Proceed
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showAutoCreateModal && (
                    <AutoCreatePanelsModal
                        faculties={autoCreateFaculties}
                        batchYear={parseInt(autoCreateBatchYear)}
                        onClose={() => setShowAutoCreateModal(false)}
                        onConfirm={confirmAutoCreatePanels}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
