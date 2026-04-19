import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Search, Users, Clock, CheckCircle, FileText, X, LogOut, ChevronDown, ChevronUp, Settings, Menu, Calendar, Download, AlertCircle, AlertTriangle, Save, Pencil, LayoutGrid, MoreVertical, Plus, Edit3, Power, Info, Trash2, Upload, Mail, Copy, Check, UserCheck, UserX, ShieldCheck, ShieldOff, Archive as ArchiveIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import MenteeGroupDetails from '../components/MenteeGroupDetails';
import AutoCreatePanelsModal from '../components/AutoCreatePanelsModal';
import { GlobalEventBanner } from '../components/GlobalEventBanner';

export const getGroupBatchYear = (group: any) => {
    if (group.targetBatch) return group.targetBatch.toString();
    if (group.members && group.members.length > 0 && group.members[0].rollNumber) {
        return '20' + group.members[0].rollNumber.substring(0, 2);
    }
    return 'Unknown';
};

export const getBatch = (roll?: string) => {
    if (!roll) return 'Unknown';
    return '20' + roll.toString().substring(0, 2);
};

export const getOriginalGroupBatchYear = (group: any) => {
    if (group.members && group.members.length > 0 && group.members[0].rollNumber) {
        return '20' + group.members[0].rollNumber.toString().substring(0, 2);
    }
    return 'Unknown';
};

const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialAdminTab = searchParams.get('tab') as 'overview' | 'students' | 'groups' | 'faculty' | 'events' | 'exports' | 'panels' | 'archive' | null;
    const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'groups' | 'faculty' | 'events' | 'exports' | 'panels' | 'archive'>(initialAdminTab || 'overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const current = searchParams.get('tab');
        if (current !== activeTab) {
            const next = new URLSearchParams(searchParams);
            next.set('tab', activeTab);
            setSearchParams(next, { replace: true });
        }
    }, [activeTab]);

    // Data State
    const [students, setStudents] = useState<any[]>([]);
    const [faculty, setFaculty] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [panels, setPanels] = useState<any[]>([]);

    const [showAutoCreateModal, setShowAutoCreateModal] = useState(false);
    const [autoCreateFaculties, setAutoCreateFaculties] = useState<any[]>([]);
    const [showAutoCreateBatchSelect, setShowAutoCreateBatchSelect] = useState(false);
    const [autoCreateBatchYear, setAutoCreateBatchYear] = useState('');
    const [isEditingPanelsDnd, setIsEditingPanelsDnd] = useState(false);
    const [dndEditInitialPanels, setDndEditInitialPanels] = useState<any[]>([]);
    const [showCreatePanel, setShowCreatePanel] = useState(false);
    const [newPanelFaculty, setNewPanelFaculty] = useState<string[]>([]);
    const [newPanelBatch, setNewPanelBatch] = useState<string>('');
    const [newPanelRoom, setNewPanelRoom] = useState<string>('');
    const [editingPanelId, setEditingPanelId] = useState<string | null>(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBatch, setFilterBatch] = useState<string>('All');
    const [filterBranch, setFilterBranch] = useState<string>('All');
    const [filterGroupStatus, setFilterGroupStatus] = useState<string>('All'); // Added group status filter
    const [filterVerificationStatus, setFilterVerificationStatus] = useState<string>('All'); // Added verification filter
    const [filterFaculty, setFilterFaculty] = useState<string>('All'); // Added faculty filter
    const [viewGroup, setViewGroup] = useState<any>(null); // Re-added viewGroup state
    const [exportBatch, setExportBatch] = useState<string>(''); // For export filtering (Require selection)
    const [editingFaculty, setEditingFaculty] = useState<any>(null);
    const [showLimitSettings, setShowLimitSettings] = useState(false);
    const [sortOption, setSortOption] = useState<string>('Default'); // Added sort state
    const [collapsedPanelsBatches, setCollapsedPanelsBatches] = useState<Record<string, boolean>>({});
    const [configBatchGroup, setConfigBatchGroup] = useState<any>(null); // For configure batch modal
    const [configStudentBatch, setConfigStudentBatch] = useState<any>(null); // For student batch override modal
    const [configBatchMenuOpen, setConfigBatchMenuOpen] = useState<string | null>(null); // To toggle menu per row
    const [studentBatchMenuOpen, setStudentBatchMenuOpen] = useState<string | null>(null); // To toggle student menu per row
    const [expandedPanelGroups, setExpandedPanelGroups] = useState<Record<string, boolean>>({});

    // Limits State
    const [globalMaxStudents, setGlobalMaxStudents] = useState<number>(21);
    const [globalMaxGroups, setGlobalMaxGroups] = useState<number>(7);
    const [batchLimits, setBatchLimits] = useState<Record<number, { maxStudents: number, maxGroups: number }>>({});

    // Events State
    const [events, setEvents] = useState<any[]>([]);
    const [showCreateEvent, setShowCreateEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [eventForm, setEventForm] = useState({
        type: 'group_formation_project_proposal',
        endDate: '',
        extensionDate: '',
        batchYear: '',
        rubricParams: '' // For JSON stringified rubric
    });
    const [participatingBatches, setParticipatingBatches] = useState<string[]>([]);

    // Archive tab state
    const [archiveYear, setArchiveYear] = useState<string>('All');
    const [archiveData, setArchiveData] = useState<{ availableYears: string[]; groups: any[]; projects: any[]; participants: any[]; panels: any[] } | null>(null);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveSection, setArchiveSection] = useState<'projects' | 'participants' | 'panels'>('projects');

    const [confirmEndEvent, setConfirmEndEvent] = useState<any>(null);
    const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<any>(null);
    const [adminPassword, setAdminPassword] = useState('');

    // Rubric Builder State
    const [rubricMode, setRubricMode] = useState<'builder' | 'json'>('builder');
    const [rubricSections, setRubricSections] = useState<any[]>([]);
    const [rubricPanelAggregation, setRubricPanelAggregation] = useState<'average' | 'sum'>('average');

    // Copy emails state
    const [emailsCopied, setEmailsCopied] = useState(false);

    const [showCreateAdmin, setShowCreateAdmin] = useState(false);
    const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [createUserForm, setCreateUserForm] = useState({ name: '', email: '', role: 'Student', rollNumber: '', branch: 'CSE', semester: '', department: 'CSE', expertise: '' });
    const [createUserError, setCreateUserError] = useState<string | null>(null);
    const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);

    // Import State (simple user import)
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<{ validRows: any[], invalidRows: any[], totalRows: number } | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [smartImportTarget, setSmartImportTarget] = useState<'student' | 'faculty' | null>(null);

    // Excel full import state
    const [showExcelImportModal, setShowExcelImportModal] = useState(false);
    const [excelImportFile, setExcelImportFile] = useState<File | null>(null);
    const [excelImportSemester, setExcelImportSemester] = useState('');
    const [excelImportLoading, setExcelImportLoading] = useState(false);
    const [excelImportPreview, setExcelImportPreview] = useState<any | null>(null);
    const [excelImportPreviewTab, setExcelImportPreviewTab] = useState<'students' | 'faculty' | 'groups' | 'warnings'>('warnings');
    const [excelImportExpanded, setExcelImportExpanded] = useState<Set<number>>(new Set());

    // Snapshot import state
    const [showSnapshotImportModal, setShowSnapshotImportModal] = useState(false);
    const [snapshotImportFile, setSnapshotImportFile] = useState<File | null>(null);
    const [snapshotImportLoading, setSnapshotImportLoading] = useState(false);
    const [snapshotImportPreview, setSnapshotImportPreview] = useState<any | null>(null);
    const [snapshotImportPreviewTab, setSnapshotImportPreviewTab] = useState<'projects' | 'warnings'>('projects');
    const [snapshotImportResultTab, setSnapshotImportResultTab] = useState<'warnings'>('warnings');
    const [snapshotData, setSnapshotData] = useState<any | null>(null); // raw JSON held for commit

    // Preview error state (replaces alert())
    const [excelImportPreviewError, setExcelImportPreviewError] = useState<string | null>(null);
    const [snapshotImportPreviewError, setSnapshotImportPreviewError] = useState<string | null>(null);

    // Import result state (shown after commit)
    const [simpleImportResult, setSimpleImportResult] = useState<{ created: number; total: number; errors: { email: string; name: string; reason: string }[] } | null>(null);
    const [excelImportResult, setExcelImportResult] = useState<{ created: any; errors: { groupNumber: string; student?: string; reason: string }[] } | null>(null);
    const [excelImportResultTab, setExcelImportResultTab] = useState<'students' | 'faculty' | 'groups' | 'errors'>('students');
    const [snapshotImportResult, setSnapshotImportResult] = useState<{ result: any; errors: { type: string; key: string; reason: string }[] } | null>(null);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'students') {
                    const res = await api.get('/users/students');
                    setStudents(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
                } else if (activeTab === 'faculty') {
                    const res = await api.get('/users/faculty');
                    setFaculty(Array.isArray(res.data) ? res.data : []);

                    // Fetch groups to calculate load
                    const groupsRes = await api.get('/groups');
                    setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
                } else if (activeTab === 'groups') {
                    const [res, eventsRes] = await Promise.all([
                        api.get('/groups'),
                        api.get('/events'),
                    ]);
                    setGroups(Array.isArray(res.data) ? res.data : []);
                    setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);

                    // Also fetch faculty for the filter dropdown if not already loaded
                    if (faculty.length === 0) {
                        const facultyRes = await api.get('/users/faculty');
                        setFaculty(Array.isArray(facultyRes.data) ? facultyRes.data : []);
                    }
                } else if (activeTab === 'panels') {
                    const res = await api.get(`/panels?batchYear=All`);
                    setPanels(Array.isArray(res.data) ? res.data : []);

                    if (faculty.length === 0) {
                        const facultyRes = await api.get('/users/faculty');
                        setFaculty(Array.isArray(facultyRes.data) ? facultyRes.data : []);
                    }
                    if (groups.length === 0) {
                        const groupsRes = await api.get('/groups');
                        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
                    }
                } else if (activeTab === 'overview') {
                    const res = await api.get('/admin/stats');
                    setStats(res.data);
                } else if (activeTab === 'events') {
                    const res = await api.get('/events');
                    setEvents(Array.isArray(res.data) ? res.data : []);
                } else if (activeTab === 'archive') {
                    setArchiveLoading(true);
                    try {
                        const qs = archiveYear && archiveYear !== 'All' ? `?year=${encodeURIComponent(archiveYear)}` : '';
                        const res = await api.get(`/admin/archive${qs}`);
                        setArchiveData(res.data || null);
                    } finally {
                        setArchiveLoading(false);
                    }
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
    }, [activeTab, filterBatch, archiveYear]);

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
            return getGroupBatchYear(g) === autoCreateBatchYear;
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
        setIsEditingPanelsDnd(false);
        setDndEditInitialPanels([]);
        setShowAutoCreateModal(true);
    };

    const confirmAutoCreatePanels = async (newPanels: any[]) => {
        try {
            if (isEditingPanelsDnd) {
                // In interactive edit mode, some have _id (existing) some don't (newly dropped empty panels)
                const existingPanelsForBatchRaw = await api.get(`/panels?batchYear=${autoCreateBatchYear}`);
                const existingPanelsForBatch = Array.isArray(existingPanelsForBatchRaw.data) ? existingPanelsForBatchRaw.data : [];

                const submittedPanelIds = newPanels.filter(p => p._id).map(p => p._id);

                // 1. Delete panels that were completely emptied and removed
                for (const p of existingPanelsForBatch) {
                    if (!submittedPanelIds.includes(p._id)) {
                        await api.delete(`/panels/${p._id}`);
                    }
                }

                // 2. Update existing and create new
                for (const p of newPanels) {
                    if (p._id) {
                        await api.put(`/panels/${p._id}`, { faculty: p.faculty, batchYear: p.batchYear, room: p.room || undefined });
                    } else {
                        await api.post('/panels', { faculty: p.faculty, batchYear: p.batchYear, room: p.room || undefined });
                    }
                }
            } else {
                // Standard auto-create: Delete all first
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
            }

            setShowAutoCreateModal(false);
            setIsEditingPanelsDnd(false);
            const res = await api.get(`/panels?batchYear=${filterBatch}`);
            setPanels(Array.isArray(res.data) ? res.data : []);
            alert(`Panels ${isEditingPanelsDnd ? 'Updated' : 'Auto-Created'} Successfully!`);
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
                const isOriginal = s.rollNumber && s.rollNumber.toString().startsWith(batchSuffix);
                const isOverridden = s.targetBatch === filterBatch;
                return isOriginal || isOverridden;
            })();
            const matchesGroupStatus = filterGroupStatus === 'All' ||
                (filterGroupStatus === 'Grouped' ? s.isGrouped : !s.isGrouped);

            const matchesVerificationStatus = filterVerificationStatus === 'All' ||
                (filterVerificationStatus === 'Verified' ? s.isVerified : !s.isVerified);

            return matchesSearch && matchesBranch && matchesBatch && matchesGroupStatus && matchesVerificationStatus;
        }).sort((a, b) => {
            if (sortOption === 'Name (A-Z)') return a.name.localeCompare(b.name);
            if (sortOption === 'Name (Z-A)') return b.name.localeCompare(a.name);
            if (sortOption === 'Roll No (Asc)') return (a.rollNumber || '').localeCompare(b.rollNumber || '');
            if (sortOption === 'Roll No (Desc)') return (b.rollNumber || '').localeCompare(a.rollNumber || '');
            return 0;
        });
    };

    const handleUpdateBatchViaModal = async (newBatch: string) => {
        if (!configBatchGroup) return;
        try {
            await api.put(`/groups/${configBatchGroup._id}`, { targetBatch: newBatch });
            const groupsRes = await api.get('/groups');
            setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
            setConfigBatchGroup(null);
            setConfigBatchMenuOpen(null);
        } catch (error) {
            console.error('Failed to update targetBatch', error);
            alert('Failed to update batch');
        }
    };

    const handleUpdateStudentBatch = async (newBatch: string) => {
        if (!configStudentBatch) return;
        try {
            await api.put(`/users/${configStudentBatch._id}`, { targetBatch: newBatch });
            const res = await api.get('/users/students');
            setStudents(Array.isArray(res.data) ? res.data : []);
            setConfigStudentBatch(null);
            setStudentBatchMenuOpen(null);
        } catch (error) {
            console.error('Failed to update student targetBatch', error);
            alert('Failed to update student batch');
        }
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

            const matchesBatch = filterBatch === 'All' || getGroupBatchYear(g) === filterBatch;

            const matchesFaculty = filterFaculty === 'All' || g.project?.faculty?._id === filterFaculty || g.project?.faculty === filterFaculty;

            return matchesSearch && matchesBatch && matchesFaculty;
        }).sort((a, b) => {
            if (sortOption === 'Name (A-Z)') return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
            if (sortOption === 'Name (Z-A)') return (b.name || '').localeCompare(a.name || '', undefined, { numeric: true });
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
                // Determine batch from members or targetBatch
                const batchYear = getGroupBatchYear(g);

                if (!stats[batchYear]) {
                    stats[batchYear] = { students: 0, groups: 0 };
                }
                stats[batchYear].groups += 1;
                stats[batchYear].students += g.members.length;
            }
        });

        return stats;
    };

    const handleExportPanels = async () => {
        if (!exportBatch || exportBatch === 'All') { alert('Please select a specific batch first.'); return; }
        try {
            const response = await api.get(`/panels/export?batchYear=${exportBatch}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `panels_export_${exportBatch}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export panels');
        }
    };

    const handleExportEvaluations = async (type: 'midterm' | 'full') => {
        if (!exportBatch || exportBatch === 'All') { alert('Please select a specific batch first.'); return; }
        try {
            const response = await api.get(`/panels/export-evaluations?batchYear=${exportBatch}&evalType=${type}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `evaluation_export_${exportBatch}_${type}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export evaluations');
        }
    };

    const handleExportStudents = async () => {
        if (!exportBatch || exportBatch === 'All') { alert('Please select a specific batch first.'); return; }
        try {
            const response = await api.get(`/users/students/export?batch=${exportBatch}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `students_export_${exportBatch}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export students');
        }
    };

    const handleExportFaculty = async () => {
        try {
            const response = await api.get('/users/faculty/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'faculty_export.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Faculty export failed', error);
            alert('Failed to export faculty');
        }
    };

    const DEFAULT_RUBRICS: Record<string, any[]> = {
        mid_term_evaluation: [
            {
                title: 'Guide Evaluation', key: 'guide', fields: [
                    { key: 'dataElicitation', label: 'Data Elicitation', max: 5 },
                    { key: 'problemDefinition', label: 'Problem Definition', max: 5 },
                    { key: 'planning', label: 'Planning', max: 5 },
                ]
            },
            {
                title: 'Panel Evaluation', key: 'panel', fields: [
                    { key: 'literatureSurvey', label: 'Literature Survey', max: 5 },
                    { key: 'presentationSkills', label: 'Presentation Skills', max: 5 },
                    { key: 'technicalUnderstanding', label: 'Technical Understanding', max: 5 },
                ]
            },
        ],
        end_term_evaluation: [
            {
                title: 'Guide Evaluation', key: 'guide', fields: [
                    { key: 'requirementSpecification', label: 'Requirement Specification', max: 7 },
                    { key: 'systemDesign', label: 'System Design', max: 7 },
                    { key: 'implementation', label: 'Implementation', max: 7 },
                    { key: 'projectManagement', label: 'Project Management', max: 7 },
                    { key: 'planningVsExecution', label: 'Planning vs Execution', max: 7 },
                ]
            },
            {
                title: 'Panel Evaluation', key: 'panel', fields: [
                    { key: 'testingAndResults', label: 'Testing & Results', max: 10 },
                    { key: 'innovationAndRelevance', label: 'Innovation & Relevance', max: 5 },
                    { key: 'presentationAndViva', label: 'Presentation & Viva', max: 10 },
                    { key: 'conceptualDepth', label: 'Conceptual Depth', max: 10 },
                ]
            },
        ],
    };

    const initRubricForType = (type: string, existingParams?: any) => {
        if (existingParams) {
            try {
                const parsed = typeof existingParams === 'string' ? JSON.parse(existingParams) : existingParams;
                if (parsed?.sections) {
                    setRubricSections(JSON.parse(JSON.stringify(parsed.sections)));
                    setRubricPanelAggregation(parsed.panelAggregation || 'average');
                    return;
                }
            } catch { }
        }
        setRubricSections(JSON.parse(JSON.stringify(DEFAULT_RUBRICS[type] || [])));
        setRubricPanelAggregation('average');
    };

    const rubricTotalMarks = rubricSections.reduce((sum, s) =>
        sum + s.fields.reduce((fs: number, f: any) => fs + (Number(f.max) || 0), 0), 0);

    const addRubricField = (sectionIdx: number) => {
        setRubricSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
            ...s, fields: [...s.fields, { key: `field_${Date.now()}`, label: '', max: 5 }]
        }));
    };

    const removeRubricField = (sectionIdx: number, fieldIdx: number) => {
        setRubricSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
            ...s, fields: s.fields.filter((_: any, fi: number) => fi !== fieldIdx)
        }));
    };

    const updateRubricField = (sectionIdx: number, fieldIdx: number, key: string, value: any) => {
        setRubricSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
            ...s, fields: s.fields.map((f: any, fi: number) => fi !== fieldIdx ? f : { ...f, [key]: value })
        }));
    };

    const copyUngroupedEmails = async () => {
        try {
            const res = await api.get('/users/students');
            const ungrouped: any[] = (res.data || []).filter((s: any) => !s.isGrouped);
            const emails = ungrouped.map((s: any) => s.email).filter(Boolean).join(',');
            await navigator.clipboard.writeText(emails);
            setEmailsCopied(true);
            setTimeout(() => setEmailsCopied(false), 2500);
        } catch { alert('Failed to copy emails.'); }
    };

    const openGmailWithUngrouped = async () => {
        try {
            const res = await api.get('/users/students');
            const ungrouped: any[] = (res.data || []).filter((s: any) => !s.isGrouped);
            const emails = ungrouped.map((s: any) => s.email).filter(Boolean).join(',');
            window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emails)}`, '_blank');
        } catch { alert('Failed to fetch student emails.'); }
    };

    const handleToggleFacultyVerification = async (f: any) => {
        try {
            await api.put(`/users/${f._id}`, { isVerified: !f.isVerified });
            const res = await api.get('/users/faculty');
            setFaculty(Array.isArray(res.data) ? res.data : []);
        } catch { alert('Failed to update faculty verification.'); }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/admin/create', adminForm);
            alert('Admin account created successfully!');
            setShowCreateAdmin(false);
            setAdminForm({ name: '', email: '', password: '' });
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to create admin');
        }
    };

    return (
        <div className="flex h-full bg-neutral-50 font-jakarta text-neutral-900 overflow-hidden">
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
                        icon={<LayoutGrid className="w-5 h-5" />}
                        label="Dashboard Overview"
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                    />
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
                        label="Data"
                        active={activeTab === 'exports'}
                        onClick={() => setActiveTab('exports')}
                    />
                    <SidebarItem
                        icon={<ArchiveIcon className="w-5 h-5" />}
                        label="Archive"
                        active={activeTab === 'archive'}
                        onClick={() => setActiveTab('archive')}
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
                            {activeTab === 'overview' && 'Dashboard Overview'}
                            {activeTab === 'students' && 'Student Directory'}
                            {activeTab === 'groups' && 'Group Directory'}
                            {activeTab === 'faculty' && 'Faculty Directory'}
                            {activeTab === 'panels' && 'Evaluation Panels'}
                            {activeTab === 'events' && 'Setup Events'}
                            {activeTab === 'exports' && 'Data — Imports & Exports'}
                            {activeTab === 'archive' && 'Archive — Past Semesters'}
                        </h1>
                    </div>
                    {activeTab !== 'events' && <GlobalEventBanner />}
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
                                                value={filterVerificationStatus}
                                                onChange={(e) => setFilterVerificationStatus(e.target.value)}
                                            >
                                                <option value="All">Account: All</option>
                                                <option value="Verified">Verified</option>
                                                <option value="Unverified">Unverified</option>
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
                                                <option value="Name (A-Z)">Group No. (Asc.-Desc.)</option>
                                                <option value="Name (Z-A)">Group No. (Desc.-Asc.)</option>
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
                                {activeTab === 'overview' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div onClick={() => { setActiveTab('students'); setFilterGroupStatus('All'); setFilterVerificationStatus('All'); }} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 hover:shadow-lg transition-all active:scale-[0.98]">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Users className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Total Students</h3>
                                            <div className="flex items-end gap-3">
                                                <span className="text-4xl font-black text-neutral-900">{stats?.students || 0}</span>
                                            </div>
                                        </div>

                                        <div onClick={() => setActiveTab('faculty')} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-rose-300 hover:shadow-lg transition-all active:scale-[0.98]">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Users className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Total Faculty</h3>
                                            <div className="flex items-end gap-3">
                                                <span className="text-4xl font-black text-neutral-900">{stats?.faculty || 0}</span>
                                            </div>
                                        </div>

                                        <div onClick={() => setActiveTab('groups')} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-emerald-300 hover:shadow-lg transition-all active:scale-[0.98]">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <LayoutGrid className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Total Groups</h3>

                                            <div className="flex items-end gap-3">
                                                <span className="text-4xl font-black text-neutral-900">{stats?.groups || 0}</span>
                                                <span className="text-sm font-bold text-indigo-500 mb-1">In System</span>
                                            </div>

                                        </div>

                                        <div onClick={() => setActiveTab('groups')} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 hover:shadow-lg transition-all active:scale-[0.98]">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <FileText className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Total Projects</h3>
                                            <div className="flex items-end gap-3">
                                                <span className="text-4xl font-black text-neutral-900">{stats?.projects || 0}</span>
                                                <span className="text-sm font-bold text-indigo-500 mb-1">In System</span>
                                            </div>
                                        </div>

                                        <div onClick={() => { setActiveTab('students'); setFilterVerificationStatus('Verified'); setFilterGroupStatus('All'); }} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-emerald-300 hover:shadow-lg transition-all active:scale-[0.98]">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <CheckCircle className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Activated Accounts</h3>
                                            <div className="flex items-end gap-3">
                                                <span className="text-4xl font-black text-emerald-600">{stats?.activatedAccounts || 0}</span>
                                                <span className="text-sm font-bold text-emerald-500 mb-1">Verified</span>
                                            </div>
                                        </div>

                                        <div onClick={() => { setActiveTab('students'); setFilterVerificationStatus('Unverified'); setFilterGroupStatus('All'); }} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-rose-300 hover:shadow-lg transition-all active:scale-[0.98]">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Clock className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Unactivated Accounts</h3>
                                            <div className="flex items-end gap-3">
                                                <span className="text-4xl font-black text-rose-600">{stats?.unactivatedAccounts || 0}</span>
                                                <span className="text-sm font-bold text-rose-500 mb-1">Pending</span>
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm relative col-span-2 overflow-hidden hover:border-amber-300 hover:shadow-lg transition-all">
                                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                                <Users className="w-16 h-16" />
                                            </div>
                                            <h3 className="text-neutral-500 font-bold text-sm tracking-wider uppercase mb-2">Ungrouped Students</h3>
                                            <div className="flex items-center justify-between gap-3 mb-4" onClick={() => { setActiveTab('students'); setFilterGroupStatus('Available'); setFilterVerificationStatus('All'); }} style={{ cursor: 'pointer' }}>
                                                <div className="flex items-end gap-3">
                                                    <span className="text-4xl font-black text-amber-600">{stats?.ungroupedStudents || 0}</span>
                                                    <span className="text-sm font-bold text-amber-500 mb-1">Not in any group</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); copyUngroupedEmails(); }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-neutral-100 text-neutral-600 hover:bg-amber-50 hover:text-amber-700 transition-colors border border-neutral-200"
                                                    >
                                                        {emailsCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Emails</>}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openGmailWithUngrouped(); }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-neutral-100 text-neutral-600 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-neutral-200"
                                                    >
                                                        <Mail className="w-3.5 h-3.5" /> Mail Directly
                                                    </button>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Quick Actions */}
                                        <div className="md:col-span-2 lg:col-span-4 mt-6">
                                            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                                                <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                                                    <Settings className="w-5 h-5 text-indigo-600" /> Administrative Actions
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <button
                                                        onClick={() => setShowCreateAdmin(true)}
                                                        className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-left group"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                                            <Plus className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-neutral-900 group-hover:text-indigo-700">Add New Admin</p>
                                                            <p className="text-xs text-neutral-500">Create a secondary admin account</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => { setCreateUserError(null); setCreateUserSuccess(null); setCreateUserForm({ name: '', email: '', role: 'Student', rollNumber: '', branch: 'CSE', semester: '', department: 'CSE', expertise: '' }); setShowCreateUser(true); }}
                                                        className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-200 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all text-left group"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                                                            <Plus className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-neutral-900 group-hover:text-green-700">Create Account</p>
                                                            <p className="text-xs text-neutral-500">Add a student or faculty account</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Group Status Breakdown */}
                                        {stats && (
                                            <div className="md:col-span-2 lg:col-span-4">
                                                <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
                                                    <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                                                        <LayoutGrid className="w-5 h-5 text-emerald-600" /> Group Status Breakdown
                                                    </h3>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {[
                                                            { label: 'Forming', val: stats?.groupsByStatus?.Forming ?? 0, color: 'amber' },
                                                            { label: 'Proposal Pending', val: stats?.groupsByStatus?.ProposalPending ?? 0, color: 'orange' },
                                                            { label: 'Approved', val: stats?.groupsByStatus?.Approved ?? 0, color: 'emerald' },
                                                        ].map(({ label, val, color }) => (
                                                            <div key={label} onClick={() => setActiveTab('groups')} className={`cursor-pointer p-4 rounded-2xl bg-${color}-50 border border-${color}-100 hover:shadow-md transition-all`}>
                                                                <p className={`text-xs font-bold uppercase tracking-wider text-${color}-600 mb-1`}>{label}</p>
                                                                <p className={`text-3xl font-black text-${color}-700`}>{val}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'students' && (
                                    <>
                                        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-visible">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-neutral-50 border-b border-neutral-200">
                                                    <tr>
                                                        <th className="px-6 py-3 font-semibold text-neutral-500">Student</th>
                                                        <th className="px-6 py-3 font-semibold text-neutral-500">Branch</th>
                                                        <th className="px-6 py-3 font-semibold text-neutral-500">Group</th>
                                                        <th className="px-6 py-3 font-semibold text-neutral-500">Account</th>
                                                        <th className="px-6 py-3 font-semibold text-neutral-500 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-neutral-100">
                                                    {getFilteredStudents().map((student) => (
                                                        <tr key={student._id} className="hover:bg-neutral-50">
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`font-semibold ${getBatch(student.rollNumber) !== student.targetBatch && student.targetBatch ? 'text-red-700' : 'text-neutral-900'}`}>
                                                                            {student.name}
                                                                        </span>
                                                                        {student.targetBatch && getBatch(student.rollNumber) !== student.targetBatch && (
                                                                            <span className="text-[10px] text-red-600 font-bold uppercase bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                                                                Dropper → {student.targetBatch}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="font-mono text-xs text-neutral-500">{student.rollNumber || '—'}</span>
                                                                    <span className="text-xs text-neutral-400 truncate max-w-[220px]">{student.email}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-lg">{student.branch || '—'}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {student.isGrouped ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                        <Check className="w-3 h-3" /> In Group
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                                        Ungrouped
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {student.isVerified ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                                        <CheckCircle className="w-3 h-3" /> Activated
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                                        <Clock className="w-3 h-3" /> Pending
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <a
                                                                        href={`mailto:${student.email}`}
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-neutral-400 hover:text-blue-600 transition-colors"
                                                                        title="Send email"
                                                                    >
                                                                        <Mail className="w-4 h-4" />
                                                                    </a>
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setStudentBatchMenuOpen(studentBatchMenuOpen === student._id ? null : student._id);
                                                                            }}
                                                                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
                                                                            title="More actions"
                                                                        >
                                                                            <Settings className="w-4 h-4" />
                                                                        </button>
                                                                        {studentBatchMenuOpen === student._id && (
                                                                            <div
                                                                                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-50 animate-in fade-in zoom-in duration-200"
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                <button
                                                                                    onClick={() => { setConfigStudentBatch(student); setStudentBatchMenuOpen(null); }}
                                                                                    className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                                                                                >
                                                                                    <AlertCircle className="w-4 h-4" /> Override batch
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {students.length === 0 && (
                                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-neutral-400">No students found.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'faculty' && (
                                    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-visible">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-neutral-50 border-b border-neutral-200">
                                                <tr>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Faculty</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Load</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500">Verified</th>
                                                    <th className="px-6 py-3 font-semibold text-neutral-500 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {faculty
                                                    .filter((f: any) => f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || f.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                                                    .sort((a: any, b: any) => {
                                                        if (sortOption === 'Name (A-Z)') return a.name.localeCompare(b.name);
                                                        if (sortOption === 'Name (Z-A)') return b.name.localeCompare(a.name);
                                                        if (sortOption === 'Load (High-Low)') return (b.currentGroups || 0) - (a.currentGroups || 0);
                                                        if (sortOption === 'Load (Low-High)') return (a.currentGroups || 0) - (b.currentGroups || 0);
                                                        return 0;
                                                    })
                                                    .map((f: any) => (
                                                        <tr key={f._id} className="hover:bg-neutral-50">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    {f.photoUrl ? (
                                                                        <img src={f.photoUrl} alt={f.name} className="w-9 h-9 rounded-full object-cover shrink-0 border border-neutral-200" />
                                                                    ) : (
                                                                        <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0">
                                                                            {f.name?.charAt(0) || 'F'}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="font-semibold text-neutral-900">{f.name}</span>
                                                                        <span className="text-xs text-neutral-400">{f.email}</span>
                                                                        {f.department && <span className="text-xs text-neutral-400">{f.department}</span>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${(f.currentGroups || 0) > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
                                                                    {f.currentGroups || 0} Groups
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {f.isVerified ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                                        <ShieldOff className="w-3.5 h-3.5" /> Unverified
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <a
                                                                        href={`mailto:${f.email}`}
                                                                        className="px-3 py-2 rounded-lg hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors font-medium text-xs flex items-center gap-1.5 border border-blue-200 hover:border-blue-300 cursor-pointer"
                                                                        title="Send email"
                                                                    >
                                                                        <Mail className="w-4 h-4" /> Mail
                                                                    </a>
                                                                    <button
                                                                        onClick={() => handleToggleFacultyVerification(f)}
                                                                        className={`p-1.5 rounded-lg transition-colors ${f.isVerified ? 'hover:bg-rose-50 text-neutral-400 hover:text-rose-600' : 'hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600'}`}
                                                                        title={f.isVerified ? 'Revoke verification' : 'Verify faculty'}
                                                                    >
                                                                        {f.isVerified ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEditFaculty(f)}
                                                                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-neutral-400 hover:text-indigo-600 transition-colors"
                                                                        title="Configure limits"
                                                                    >
                                                                        <Settings className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {faculty.length === 0 && (
                                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-neutral-400">No faculty found.</td></tr>
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
                                                    const batchGroups = displayGroups.filter((g: any) => {
                                                        if (filterBatch !== 'All') return true; // Already filtered
                                                        return getGroupBatchYear(g) === batchYear.toString();
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

                                                            {(() => {
                                                                const hasMidEval = events.some(e => e.type === 'mid_term_evaluation' && e.isActive);
                                                                const hasEndEval = events.some(e => e.type === 'end_term_evaluation' && e.isActive);
                                                                const showMid = hasMidEval || hasEndEval;
                                                                const showEnd = hasEndEval;
                                                                return (
                                                                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-visible">
                                                                        <table className="w-full text-left">
                                                                            <thead className="bg-neutral-50 border-b border-neutral-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Group / Project</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Faculty</th>
                                                                                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                                                                                    {showMid && <th className="px-4 py-4 text-xs font-bold text-indigo-400 uppercase tracking-wider text-center">Mid</th>}
                                                                                    {showEnd && <th className="px-4 py-4 text-xs font-bold text-purple-400 uppercase tracking-wider text-center">End</th>}
                                                                                    {showEnd && <th className="px-4 py-4 text-xs font-bold text-emerald-500 uppercase tracking-wider text-center">Total</th>}
                                                                                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-neutral-100">
                                                                                {batchGroups.map((item: any) => {
                                                                                    const midMarks = item.project?.midTermEvaluation?.marks;
                                                                                    const endMarks = item.project?.endTermEvaluation?.marks;
                                                                                    const total = (midMarks ?? 0) + (endMarks ?? 0);
                                                                                    return (
                                                                                        <tr key={item._id} onClick={() => setViewGroup(item)} className={`cursor-pointer transition-colors group ${item.targetBatch && (item.members?.some((m: any) => getBatch(m.rollNumber) !== item.targetBatch)) ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : 'hover:bg-neutral-50'}`}>
                                                                                            <td className="px-6 py-4">
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{item.project?.title || 'No Project'}</span>
                                                                                                    <span className="text-sm text-neutral-500 line-clamp-1 mb-1">
                                                                                                        {item.name ? `Group ${item.name}` : ''} {item.targetBatch ? `(Dropper/Batch override: ${item.targetBatch})` : ''}
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
                                                                                            {showMid && (
                                                                                                <td className="px-4 py-4 text-center">
                                                                                                    {midMarks != null
                                                                                                        ? <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-bold">{midMarks}</span>
                                                                                                        : <span className="text-neutral-300 text-sm">—</span>}
                                                                                                </td>
                                                                                            )}
                                                                                            {showEnd && (
                                                                                                <td className="px-4 py-4 text-center">
                                                                                                    {endMarks != null
                                                                                                        ? <span className="inline-block px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-sm font-bold">{endMarks}</span>
                                                                                                        : <span className="text-neutral-300 text-sm">—</span>}
                                                                                                </td>
                                                                                            )}
                                                                                            {showEnd && (
                                                                                                <td className="px-4 py-4 text-center">
                                                                                                    {(midMarks != null || endMarks != null)
                                                                                                        ? <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold">{total}</span>
                                                                                                        : <span className="text-neutral-300 text-sm">—</span>}
                                                                                                </td>
                                                                                            )}
                                                                                            <td className="px-6 py-4 text-right">
                                                                                                <div className="flex flex-col items-end gap-2">
                                                                                                    <div className="relative">
                                                                                                        <button
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                setConfigBatchMenuOpen(configBatchMenuOpen === item._id ? null : item._id);
                                                                                                            }}
                                                                                                            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
                                                                                                        >
                                                                                                            <MoreVertical className="w-5 h-5" />
                                                                                                        </button>
                                                                                                        {configBatchMenuOpen === item._id && (
                                                                                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-30" onClick={e => e.stopPropagation()}>
                                                                                                                <button
                                                                                                                    onClick={() => {
                                                                                                                        setConfigBatchGroup(item);
                                                                                                                        setConfigBatchMenuOpen(null);
                                                                                                                    }}
                                                                                                                    className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                                                                                                                >
                                                                                                                    <Settings className="w-4 h-4" /> Configure Batch
                                                                                                                </button>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                );
                                                            })()}
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
                                            <button onClick={() => {
                                                setEditingPanelId(null);
                                                setNewPanelFaculty([]);
                                                setNewPanelBatch('');
                                                setShowCreatePanel(true);
                                            }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
                                                Create New Panel
                                            </button>
                                        </div>
                                        {Object.entries(
                                            panels
                                                .filter(p => filterBatch === 'All' || String(p.batchYear) === String(filterBatch))
                                                .reduce((acc: any, panel: any) => {
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
                                                            onClick={(e) => {
                                                                if ((e.target as HTMLElement).closest('button')) return;
                                                                setCollapsedPanelsBatches(prev => ({ ...prev, [year]: !prev[year] }))
                                                            }}
                                                        >
                                                            <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 group-hover:bg-indigo-200 transition-colors">
                                                                Batch {year}-{parseInt(year) + 4}
                                                                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                                            </div>
                                                            <div className="h-px bg-neutral-200 flex-1 group-hover:bg-indigo-200 transition-colors"></div>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();

                                                                    let currentGroups = groups;
                                                                    let currentFaculty = faculty;

                                                                    if (currentGroups.length === 0 || currentFaculty.length === 0) {
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
                                                                            console.error("Failed to fetch data for editing panels", error);
                                                                            alert("Failed to load required faculty or group data.");
                                                                            return;
                                                                        }
                                                                    }

                                                                    const batchGroups = currentGroups.filter((g: any) => {
                                                                        return getGroupBatchYear(g) === year.toString();
                                                                    });

                                                                    const calculateLoad = (fId: string) => {
                                                                        let count = 0;
                                                                        batchGroups.forEach(g => {
                                                                            if (g.project && (g.project.faculty === fId || g.project.faculty?._id === fId)) {
                                                                                count++;
                                                                            }
                                                                        });
                                                                        return count;
                                                                    };

                                                                    // Gather faculties currently in this batch's panels
                                                                    const facultiesInPanels: any[] = [];
                                                                    const initialDraftPanels: any[] = [];

                                                                    yearPanels.forEach((panel: any, idx: number) => {
                                                                        const mappedFaculties = panel.faculty.map((f: any) => ({
                                                                            _id: f._id,
                                                                            name: f.name,
                                                                            email: f.email,
                                                                            groupCount: calculateLoad(f._id)
                                                                        }));

                                                                        facultiesInPanels.push(...mappedFaculties);

                                                                        initialDraftPanels.push({
                                                                            id: `panel-${idx}`,
                                                                            _tempPanelId: panel._id,
                                                                            faculties: mappedFaculties
                                                                        });
                                                                    });

                                                                    // Deduplicate faculties
                                                                    const uniqueFacultiesMap = new Map();
                                                                    facultiesInPanels.forEach(f => {
                                                                        if (!uniqueFacultiesMap.has(f._id)) {
                                                                            uniqueFacultiesMap.set(f._id, f);
                                                                        }
                                                                    });

                                                                    // Identify any completely unassigned faculty for this batch workload to include in pool
                                                                    const unassignedFacs = currentFaculty.filter(f => !uniqueFacultiesMap.has(f._id)).map(f => ({
                                                                        _id: f._id,
                                                                        name: f.name,
                                                                        email: f.email,
                                                                        groupCount: calculateLoad(f._id)
                                                                    }));

                                                                    // Start building panels state
                                                                    setDndEditInitialPanels(initialDraftPanels);
                                                                    setAutoCreateFaculties([...Array.from(uniqueFacultiesMap.values()), ...unassignedFacs]);
                                                                    setAutoCreateBatchYear(year);
                                                                    setIsEditingPanelsDnd(true);
                                                                    setShowAutoCreateModal(true);
                                                                }}
                                                                className="px-3 py-1 bg-white border border-indigo-200 text-indigo-600 font-bold rounded flex shrink-0 items-center gap-1 hover:bg-indigo-50 transition"
                                                            >
                                                                <Pencil className="w-3 h-3" /> Edit Interactive
                                                            </button>
                                                        </div>
                                                    )}
                                                    {!isCollapsed && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                            {yearPanels.map((panel: any, index: number) => {
                                                                const isExpanded = expandedPanelGroups[panel._id] || false;
                                                                const panelGroupsCount = panel.groups?.length || 0;

                                                                const batchSuffix = year.slice(2);
                                                                const batchGroups = groups.filter((g: any) => {
                                                                    return g.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                                });

                                                                const panelFacultyWithLoad = panel.faculty.map((f: any) => {
                                                                    const fId = String(f._id);
                                                                    let count = 0;
                                                                    batchGroups.forEach((g: any) => {
                                                                        if (g.project) {
                                                                            const projFacId = String(g.project.faculty?._id || g.project.faculty || '');
                                                                            if (projFacId && projFacId === fId) count++;
                                                                        }
                                                                    });
                                                                    return { ...f, groupCount: count };
                                                                });

                                                                let chairId = null;
                                                                if (panelFacultyWithLoad.length > 0) {
                                                                    const maxLoad = Math.max(...panelFacultyWithLoad.map((f: any) => f.groupCount));
                                                                    chairId = panelFacultyWithLoad.find((f: any) => f.groupCount === maxLoad)?._id;
                                                                }

                                                                panelFacultyWithLoad.forEach((f: any) => {
                                                                    f.isChair = f._id === chairId;
                                                                });

                                                                return (
                                                                    <div key={panel._id} className="bg-neutral-50 rounded-2xl p-5 border-2 border-neutral-200">
                                                                        <div className="flex justify-between items-start mb-4">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                                                                                    {index + 1}
                                                                                </div>
                                                                                <div>
                                                                                    <h4 className="text-sm font-bold text-neutral-900">Panel {index + 1}</h4>
                                                                                    <p className="text-xs text-neutral-500">{panel.faculty.length} members • {panelGroupsCount} groups</p>
                                                                                    {panel.room && <p className="text-xs text-indigo-600 font-medium mt-0.5">{panel.room}</p>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2 min-h-[60px] mb-4">
                                                                            <h5 className="text-xs font-bold text-neutral-400 uppercase mb-2">Faculty Members</h5>
                                                                            {panelFacultyWithLoad.map((f: any) => (
                                                                                <div key={f._id} className={`flex items-center gap-3 bg-white p-3 rounded-xl border ${f.isChair ? 'border-amber-300 ring-1 ring-amber-100' : 'border-neutral-200'} shadow-sm`}>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <h5 className="text-sm font-bold text-neutral-900 truncate flex items-center gap-1.5">
                                                                                            {f.name}
                                                                                            {f.isChair && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Chair</span>}
                                                                                        </h5>
                                                                                        <p className="text-xs text-neutral-500 truncate">{f.email}</p>
                                                                                    </div>
                                                                                    <div className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                                                                                        {f.groupCount} Grps
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        {panelGroupsCount > 0 && (
                                                                            <div className="mt-4 border-t border-neutral-200/60 pt-4">
                                                                                <button
                                                                                    onClick={() => setExpandedPanelGroups(prev => ({ ...prev, [panel._id]: !prev[panel._id] }))}
                                                                                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-neutral-200 hover:bg-indigo-50 hover:border-indigo-200 rounded-xl transition-all text-sm font-semibold text-neutral-700 hover:text-indigo-700"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Users className="w-4 h-4" />
                                                                                        <span>Evaluated Groups ({panelGroupsCount})</span>
                                                                                    </div>
                                                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                                </button>

                                                                                {isExpanded && (
                                                                                    <div className="mt-3 space-y-2 bg-white rounded-xl border border-neutral-100 p-2 shadow-sm">
                                                                                        {panel.groups.map((g: any) => {
                                                                                            const isDropper = g.targetBatch && (g.members?.some((m: any) => getBatch(m.rollNumber) !== g.targetBatch));
                                                                                            return (
                                                                                                <div key={g._id} className={`p-3 border transition-colors rounded-lg overflow-hidden relative ${isDropper ? 'bg-red-50 border-red-200 hover:border-red-300 hover:bg-red-100/50' : 'bg-neutral-50 border-neutral-100 hover:border-indigo-100 hover:bg-indigo-50/30'}`}>
                                                                                                    {isDropper && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                                                                                                    <div className={`flex items-center justify-between mb-1.5 ${isDropper ? 'pl-2' : ''}`}>
                                                                                                        <h6 className={`font-bold text-xs truncate mr-2 ${isDropper ? 'text-red-800' : 'text-indigo-900 group-hover:text-indigo-700'}`}>
                                                                                                            Group {g.name} {isDropper ? `(Dropper/Batch override: ${g.targetBatch})` : ''}
                                                                                                        </h6>
                                                                                                        <span className="shrink-0 px-2 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-bold text-neutral-500">
                                                                                                            {g.members?.length || 0} Members
                                                                                                        </span>
                                                                                                    </div>
                                                                                                    <div className="space-y-1 mt-2 border-t border-neutral-200/50 pt-2 text-[11px] text-neutral-600">
                                                                                                        {g.members?.map((m: any) => (
                                                                                                            <div key={m._id} className="flex justify-between items-center">
                                                                                                                <span className="truncate pr-2 font-medium">{m.name}</span>
                                                                                                                <span className="font-mono text-[10px] text-neutral-400 shrink-0">{m.rollNumber}</span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
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
                                    <div className="space-y-8">
                                        {/* Create Event Button */}
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => {
                                                    setEditingEvent(null);
                                                    setEventForm({ type: '', endDate: '', extensionDate: '', batchYear: '', rubricParams: '' });
                                                    setParticipatingBatches([]);
                                                    setRubricSections([]); setRubricPanelAggregation('average');
                                                    setRubricMode('builder');
                                                    setShowCreateEvent(true);
                                                }}
                                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> Create New Event
                                            </button>
                                        </div>

                                        {/* Events List */}
                                        {events.length === 0 ? (
                                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-neutral-300">
                                                <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                                                <h3 className="text-lg font-bold text-neutral-700 mb-2">No Events Created</h3>
                                                <p className="text-neutral-500 text-sm">Create your first event to manage timelines for group formation, evaluations, and more.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                                {events.map((ev: any) => {
                                                    const now = new Date();
                                                    const end = new Date(ev.endDate);
                                                    const ext = ev.extensionDate ? new Date(ev.extensionDate) : null;
                                                    const effectiveEnd = ext || end;
                                                    const isOngoing = now <= effectiveEnd;
                                                    const isExpired = now > effectiveEnd;
                                                    const daysLeft = Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                                                    const typeColors: any = {
                                                        group_formation_project_proposal: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
                                                        mid_term_evaluation: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700' },
                                                        end_term_evaluation: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' }
                                                    };
                                                    const colors = typeColors[ev.type] || typeColors.group_formation_project_proposal;
                                                    const typeLabels: any = {
                                                        group_formation_project_proposal: 'Group Formation & Project Proposal',
                                                        mid_term_evaluation: 'Mid-Term Evaluation',
                                                        end_term_evaluation: 'End-Term Evaluation'
                                                    };
                                                    const typeIcons: any = {
                                                        group_formation_project_proposal: <Users className="w-6 h-6" />,
                                                        mid_term_evaluation: <AlertCircle className="w-6 h-6" />,
                                                        end_term_evaluation: <CheckCircle className="w-6 h-6" />
                                                    };

                                                    return (
                                                        <motion.div
                                                            key={ev._id}
                                                            layout
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className={`bg-white rounded-2xl border-2 ${colors.border} p-6 shadow-sm hover:shadow-lg transition-all relative overflow-hidden`}
                                                        >                                                            {/* Status indicator strip */}
                                                            <div className={`absolute top-0 left-0 right-0 h-1 ${isOngoing ? 'bg-green-500' : isExpired ? 'bg-red-400' : 'bg-amber-400'}`} />

                                                            <div className="flex items-start justify-between mb-4">
                                                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${colors.icon}`}>
                                                                    {typeIcons[ev.type]}
                                                                </div>                                                                 <div className="flex items-center gap-1.5">
                                                                    {!isExpired && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingEvent(ev);
                                                                                setEventForm({
                                                                                    type: ev.type,
                                                                                    endDate: new Date(ev.endDate).toISOString().slice(0, 16),
                                                                                    extensionDate: ev.extensionDate ? new Date(ev.extensionDate).toISOString().slice(0, 16) : '',
                                                                                    batchYear: ev.batchYear || '',
                                                                                    rubricParams: ev.rubricParams ? JSON.stringify(ev.rubricParams, null, 2) : ''
                                                                                });
                                                                                setParticipatingBatches(Array.isArray(ev.participatingBatches) ? ev.participatingBatches.map(String) : []);
                                                                                setRubricMode('builder');
                                                                                initRubricForType(ev.type, ev.rubricParams);
                                                                                setShowCreateEvent(true);
                                                                            }}
                                                                            className="p-2 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                                            title="Edit event"
                                                                        >
                                                                            <Edit3 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    {isExpired ? (
                                                                        <button
                                                                            onClick={() => setConfirmDeleteEvent(ev)}
                                                                            className="p-2 rounded-lg bg-neutral-100 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                                            title="Delete event permanently"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setConfirmEndEvent(ev)}
                                                                            className="p-2 rounded-lg bg-neutral-100 text-neutral-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                                                            title="End event early"
                                                                        >
                                                                            <Power className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                            </div>

                                                            <div className="mb-3">
                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
                                                                    {typeLabels[ev.type] || ev.type.replace(/_/g, ' ').toUpperCase()}
                                                                </span>
                                                            </div>

                                                            <h3 className="text-xl font-bold text-neutral-900 mb-1.5">{typeLabels[ev.type] || ev.type.replace(/_/g, ' ').toUpperCase()}</h3>

                                                            {/* Status Badge */}
                                                            <div className="mb-4 mt-4">
                                                                {isOngoing ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> LIVE — {daysLeft > 0 ? `${daysLeft} days left` : 'Ends today'}
                                                                    </span>
                                                                ) : isExpired ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                                        <span className="w-2 h-2 rounded-full bg-red-500" /> EXPIRED
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                                        <span className="w-2 h-2 rounded-full bg-amber-500" /> UPCOMING
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Timeline */}
                                                            <div className="space-y-2 text-sm">
                                                                <div className="flex items-center gap-2 text-neutral-600">
                                                                    <Clock className="w-4 h-4 text-neutral-400" />
                                                                    <span className="font-medium">Deadline:</span>
                                                                    <span>{end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                                {ext && (
                                                                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                                                                        <AlertTriangle className="w-4 h-4" />
                                                                        <span>Extended to:</span>
                                                                        <span>{ext.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {ext.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                )}
                                                                {ev.batchYear && (
                                                                    <div className="flex items-center gap-2 text-neutral-600">
                                                                        <Users className="w-4 h-4 text-neutral-400" />
                                                                        <span className="font-medium">Batch:</span>
                                                                        <span>{ev.batchYear}-{parseInt(ev.batchYear) + 4}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'exports' && (
                                    <div className="max-w-3xl mx-auto space-y-6">
                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Evaluation Panels Export</h3>
                                                    <p className="text-sm text-neutral-500">Export panels, faculty, and group mapping (Blank Template).</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={exportBatch}
                                                    onChange={(e) => setExportBatch(e.target.value)}
                                                    className="px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                >
                                                    <option value="">Select Batch</option>
                                                    {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                                        <option key={year} value={year.toString()}>{year}-{year + 4}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={handleExportPanels}
                                                    className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" /> Export Excel
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col gap-6 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-neutral-900">Evaluation Data Export</h3>
                                                        <p className="text-sm text-neutral-500">Export evaluation marks and grades for each group.</p>
                                                    </div>
                                                </div>
                                                <select
                                                    value={exportBatch}
                                                    onChange={(e) => setExportBatch(e.target.value)}
                                                    className="px-3 py-1.5 bg-neutral-50 rounded-lg border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                >
                                                    <option value="">Select Batch</option>
                                                    {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                                        <option key={year} value={year.toString()}>{year}-{year + 4}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <button
                                                    onClick={() => handleExportEvaluations('midterm')}
                                                    className="flex items-center justify-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors group"
                                                >
                                                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                                        <Download className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-bold text-neutral-900">Midterm Evaluation</div>
                                                        <div className="text-xs text-neutral-500">Only midterm marks populated</div>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => handleExportEvaluations('full')}
                                                    className="flex items-center justify-center gap-3 p-4 border border-blue-200 bg-blue-50/30 rounded-xl hover:bg-blue-50 transition-colors group"
                                                >
                                                    <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-md shadow-blue-200">
                                                        <Download className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-bold text-neutral-900">Midterm + Endterm</div>
                                                        <div className="text-xs text-neutral-500">Combined evaluation data</div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>


                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Student Directory Export</h3>
                                                    <p className="text-sm text-neutral-500">Export student list, roll numbers, and group status.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={exportBatch}
                                                    onChange={(e) => setExportBatch(e.target.value)}
                                                    className="px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                >
                                                    <option value="">Select Batch</option>
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

                                        {/* ── Faculty Export ─────────────────────────────────── */}
                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Faculty Directory Export</h3>
                                                    <p className="text-sm text-neutral-500">Export faculty list with department, limits, and account status.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleExportFaculty}
                                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" /> Export Excel
                                            </button>
                                        </div>

                                        {/* ── Snapshot Export ──────────────────────────────────── */}
                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                                                    <Download className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Full Database Snapshot</h3>
                                                    <p className="text-sm text-neutral-500">Export all users, groups, projects, and evaluations as a portable JSON file.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.get('/import/snapshot/export', { responseType: 'blob' });
                                                        const url = URL.createObjectURL(new Blob([res.data]));
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `snapshot_${new Date().toISOString().slice(0, 10)}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    } catch { alert('Snapshot export failed'); }
                                                }}
                                                className="px-6 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" /> Export Snapshot
                                            </button>
                                        </div>

                                        {/* ── Divider ──────────────────────────────────────────── */}
                                        <div className="flex items-center gap-4 py-2">
                                            <div className="flex-1 h-px bg-neutral-200" />
                                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Imports</span>
                                            <div className="flex-1 h-px bg-neutral-200" />
                                        </div>

                                        {/* ── Faculty CSV Import ────────────────────────────────── */}
                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Faculty CSV Import <span className="ml-2 text-xs font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">Step 1</span></h3>
                                                    <p className="text-sm text-neutral-500">Add faculty accounts by uploading a CSV/Excel with Name, Email, Department.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSmartImportTarget('faculty');
                                                    setImportFile(null);
                                                    setImportPreview(null);
                                                    setSimpleImportResult(null);
                                                    setShowImportModal(true);
                                                }}
                                                className="px-6 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
                                            >
                                                <Upload className="w-4 h-4" /> Import Faculty
                                            </button>
                                        </div>

                                        {/* ── Student CSV Import ────────────────────────────────── */}
                                        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Student CSV Import <span className="ml-2 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Step 2</span></h3>
                                                    <p className="text-sm text-neutral-500">Register student accounts (Name, Email, RollNumber) so they can receive activation OTPs.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSmartImportTarget('student');
                                                    setImportFile(null);
                                                    setImportPreview(null);
                                                    setSimpleImportResult(null);
                                                    setShowImportModal(true);
                                                }}
                                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                            >
                                                <Upload className="w-4 h-4" /> Import Students
                                            </button>
                                        </div>

                                        {/* ── Full Excel Import ─────────────────────────────────── */}
                                        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                            <div className="p-6 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                                        <Upload className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-neutral-900">Full Excel Import <span className="ml-2 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Step 3</span></h3>
                                                        <p className="text-sm text-neutral-500">Import groups and projects from an IIITNR Excel sheet. Run Faculty (Step 1) and Student (Step 2) CSV imports first.</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => setShowExcelImportModal(true)}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
                                                    <Upload className="w-4 h-4" /> Import
                                                </button>
                                            </div>
                                        </div>

                                        {/* ── Snapshot Import ───────────────────────────────────── */}
                                        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                            <div className="p-6 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                                                        <Upload className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-neutral-900">Snapshot Import</h3>
                                                        <p className="text-sm text-neutral-500">Restore a full database state from a previously exported snapshot JSON file.</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => setShowSnapshotImportModal(true)}
                                                    className="px-5 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors flex items-center gap-2 text-sm flex-shrink-0">
                                                    <Upload className="w-4 h-4" /> Import
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'archive' && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
                                                    <ArchiveIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-neutral-900">Past Semesters</h3>
                                                    <p className="text-xs text-neutral-500">Read-only archive of projects, participants, evaluations, and panels from prior semesters.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Batch</label>
                                                <select
                                                    value={archiveYear}
                                                    onChange={(e) => setArchiveYear(e.target.value)}
                                                    className="px-3 py-2 bg-white rounded-lg border border-neutral-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                >
                                                    <option value="All">All years</option>
                                                    {(archiveData?.availableYears || []).map((y) => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 border-b border-neutral-200">
                                            {(['projects', 'participants', 'panels'] as const).map(section => (
                                                <button
                                                    key={section}
                                                    onClick={() => setArchiveSection(section)}
                                                    className={`px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${archiveSection === section ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
                                                >
                                                    {section}
                                                    <span className="ml-2 text-xs text-neutral-400">
                                                        {section === 'projects' && (archiveData?.projects?.length ?? 0)}
                                                        {section === 'participants' && (archiveData?.participants?.length ?? 0)}
                                                        {section === 'panels' && (archiveData?.panels?.length ?? 0)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {archiveLoading ? (
                                            <div className="flex items-center justify-center h-48">
                                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                            </div>
                                        ) : !archiveData ? (
                                            <div className="text-center py-12 text-neutral-500">No archive data yet.</div>
                                        ) : (
                                            <>
                                                {archiveSection === 'projects' && (
                                                    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                                                        {(archiveData.projects || []).length === 0 ? (
                                                            <div className="p-10 text-center text-neutral-500 text-sm">No archived projects for this batch.</div>
                                                        ) : (
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                                                                    <tr>
                                                                        <th className="text-left px-4 py-3">Title</th>
                                                                        <th className="text-left px-4 py-3">Group</th>
                                                                        <th className="text-left px-4 py-3">Batch</th>
                                                                        <th className="text-left px-4 py-3">Mentor</th>
                                                                        <th className="text-left px-4 py-3">Mid</th>
                                                                        <th className="text-left px-4 py-3">End</th>
                                                                        <th className="text-left px-4 py-3">Final Report</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {archiveData.projects.map((p: any) => {
                                                                        const g = p.group || {};
                                                                        const groupName = g.name || p.archivedGroupName || '—';
                                                                        const batch = g.targetBatch || p.archivedBatch
                                                                            || (g.members?.[0]?.rollNumber ? '20' + g.members[0].rollNumber.substring(0, 2) : '—');
                                                                        const mid = p.midTermEvaluation?.totalMarks;
                                                                        const end = p.endTermEvaluation?.totalMarks;
                                                                        const fin = p.finalReportEvaluation?.totalMarks;
                                                                        return (
                                                                            <tr key={p._id} className="border-t border-neutral-100 hover:bg-neutral-50">
                                                                                <td className="px-4 py-3 font-semibold text-neutral-900">{p.title || '—'}</td>
                                                                                <td className="px-4 py-3 text-neutral-700">{groupName}</td>
                                                                                <td className="px-4 py-3 text-neutral-700">{batch}</td>
                                                                                <td className="px-4 py-3 text-neutral-700">{p.archivedMentorName || '—'}</td>
                                                                                <td className="px-4 py-3 text-neutral-700">{mid ?? '—'}</td>
                                                                                <td className="px-4 py-3 text-neutral-700">{end ?? '—'}</td>
                                                                                <td className="px-4 py-3 text-neutral-700">{fin ?? '—'}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                )}

                                                {archiveSection === 'participants' && (
                                                    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                                                        {(archiveData.participants || []).length === 0 ? (
                                                            <div className="p-10 text-center text-neutral-500 text-sm">No archived participants for this batch.</div>
                                                        ) : (
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                                                                    <tr>
                                                                        <th className="text-left px-4 py-3">Name</th>
                                                                        <th className="text-left px-4 py-3">Roll</th>
                                                                        <th className="text-left px-4 py-3">Branch</th>
                                                                        <th className="text-left px-4 py-3">Batch</th>
                                                                        <th className="text-left px-4 py-3">Group</th>
                                                                        <th className="text-left px-4 py-3">Project</th>
                                                                        <th className="text-left px-4 py-3">Mentor</th>
                                                                        <th className="text-left px-4 py-3">Mid</th>
                                                                        <th className="text-left px-4 py-3">End</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {archiveData.participants.map((m: any) => (
                                                                        <tr key={m._id + (m.groupName || '')} className="border-t border-neutral-100 hover:bg-neutral-50">
                                                                            <td className="px-4 py-3 font-semibold text-neutral-900">{m.name}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.rollNumber || '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.branch || '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.batchYear || '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.groupName || '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.projectTitle || '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.archivedMentorName || '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.midTermEvaluation?.totalMarks ?? '—'}</td>
                                                                            <td className="px-4 py-3 text-neutral-700">{m.endTermEvaluation?.totalMarks ?? '—'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                )}

                                                {archiveSection === 'panels' && (
                                                    <div className="space-y-4">
                                                        {(archiveData.panels || []).length === 0 ? (
                                                            <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-neutral-500 text-sm shadow-sm">No archived panels for this batch.</div>
                                                        ) : (
                                                            Object.entries(
                                                                (archiveData.panels as any[]).reduce<Record<string, any[]>>((acc, p) => {
                                                                    const key = String(p.batchYear || '—');
                                                                    (acc[key] = acc[key] || []).push(p);
                                                                    return acc;
                                                                }, {})
                                                            ).sort(([a], [b]) => b.localeCompare(a)).map(([year, panelsForYear]) => (
                                                                <div key={year} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                                                    <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200">
                                                                        <span className="text-sm font-bold text-neutral-800">Batch {year}</span>
                                                                        <span className="ml-2 text-xs text-neutral-500">{(panelsForYear as any[]).length} panels</span>
                                                                    </div>
                                                                    <div className="divide-y divide-neutral-100">
                                                                        {(panelsForYear as any[]).map((panel) => (
                                                                            <div key={panel._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                                                <div>
                                                                                    <div className="text-sm font-semibold text-neutral-900">{panel.room ? `Room ${panel.room}` : 'Unassigned room'}</div>
                                                                                    <div className="text-xs text-neutral-500 mt-0.5">
                                                                                        {(panel.faculty || []).map((f: any) => f.name).filter(Boolean).join(', ') || 'No faculty listed'}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-xs text-neutral-500">
                                                                                    {(panel.assignedGroups || []).length} group{(panel.assignedGroups || []).length === 1 ? '' : 's'}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
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
                                <h3 className="text-lg font-bold text-gray-900">{editingPanelId ? 'Edit Panel' : 'Create Panel'}</h3>
                                <button onClick={() => {
                                    setShowCreatePanel(false);
                                    setEditingPanelId(null);
                                    setNewPanelFaculty([]);
                                    setNewPanelBatch('');
                                    setNewPanelRoom('');
                                }} className="text-gray-400 hover:text-gray-600">
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Room / Venue <span className="text-gray-400 font-normal">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={newPanelRoom}
                                        onChange={e => setNewPanelRoom(e.target.value)}
                                        placeholder="e.g. Room 304"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Faculty Members (Max 3)</label>
                                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                        {faculty.filter((f: any) => {
                                            if (!newPanelBatch) return false;
                                            const isAssigned = panels.some((p: any) =>
                                                String(p.batchYear) === String(newPanelBatch) &&
                                                p._id !== editingPanelId &&
                                                p.faculty.some((pf: any) => pf._id === f._id || pf === f._id)
                                            );
                                            return !isAssigned;
                                        }).map((f: any) => (
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
                                        {!newPanelBatch && (
                                            <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-100">
                                                <Users className="w-8 h-8 text-gray-300 mb-2" />
                                                <p className="text-xs font-bold text-gray-400 px-4 leading-relaxed">
                                                    Please select a batch above first<br />to show available faculty members.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{newPanelFaculty.length}/3 selected</p>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => {
                                    setShowCreatePanel(false);
                                    setEditingPanelId(null);
                                    setNewPanelFaculty([]);
                                    setNewPanelBatch('');
                                }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button
                                    onClick={async () => {
                                        try {
                                            const panelPayload = { faculty: newPanelFaculty, batchYear: parseInt(newPanelBatch), room: newPanelRoom || undefined };
                                            if (editingPanelId) {
                                                await api.put(`/panels/${editingPanelId}`, panelPayload);
                                            } else {
                                                await api.post('/panels', panelPayload);
                                            }
                                            setShowCreatePanel(false);
                                            setEditingPanelId(null);
                                            setNewPanelFaculty([]);
                                            setNewPanelBatch('');
                                            setNewPanelRoom('');
                                            const res = await api.get(`/panels?batchYear=${filterBatch}`);
                                            setPanels(Array.isArray(res.data) ? res.data : []);
                                        } catch (e: any) { alert(e.response?.data?.message || `Error ${editingPanelId ? 'updating' : 'creating'} panel`); }
                                    }}
                                    disabled={!newPanelBatch || newPanelFaculty.length === 0}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    {editingPanelId ? 'Save Changes' : 'Create Panel'}
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
                        isEditingMode={isEditingPanelsDnd}
                        initialPanels={dndEditInitialPanels}
                    />
                )}
                {configBatchGroup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Configure Target Batch</h3>
                                <button onClick={() => setConfigBatchGroup(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Details</label>
                                    <div className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded border border-neutral-200">
                                        <p><strong>Group Name/No:</strong> {configBatchGroup.name}</p>
                                        <p><strong>Original Batch:</strong> {getOriginalGroupBatchYear(configBatchGroup)}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Batch Year</label>
                                    <select
                                        defaultValue={configBatchGroup.targetBatch || getOriginalGroupBatchYear(configBatchGroup)}
                                        id="targetBatchUpdate"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select Batch</option>
                                        {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).reverse().map(year => (
                                            <option key={year} value={year.toString()}>Batch {year}</option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-xs text-neutral-500">
                                        Changing the target batch will treat this group as if they belong to the selected batch for all evaluation and panel creation purposes. If the target batch is set to their original batch, they will not be highlighted.
                                    </p>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setConfigBatchGroup(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button onClick={() => handleUpdateBatchViaModal((document.getElementById('targetBatchUpdate') as HTMLSelectElement).value)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">Save Batch</button>
                            </div>
                        </div>
                    </div>
                )}

                {configStudentBatch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Override Student Batch</h3>
                                <button onClick={() => setConfigStudentBatch(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Batch Override</h4>
                                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                            This action will only affect which cohort of students they see in their directory. It does not change their official roll number.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-[10px] uppercase font-black tracking-widest text-neutral-400">Student Profile</label>
                                    <div className="text-sm text-neutral-800 bg-neutral-50 p-4 rounded-xl border border-neutral-200 shadow-inner">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-neutral-400 font-bold uppercase tracking-tighter">Name</span>
                                            <span className="font-black text-neutral-900">{configStudentBatch.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-neutral-400 font-bold uppercase tracking-tighter">Roll No</span>
                                            <span className="font-mono font-bold text-neutral-700">{configStudentBatch.rollNumber}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-neutral-400 font-bold uppercase tracking-tighter">Original Batch</span>
                                            <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-black">{getBatch(configStudentBatch.rollNumber)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                    <label className="block text-[10px] uppercase font-black tracking-widest text-neutral-400">New Target Batch</label>
                                    <select
                                        defaultValue={configStudentBatch.targetBatch || getBatch(configStudentBatch.rollNumber)}
                                        id="studentBatchUpdateSelect"
                                        className="w-full px-4 py-3 bg-white border-2 border-neutral-100 rounded-xl font-bold text-sm focus:border-indigo-500 transition-all outline-none"
                                    >
                                        <option value="">Select Target Batch</option>
                                        {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).reverse().map(year => (
                                            <option key={year} value={year.toString()}>Batch {year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="px-6 py-5 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
                                <button onClick={() => setConfigStudentBatch(null)} className="px-5 py-2.5 text-sm font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all">Cancel</button>
                                <button
                                    onClick={() => handleUpdateStudentBatch((document.getElementById('studentBatchUpdateSelect') as HTMLSelectElement).value)}
                                    className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                >
                                    Apply Override
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create / Edit Event Modal */}
                {showCreateEvent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-neutral-50">
                                <h3 className="text-lg font-bold text-gray-900">{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
                                <button onClick={() => {
                                    setShowCreateEvent(false);
                                    setEditingEvent(null);
                                    setRubricSections([]); setRubricPanelAggregation('average');
                                    setEventForm({ type: 'group_formation_project_proposal', endDate: '', extensionDate: '', batchYear: '', rubricParams: '' });
                                    setParticipatingBatches([]);
                                }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-5 overflow-y-auto">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800">Important</h4>
                                        <p className="text-xs text-amber-700 mt-0.5">Events control what features are visible to students and faculty. Activating an event will immediately show it across all dashboards.</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Type</label>
                                    <select value={eventForm.type} onChange={(e) => { const t = e.target.value; setEventForm(prev => ({ ...prev, type: t })); if (t === 'mid_term_evaluation' || t === 'end_term_evaluation') { setRubricMode('builder'); initRubricForType(t); } }} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm transition-all focus:ring-2 focus:ring-indigo-500/20">
                                        <option value="">Select Event Type</option>
                                        <option value="group_formation_project_proposal">Group Formation & Project Proposal</option>
                                        <option value="mid_term_evaluation">Mid-Term Evaluation</option>
                                        <option value="end_term_evaluation">End-Term Evaluation</option>
                                    </select>

                                    {eventForm.type === 'group_formation_project_proposal' && (
                                        <div className="mt-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300">
                                            <div className="flex items-start gap-3">
                                                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-red-800 uppercase tracking-wider">Critical Warning</h4>
                                                    <p className="text-xs text-red-700 mt-1 font-bold leading-relaxed">
                                                        This will <span className="bg-red-200 px-1 rounded">archive all groups, projects, and panels</span>,
                                                        reset faculty capacity counters, and mark only the selected batches as participating this semester.
                                                        All other students (freshers, graduated, non-participating repeaters) will stop receiving notifications.
                                                        This action is irreversible.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {eventForm.type === 'group_formation_project_proposal' && (
                                        <div className="mt-3">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Participating Batches <span className="text-red-500">*</span>
                                            </label>
                                            <p className="text-[11px] text-neutral-500 mb-2">Select every batch doing the minor project this semester. Use 4-digit admission years (e.g. 2023).</p>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {(() => {
                                                    const currentYear = new Date().getFullYear();
                                                    const years = Array.from({ length: 6 }, (_, i) => (currentYear - 4 + i).toString());
                                                    return years.map(y => {
                                                        const selected = participatingBatches.includes(y);
                                                        return (
                                                            <button
                                                                key={y}
                                                                type="button"
                                                                onClick={() => setParticipatingBatches(prev => selected ? prev.filter(b => b !== y) : [...prev, y])}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-neutral-600 border-neutral-300 hover:border-indigo-300'}`}
                                                            >
                                                                {y}
                                                            </button>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                            {participatingBatches.length === 0 && (
                                                <p className="text-[11px] text-red-500 font-semibold">At least one batch must be selected.</p>
                                            )}
                                        </div>
                                    )}

                                    {eventForm.type === 'mid_term_evaluation' && events.some(ev => ev.type === 'group_formation_project_proposal' && new Date(ev.extensionDate || ev.endDate) > new Date()) && (
                                        <div className="mt-2 text-[10px] text-red-500 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                                            <AlertCircle className="w-3.5 h-3.5" /> Requirement: Group Formation phase must end first
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline (End Date & Time)</label>
                                        <input type="datetime-local" value={eventForm.endDate} onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Extension Date (Optional)</label>
                                        <input type="datetime-local" value={eventForm.extensionDate} onChange={(e) => setEventForm(prev => ({ ...prev, extensionDate: e.target.value }))} className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-sm bg-orange-50/30" />
                                        {eventForm.extensionDate && (<button onClick={() => setEventForm(prev => ({ ...prev, extensionDate: '' }))} className="text-xs text-red-500 mt-1 hover:underline">Remove extension</button>)}
                                    </div>
                                </div>

                                {(eventForm.type === 'mid_term_evaluation' || eventForm.type === 'end_term_evaluation') && (
                                    <div className="pt-2 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-gray-700">Evaluation Rubric</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                    Total: {rubricTotalMarks} marks
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setRubricMode(m => m === 'builder' ? 'json' : 'builder')}
                                                    className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-1 rounded hover:bg-neutral-200 transition"
                                                >
                                                    {rubricMode === 'builder' ? 'Switch to JSON' : 'Switch to Builder'}
                                                </button>
                                            </div>
                                        </div>

                                        {rubricMode === 'builder' ? (
                                            <div className="space-y-4">
                                                {rubricSections.map((section: any, sIdx: number) => (
                                                    <div key={sIdx} className="border border-neutral-200 rounded-xl overflow-hidden">
                                                        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${section.key === 'guide' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                                                                <span className="text-sm font-bold text-neutral-800">{section.title}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-neutral-500">
                                                                {section.fields.reduce((s: number, f: any) => s + (Number(f.max) || 0), 0)} marks
                                                            </span>
                                                        </div>
                                                        <div className="p-3 space-y-2">
                                                            {section.fields.map((field: any, fIdx: number) => (
                                                                <div key={fIdx} className="flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={field.label}
                                                                        onChange={e => updateRubricField(sIdx, fIdx, 'label', e.target.value)}
                                                                        placeholder="Field label"
                                                                        className="flex-1 px-2.5 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                    />
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <input
                                                                            type="number"
                                                                            value={field.max}
                                                                            onChange={e => updateRubricField(sIdx, fIdx, 'max', e.target.value)}
                                                                            min={1}
                                                                            max={100}
                                                                            className="w-16 px-2 py-1.5 text-sm border border-neutral-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                        />
                                                                        <span className="text-xs text-neutral-400">pts</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeRubricField(sIdx, fIdx)}
                                                                        className="p-1 text-neutral-300 hover:text-red-500 transition-colors shrink-0"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                onClick={() => addRubricField(sIdx)}
                                                                className="w-full py-1.5 text-xs font-medium text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <Plus className="w-3 h-3" /> Add field
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Panel Score Aggregation */}
                                                <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-bold text-neutral-800">Panel Score Method</p>
                                                        <p className="text-xs text-neutral-500 mt-0.5">How multiple panel evaluator scores combine</p>
                                                    </div>
                                                    <select
                                                        value={rubricPanelAggregation}
                                                        onChange={e => setRubricPanelAggregation(e.target.value as 'average' | 'sum')}
                                                        className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium"
                                                    >
                                                        <option value="average">Average of E1 & E2 (default)</option>
                                                        <option value="sum">Sum of E1 & E2</option>
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <textarea
                                                    value={eventForm.rubricParams}
                                                    onChange={(e) => setEventForm(prev => ({ ...prev, rubricParams: e.target.value }))}
                                                    rows={8}
                                                    placeholder={`{\n  "maxMarks": 30,\n  "sections": []\n}`}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1">Advanced: raw JSON. Switch to Builder for a visual editor.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                        <Settings className="w-4 h-4 text-indigo-500" /> Admin Password
                                    </label>
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        placeholder="Required to authorize this action"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => { setShowCreateEvent(false); setEditingEvent(null); setAdminPassword(''); setRubricSections([]); setRubricPanelAggregation('average'); setParticipatingBatches([]); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button onClick={async () => {
                                    try {
                                        if (!eventForm.endDate || !adminPassword) {
                                            alert('Please fill in deadline and admin password.');
                                            return;
                                        }

                                        if (eventForm.type === 'group_formation_project_proposal' && participatingBatches.length === 0) {
                                            alert('Select at least one participating batch before creating the Group Formation event.');
                                            return;
                                        }

                                        // Business Logic: Block Mid-Term until Group Formation ends
                                        if (eventForm.type === 'mid_term_evaluation') {
                                            const hasOngoingGroupFormation = events.some(ev =>
                                                ev.type === 'group_formation_project_proposal' &&
                                                (ev.batchYear === eventForm.batchYear || !ev.batchYear || !eventForm.batchYear) &&
                                                new Date(ev.extensionDate || ev.endDate) > new Date()
                                            );
                                            if (hasOngoingGroupFormation) {
                                                alert('Action Restricted: Cannot schedule Mid-Term Evaluation until the Group Formation phase has officially ended for the selected batch.');
                                                return;
                                            }
                                        }

                                        // Build rubricParams from builder or JSON textarea
                                        let parsedRubricParams = null;
                                        const isEvalType = eventForm.type === 'mid_term_evaluation' || eventForm.type === 'end_term_evaluation';
                                        if (isEvalType) {
                                            if (rubricMode === 'builder' && rubricSections.length > 0) {
                                                parsedRubricParams = {
                                                    maxMarks: rubricSections.reduce((sum: number, s: any) =>
                                                        sum + s.fields.reduce((fs: number, f: any) => fs + (Number(f.max) || 0), 0), 0),
                                                    panelAggregation: rubricPanelAggregation,
                                                    sections: rubricSections.map((s: any) => ({
                                                        title: s.title,
                                                        key: s.key,
                                                        maxMarks: s.fields.reduce((fs: number, f: any) => fs + (Number(f.max) || 0), 0),
                                                        fields: s.fields.map((f: any) => ({ key: f.key, label: f.label, max: Number(f.max) || 0 }))
                                                    }))
                                                };
                                            } else if (rubricMode === 'json' && eventForm.rubricParams.trim()) {
                                                try {
                                                    parsedRubricParams = JSON.parse(eventForm.rubricParams);
                                                } catch (err) {
                                                    alert("Invalid JSON in Rubric Configuration. Please fix it or switch to Builder.");
                                                    return;
                                                }
                                            }
                                        }

                                        const payload: any = {
                                            ...eventForm,
                                            password: adminPassword,
                                            extensionDate: eventForm.extensionDate || null,
                                            batchYear: eventForm.batchYear || undefined,
                                            rubricParams: parsedRubricParams
                                        };
                                        if (eventForm.type === 'group_formation_project_proposal') {
                                            payload.participatingBatches = participatingBatches;
                                        }
                                        if (editingEvent) {
                                            await api.put(`/events/${editingEvent._id}`, payload);
                                        } else {
                                            await api.post('/events', payload);
                                        }
                                        setShowCreateEvent(false);
                                        setEditingEvent(null);
                                        setAdminPassword('');
                                        setParticipatingBatches([]);
                                        const res = await api.get('/events');
                                        setEvents(Array.isArray(res.data) ? res.data : []);
                                    } catch (e: any) {
                                        alert(e.response?.data?.message || 'Failed to save event');
                                    }
                                }} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-md flex items-center gap-2">
                                    <Save className="w-4 h-4" /> {editingEvent ? 'Save Changes' : 'Create Event'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
                {/* End Event Confirmation */}
                {confirmEndEvent && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 bg-amber-100 text-amber-600">
                                    <Power className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">End Event Early?</h3>
                                <p className="text-sm text-neutral-600 mb-4">
                                    You are about to force end <strong className="text-neutral-900">{confirmEndEvent.type.replace(/_/g, ' ').toUpperCase()}</strong>.
                                </p>
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                                    <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-800">Status Change</h4>
                                            <p className="text-xs text-amber-700 mt-1">This will set the deadline to right now, effectively expiring the event for all users immediately.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                        <Settings className="w-4 h-4 text-indigo-500" /> Admin Password
                                    </label>
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        placeholder="Required to authorize this action"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => { setConfirmEndEvent(null); setAdminPassword(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button
                                    onClick={async () => {
                                        try {
                                            if (!adminPassword) { alert('Admin password is required.'); return; }

                                            // Expire event by setting endDate to now
                                            const payload = {
                                                type: confirmEndEvent.type,
                                                endDate: new Date().toISOString(),
                                                batchYear: confirmEndEvent.batchYear,
                                                password: adminPassword
                                            };

                                            await api.put(`/events/${confirmEndEvent._id}`, payload);
                                            setConfirmEndEvent(null);
                                            setAdminPassword('');
                                            const res = await api.get('/events');
                                            setEvents(Array.isArray(res.data) ? res.data : []);
                                        } catch (e: any) {
                                            alert(e.response?.data?.message || 'Failed to end event');
                                        }
                                    }}
                                    className="px-6 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition shadow-md flex items-center gap-2"
                                >
                                    <Power className="w-4 h-4" /> End Event Now
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Delete Event Confirmation (Final Cleanup) */}
                {confirmDeleteEvent && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 bg-red-100 text-red-600">
                                    <Trash2 className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Event Permanently?</h3>
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4 text-xs text-red-700 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    This will delete all traces of this event from the system. This cannot be undone.
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                        <Settings className="w-4 h-4 text-indigo-500" /> Admin Password
                                    </label>
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        placeholder="Authorize deletion"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => { setConfirmDeleteEvent(null); setAdminPassword(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button
                                    onClick={async () => {
                                        try {
                                            if (!adminPassword) { alert('Admin password is required.'); return; }
                                            await api.delete(`/events/${confirmDeleteEvent._id}`, { data: { password: adminPassword } });
                                            setConfirmDeleteEvent(null);
                                            setAdminPassword('');
                                            const res = await api.get('/events');
                                            setEvents(Array.isArray(res.data) ? res.data : []);
                                        } catch (e: any) {
                                            alert(e.response?.data?.message || 'Failed to delete event');
                                        }
                                    }}
                                    className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition shadow-md"
                                >
                                    Delete Permanently
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {showCreateAdmin && (
                    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-default">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-indigo-50/50">
                                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-600" /> Create Admin Account
                                </h3>
                                <button onClick={() => setShowCreateAdmin(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-neutral-700 mb-1.5">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={adminForm.name}
                                        onChange={(e) => setAdminForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Admin Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-neutral-700 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={adminForm.email}
                                        onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-neutral-700 mb-1.5">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={adminForm.password}
                                        onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Secure password"
                                    />
                                </div>
                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateAdmin(false)}
                                        className="px-5 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                                    >
                                        Create Admin
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showCreateUser && (
                    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-default">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-indigo-50/50">
                                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-600" /> Create Account
                                </h3>
                                <button onClick={() => { setShowCreateUser(false); setCreateUserError(null); setCreateUserSuccess(null); }} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                {createUserSuccess ? (
                                    <div className="space-y-4">
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">{createUserSuccess}</div>
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => { setCreateUserSuccess(null); setCreateUserForm({ name: '', email: '', role: 'Student', rollNumber: '', branch: 'CSE', semester: '', department: 'CSE', expertise: '' }); }} className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">Create Another</button>
                                            <button onClick={() => { setShowCreateUser(false); setCreateUserSuccess(null); }} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">Done</button>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        setCreateUserError(null);
                                        try {
                                            const res = await api.post('/admin/create-user', createUserForm);
                                            setCreateUserSuccess(`Account created for ${res.data.user.name} (${res.data.user.email}). ${createUserForm.role === 'Student' ? 'They must activate via OTP on first login.' : 'Faculty account is immediately active.'}`);
                                        } catch (err: any) {
                                            setCreateUserError(err.response?.data?.message || 'Failed to create account.');
                                        }
                                    }} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 mb-1.5">Role</label>
                                            <select value={createUserForm.role} onChange={e => setCreateUserForm(p => ({ ...p, role: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm">
                                                <option value="Student">Student</option>
                                                <option value="Faculty">Faculty</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 mb-1.5">Full Name</label>
                                            <input required type="text" value={createUserForm.name} onChange={e => setCreateUserForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="Full name" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 mb-1.5">Email</label>
                                            <input required type="email" value={createUserForm.email} onChange={e => setCreateUserForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="user@iiitnr.edu.in" />
                                        </div>
                                        {createUserForm.role === 'Student' && (<>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-sm font-bold text-neutral-700 mb-1.5">Roll Number</label>
                                                    <input required type="text" value={createUserForm.rollNumber} onChange={e => setCreateUserForm(p => ({ ...p, rollNumber: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="24100XXXX" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-neutral-700 mb-1.5">Semester</label>
                                                    <select value={createUserForm.semester} onChange={e => setCreateUserForm(p => ({ ...p, semester: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm">
                                                        <option value="">—</option>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 mb-1.5">Branch</label>
                                                <select value={createUserForm.branch} onChange={e => setCreateUserForm(p => ({ ...p, branch: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm">
                                                    <option value="CSE">CSE</option>
                                                    <option value="ECE">ECE</option>
                                                    <option value="DSAI">DSAI</option>
                                                </select>
                                            </div>
                                        </>)}
                                        {createUserForm.role === 'Faculty' && (<>
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 mb-1.5">Department</label>
                                                <input type="text" value={createUserForm.department} onChange={e => setCreateUserForm(p => ({ ...p, department: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="CSE" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 mb-1.5">Expertise <span className="font-normal text-neutral-400">(optional)</span></label>
                                                <input type="text" value={createUserForm.expertise} onChange={e => setCreateUserForm(p => ({ ...p, expertise: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="Machine Learning, NLP..." />
                                            </div>
                                        </>)}
                                        {createUserError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{createUserError}</p>}
                                        <p className="text-xs text-neutral-400">Default password: <strong>changeme</strong>. {createUserForm.role === 'Student' ? 'Student must activate via OTP on first login.' : 'Faculty account is immediately active.'}</p>
                                        <div className="pt-2 flex justify-end gap-3">
                                            <button type="button" onClick={() => { setShowCreateUser(false); setCreateUserError(null); }} className="px-5 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
                                            <button type="submit" className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm">Create Account</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Full Excel Import Modal */}
                {showExcelImportModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-indigo-600" /> Full Excel Import
                                </h3>
                                <button onClick={() => { setShowExcelImportModal(false); setExcelImportFile(null); setExcelImportSemester(''); setExcelImportPreview(null); setExcelImportPreviewError(null); }}
                                    className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 space-y-5">
                                {!excelImportPreview ? (
                                    <>
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 space-y-1">
                                            <p><strong>Instructions:</strong> Upload the IIITNR Excel sheet with groups and projects.</p>
                                            <p>Select the correct semester so dropper students (mismatched roll prefix) are assigned the right batch.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 mb-1.5">Semester <span className="text-red-500">*</span></label>
                                                <select value={excelImportSemester} onChange={e => setExcelImportSemester(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                                    <option value="">Select semester…</option>
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 mb-1.5">Excel File <span className="text-red-500">*</span></label>
                                                <label className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-sm font-medium text-neutral-700">
                                                    <Upload className="w-4 h-4 flex-shrink-0" />
                                                    <span className="truncate">{excelImportFile ? excelImportFile.name : 'Choose .xlsx file'}</span>
                                                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { setExcelImportFile(e.target.files?.[0] || null); setExcelImportPreviewError(null); }} />
                                                </label>
                                            </div>
                                        </div>
                                        {!excelImportSemester && excelImportFile && (
                                            <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Select a semester before previewing.
                                            </p>
                                        )}
                                        {excelImportPreviewError && (
                                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-red-700">{excelImportPreviewError}</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Stat cards */}
                                        <div className="grid grid-cols-5 gap-2">
                                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-indigo-700">{excelImportPreview.summary.totalGroups}</p>
                                                <p className="text-xs font-bold text-indigo-500 mt-0.5">Groups</p>
                                            </div>
                                            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-green-700">{excelImportPreview.summary.newStudents}</p>
                                                <p className="text-xs font-bold text-green-500 mt-0.5">New Students</p>
                                            </div>
                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-amber-700">{excelImportPreview.summary.existingStudents}</p>
                                                <p className="text-xs font-bold text-amber-500 mt-0.5">Existing</p>
                                            </div>
                                            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-violet-700">{excelImportPreview.summary.newFaculty}</p>
                                                <p className="text-xs font-bold text-violet-500 mt-0.5">New Faculty</p>
                                            </div>
                                            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-orange-700">{excelImportPreview.summary.droppers ?? 0}</p>
                                                <p className="text-xs font-bold text-orange-500 mt-0.5">Droppers</p>
                                            </div>
                                        </div>
                                        {/* Tab bar */}
                                        <div className="flex border-b border-neutral-200 gap-1 -mx-6 px-6">
                                            <button onClick={() => setExcelImportPreviewTab('students')}
                                                className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportPreviewTab === 'students' ? 'border-green-500 text-green-700 bg-green-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                                New Students
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportPreviewTab === 'students' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>{excelImportPreview.summary.newStudents}</span>
                                            </button>
                                            <button onClick={() => setExcelImportPreviewTab('faculty')}
                                                className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportPreviewTab === 'faculty' ? 'border-violet-500 text-violet-700 bg-violet-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                                New Faculty
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportPreviewTab === 'faculty' ? 'bg-violet-100 text-violet-700' : 'bg-neutral-100 text-neutral-500'}`}>{excelImportPreview.summary.newFaculty}</span>
                                            </button>
                                            <button onClick={() => setExcelImportPreviewTab('groups')}
                                                className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportPreviewTab === 'groups' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                                Groups
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportPreviewTab === 'groups' ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500'}`}>{excelImportPreview.summary.totalGroups}</span>
                                            </button>
                                            <button onClick={() => setExcelImportPreviewTab('warnings')}
                                                className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportPreviewTab === 'warnings' ? 'border-amber-500 text-amber-700 bg-amber-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                                Warnings
                                                {(() => {
                                                    let c = 0;
                                                    for (const g of excelImportPreview.groups) {
                                                        if (g.faculty.status === 'none') c++;
                                                        for (const s of g.students) { if (s.inGroup || !s.roll || s.missingEmail || s.isDropper) c++; }
                                                    }
                                                    return <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportPreviewTab === 'warnings' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>{c}</span>;
                                                })()}
                                            </button>
                                        </div>
                                        {/* Tab content */}
                                        <div className="border border-neutral-200 rounded-xl overflow-hidden">
                                            {excelImportPreviewTab === 'students' && (
                                                excelImportPreview.groups.flatMap((g: any) => g.students.filter((s: any) => s.status === 'new')).length > 0 ? (
                                                    <div className="max-h-64 overflow-y-auto">
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-neutral-50 sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Name</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Roll</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Branch</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Group</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-neutral-100">
                                                                {excelImportPreview.groups.flatMap((g: any) =>
                                                                    g.students.filter((s: any) => s.status === 'new').map((s: any, si: number) => (
                                                                        <tr key={`${g.groupNumber}-${si}`} className="hover:bg-neutral-50">
                                                                            <td className="px-4 py-2 font-medium text-neutral-900">
                                                                                {s.name}
                                                                                {s.isDropper && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">DROPPER</span>}
                                                                            </td>
                                                                            <td className="px-4 py-2 font-mono text-neutral-600 text-xs">{s.roll || '—'}</td>
                                                                            <td className="px-4 py-2 text-neutral-500">{s.branch}</td>
                                                                            <td className="px-4 py-2 text-neutral-400 text-xs">#{g.groupNumber}</td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : <p className="px-4 py-8 text-center text-sm text-neutral-400">No new students — all are existing accounts.</p>
                                            )}
                                            {excelImportPreviewTab === 'faculty' && (
                                                excelImportPreview.groups.filter((g: any) => g.faculty.status === 'new').length > 0 ? (
                                                    <div className="max-h-64 overflow-y-auto">
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-neutral-50 sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Name</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Email</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Group</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-neutral-100">
                                                                {excelImportPreview.groups.filter((g: any) => g.faculty.status === 'new').map((g: any) => (
                                                                    <tr key={g.groupNumber} className="hover:bg-neutral-50">
                                                                        <td className="px-4 py-2 font-medium text-neutral-900">{g.faculty.name}</td>
                                                                        <td className="px-4 py-2 text-neutral-500 text-xs">{g.faculty.email}</td>
                                                                        <td className="px-4 py-2 text-neutral-400 text-xs">#{g.groupNumber}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : <p className="px-4 py-8 text-center text-sm text-neutral-400">No new faculty — all are existing accounts.</p>
                                            )}
                                            {excelImportPreviewTab === 'groups' && (
                                                <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
                                                    {excelImportPreview.groups.map((g: any, idx: number) => {
                                                        const hasDropper = g.students.some((s: any) => s.isDropper);
                                                        return (
                                                        <div key={idx} className={hasDropper ? 'bg-red-50/60' : ''}>
                                                            <button onClick={() => setExcelImportExpanded(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; })}
                                                                className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left ${hasDropper ? 'hover:bg-red-100/60' : 'hover:bg-neutral-50'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`text-xs font-bold w-8 ${hasDropper ? 'text-red-500' : 'text-neutral-500'}`}>#{g.groupNumber}</span>
                                                                    <span className="text-sm font-medium text-neutral-800 truncate max-w-xs">{g.projectTitle}</span>
                                                                    <span className="text-xs text-neutral-400">{g.students.length} students</span>
                                                                    {hasDropper && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">Dropper</span>}
                                                                    {g.faculty.status === 'new' && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">New Faculty</span>}
                                                                </div>
                                                                <ChevronDown className={`w-4 h-4 transition-transform ${hasDropper ? 'text-red-400' : 'text-neutral-400'} ${excelImportExpanded.has(idx) ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {excelImportExpanded.has(idx) && (
                                                                <div className={`px-4 pb-3 border-t ${hasDropper ? 'bg-red-50 border-red-100' : 'bg-neutral-50 border-neutral-100'}`}>
                                                                    <p className="text-xs text-neutral-500 mb-2 font-medium">Faculty: <span className="text-neutral-700">{g.faculty.name || '—'} {g.faculty.status === 'new' ? '(will be created)' : '(existing)'}</span></p>
                                                                    <div className="space-y-1">
                                                                        {g.students.map((s: any, si: number) => (
                                                                            <div key={si} className="flex items-center gap-2 text-xs">
                                                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isDropper ? 'bg-red-400' : s.status === 'new' ? 'bg-green-400' : 'bg-amber-400'}`} />
                                                                                <span className={`font-medium ${s.isDropper ? 'text-red-700' : 'text-neutral-700'}`}>{s.name}</span>
                                                                                <span className="text-neutral-400">{s.roll}</span>
                                                                                <span className="text-neutral-400">{s.branch}</span>
                                                                                {s.inGroup && <span className="text-amber-600 font-medium">(already in group)</span>}
                                                                                {s.isDropper && <span className="text-red-600 font-bold">DROPPER</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {excelImportPreviewTab === 'warnings' && (() => {
                                                const issues: { groupNumber: string; subject: string; issue: string; severity: 'error' | 'warning' }[] = [];
                                                const missingEmailStudents: { name: string; roll: string; branch: string }[] = [];
                                                for (const g of excelImportPreview.groups) {
                                                    if (g.faculty.status === 'none') issues.push({ groupNumber: g.groupNumber, subject: 'Faculty', issue: 'No faculty specified — will be created without a mentor', severity: 'warning' });
                                                    for (const s of g.students) {
                                                        if (s.inGroup) issues.push({ groupNumber: g.groupNumber, subject: s.name, issue: 'Already in an active group — will be skipped', severity: 'warning' });
                                                        if (!s.roll) issues.push({ groupNumber: g.groupNumber, subject: s.name, issue: 'Missing roll number', severity: 'error' });
                                                        if (s.missingEmail) {
                                                            issues.push({ groupNumber: g.groupNumber, subject: s.name, issue: 'No email — cannot create account (see fix below)', severity: 'error' });
                                                            missingEmailStudents.push({ name: s.name, roll: s.roll || '', branch: s.branch || '' });
                                                        }
                                                        if (s.isDropper) issues.push({ groupNumber: g.groupNumber, subject: s.name, issue: `Dropper — roll ${s.roll} → batch overridden to ${excelImportPreview.expectedBatch}`, severity: 'warning' });
                                                    }
                                                }
                                                return (
                                                    <div className="flex flex-col">
                                                        {missingEmailStudents.length > 0 && (
                                                            <div className="mx-4 mt-3 mb-1 rounded-xl border border-red-200 bg-red-50 p-4">
                                                                <p className="text-sm font-bold text-red-800 mb-1">{missingEmailStudents.length} student{missingEmailStudents.length !== 1 ? 's' : ''} missing email — cannot be imported</p>
                                                                <p className="text-xs text-red-600 mb-3">These students have no email in the Excel file and no existing account. Follow these steps to fix:</p>
                                                                <ol className="text-xs text-red-700 space-y-1 mb-3 list-none">
                                                                    <li className="flex gap-2"><span className="font-black bg-red-200 text-red-800 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px]">1</span><span>Download the template below — it has their name and roll pre-filled.</span></li>
                                                                    <li className="flex gap-2"><span className="font-black bg-red-200 text-red-800 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px]">2</span><span>Open the file and fill in the <strong>Email</strong> column for each student.</span></li>
                                                                    <li className="flex gap-2"><span className="font-black bg-red-200 text-red-800 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px]">3</span><span>Go to <strong>Exports → Import Students</strong> and upload that file. Their accounts will be created.</span></li>
                                                                    <li className="flex gap-2"><span className="font-black bg-red-200 text-red-800 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px]">4</span><span>Come back here and re-run this groups import — those students will now be found automatically.</span></li>
                                                                </ol>
                                                                <button
                                                                    onClick={() => {
                                                                        const header = ['Name', 'Roll Number', 'Branch', 'Email'];
                                                                        const rows = missingEmailStudents.map(s => [s.name, s.roll, s.branch, '']);
                                                                        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                                                                        const blob = new Blob([csv], { type: 'text/csv' });
                                                                        const url = URL.createObjectURL(blob);
                                                                        const a = document.createElement('a');
                                                                        a.href = url;
                                                                        a.download = 'students_missing_email.csv';
                                                                        a.click();
                                                                        URL.revokeObjectURL(url);
                                                                    }}
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg transition-colors"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                                    Download student template ({missingEmailStudents.length})
                                                                </button>
                                                            </div>
                                                        )}
                                                        {issues.length === 0
                                                            ? <p className="px-4 py-8 text-center text-sm text-neutral-400">No issues detected.</p>
                                                            : <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100 mt-2">
                                                                {issues.map((issue, i) => (
                                                                    <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                                                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${issue.severity === 'error' ? 'bg-red-100' : 'bg-amber-100'}`}>
                                                                            <AlertTriangle className={`w-3 h-3 ${issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
                                                                        </span>
                                                                        <span className="font-bold text-neutral-600 w-12 flex-shrink-0">#{issue.groupNumber}</span>
                                                                        <span className="text-neutral-500 w-32 truncate flex-shrink-0">{issue.subject}</span>
                                                                        <span className={issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>{issue.issue}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        }
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-neutral-100 flex justify-between items-center bg-neutral-50/30">
                                <button onClick={() => { if (excelImportPreview) { setExcelImportPreview(null); setExcelImportPreviewError(null); setExcelImportPreviewTab('warnings'); } else { setShowExcelImportModal(false); setExcelImportFile(null); setExcelImportSemester(''); } }}
                                    className="px-5 py-2.5 text-neutral-600 font-bold hover:bg-neutral-100 rounded-xl transition-colors text-sm">
                                    {excelImportPreview ? '← Back' : 'Cancel'}
                                </button>
                                {!excelImportPreview ? (
                                    <button
                                        disabled={!excelImportFile || !excelImportSemester || excelImportLoading}
                                        onClick={async () => {
                                            if (!excelImportFile) return;
                                            setExcelImportLoading(true);
                                            setExcelImportPreviewError(null);
                                            try {
                                                const fd = new FormData();
                                                fd.append('file', excelImportFile);
                                                fd.append('semester', excelImportSemester);
                                                const res = await api.post('/import/excel/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                setExcelImportPreview(res.data);
                                                setExcelImportExpanded(new Set());
                                            } catch (err: any) {
                                                setExcelImportPreviewError(err.response?.data?.message || 'Preview failed. Check the file format and try again.');
                                            } finally {
                                                setExcelImportLoading(false);
                                            }
                                        }}
                                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {excelImportLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing…</> : 'Preview Import'}
                                    </button>
                                ) : (() => {
                                    const blockingErrors = excelImportPreview.groups.reduce((count: number, g: any) => {
                                        return count + g.students.filter((s: any) => !s.roll || s.missingEmail).length;
                                    }, 0);
                                    return (
                                        <div className="flex items-center gap-3">
                                            {blockingErrors > 0 && (
                                                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                                    {blockingErrors} error{blockingErrors !== 1 ? 's' : ''} must be fixed — check the Warnings tab
                                                </p>
                                            )}
                                            <button
                                                disabled={excelImportLoading || blockingErrors > 0}
                                                onClick={async () => {
                                                    setExcelImportLoading(true);
                                                    try {
                                                        const res = await api.post('/import/excel/commit', {
                                                            groups: excelImportPreview.groups,
                                                            semester: parseInt(excelImportSemester) || 0
                                                        });
                                                        setExcelImportResult({ created: res.data.created, errors: res.data.errors || [] });
                                                        setExcelImportPreview(null);
                                                        setShowExcelImportModal(false);
                                                        setExcelImportFile(null);
                                                        setExcelImportSemester('');
                                                    } catch (err: any) {
                                                        setExcelImportResult({ created: {}, errors: [{ groupNumber: '—', reason: err.response?.data?.message || 'Server error' }] });
                                                        setShowExcelImportModal(false);
                                                    } finally {
                                                        setExcelImportLoading(false);
                                                    }
                                                }}
                                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                                            >
                                                {excelImportLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</> : <><Save className="w-4 h-4" />Confirm & Import</>}
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Excel Import Result Modal */}
                {excelImportResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
                        onClick={() => { setExcelImportResult(null); setExcelImportResultTab('students'); setExcelImportFile(null); setExcelImportSemester(''); }}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-green-50/60">
                                <div>
                                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" /> Import Complete
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        {excelImportResult.created.students ?? 0} students · {excelImportResult.created.faculty ?? 0} faculty · {excelImportResult.created.groups ?? 0} groups created
                                        {(excelImportResult.created.skipped ?? 0) > 0 && ` · ${excelImportResult.created.skipped} skipped`}
                                    </p>
                                </div>
                                <button onClick={() => { setExcelImportResult(null); setExcelImportResultTab('students'); setExcelImportFile(null); setExcelImportSemester(''); }}
                                    className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            {/* Tab bar */}
                            <div className="flex border-b border-neutral-200 px-4 pt-2 gap-1">
                                <button onClick={() => setExcelImportResultTab('students')}
                                    className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportResultTab === 'students' ? 'border-green-500 text-green-700 bg-green-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                    New Students
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportResultTab === 'students' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>{excelImportResult.created.students ?? 0}</span>
                                </button>
                                <button onClick={() => setExcelImportResultTab('faculty')}
                                    className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportResultTab === 'faculty' ? 'border-violet-500 text-violet-700 bg-violet-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                    New Faculty
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportResultTab === 'faculty' ? 'bg-violet-100 text-violet-700' : 'bg-neutral-100 text-neutral-500'}`}>{excelImportResult.created.faculty ?? 0}</span>
                                </button>
                                <button onClick={() => setExcelImportResultTab('groups')}
                                    className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportResultTab === 'groups' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                    Groups
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportResultTab === 'groups' ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500'}`}>{excelImportResult.created.groups ?? 0}</span>
                                </button>
                                <button onClick={() => setExcelImportResultTab('errors')}
                                    className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${excelImportResultTab === 'errors' ? 'border-red-500 text-red-700 bg-red-50' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                    Warnings
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${excelImportResultTab === 'errors' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                        {(excelImportResult.created.studentList?.length ?? 0) + (excelImportResult.created.facultyList?.length ?? 0) + (excelImportResult.errors?.length ?? 0)}
                                    </span>
                                </button>
                            </div>
                            {/* Tab content */}
                            <div className="flex-1 overflow-y-auto">
                                {excelImportResultTab === 'students' && (
                                    excelImportResult.created.studentList?.length > 0 ? (
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-neutral-50 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Name</th>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Roll No</th>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Branch</th>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Email</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {excelImportResult.created.studentList.map((s: any, i: number) => (
                                                    <tr key={i} className="hover:bg-neutral-50">
                                                        <td className="px-4 py-2.5 font-medium text-neutral-900">
                                                            {s.name}
                                                            {s.isDropper && <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">DROPPER</span>}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-neutral-600 text-xs">{s.roll || '—'}</td>
                                                        <td className="px-4 py-2.5 text-neutral-500">{s.branch}</td>
                                                        <td className="px-4 py-2.5 text-neutral-400 text-xs">{s.email}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="px-4 py-10 text-center text-sm text-neutral-400">No new students were created.</p>
                                    )
                                )}
                                {excelImportResultTab === 'faculty' && (
                                    excelImportResult.created.facultyList?.length > 0 ? (
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-neutral-50 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Name</th>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Email</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {excelImportResult.created.facultyList.map((f: any, i: number) => (
                                                    <tr key={i} className="hover:bg-neutral-50">
                                                        <td className="px-4 py-2.5 font-medium text-neutral-900">{f.name}</td>
                                                        <td className="px-4 py-2.5 text-neutral-500">{f.email}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="px-4 py-10 text-center text-sm text-neutral-400">No new faculty were created.</p>
                                    )
                                )}
                                {excelImportResultTab === 'groups' && (
                                    excelImportResult.created.groupList?.length > 0 ? (
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-neutral-50 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Group #</th>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Project Title</th>
                                                    <th className="px-4 py-2.5 font-bold text-neutral-500 text-xs uppercase tracking-wider">Members</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {excelImportResult.created.groupList.map((g: any, i: number) => (
                                                    <tr key={i} className="hover:bg-neutral-50">
                                                        <td className="px-4 py-2.5 font-bold text-neutral-700">#{g.groupNumber}</td>
                                                        <td className="px-4 py-2.5 text-neutral-800">{g.projectTitle}</td>
                                                        <td className="px-4 py-2.5 text-neutral-500">{g.memberCount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="px-4 py-10 text-center text-sm text-neutral-400">No groups were created.</p>
                                    )
                                )}
                                {excelImportResultTab === 'errors' && (
                                    <div className="divide-y divide-neutral-100">
                                        {(excelImportResult.created.studentList?.length ?? 0) > 0 && (
                                            <>
                                                <div className="px-4 py-2 bg-green-50 text-xs font-bold text-green-700 uppercase tracking-wider">
                                                    Students Created ({excelImportResult.created.studentList.length})
                                                </div>
                                                {excelImportResult.created.studentList.map((s: any, i: number) => (
                                                    <div key={`s-${i}`} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-green-50/40">
                                                        <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                                            <CheckCircle className="w-3 h-3 text-green-600" />
                                                        </span>
                                                        <span className="font-medium text-neutral-900 w-40 truncate">{s.name}</span>
                                                        <span className="font-mono text-neutral-500 text-xs w-24">{s.roll || '—'}</span>
                                                        <span className="text-neutral-400 text-xs">{s.email}</span>
                                                        {s.isDropper && <span className="ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold flex-shrink-0">DROPPER</span>}
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        {(excelImportResult.created.facultyList?.length ?? 0) > 0 && (
                                            <>
                                                <div className="px-4 py-2 bg-violet-50 text-xs font-bold text-violet-700 uppercase tracking-wider">
                                                    Faculty Created ({excelImportResult.created.facultyList.length})
                                                </div>
                                                {excelImportResult.created.facultyList.map((f: any, i: number) => (
                                                    <div key={`f-${i}`} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-violet-50/40">
                                                        <span className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                                                            <CheckCircle className="w-3 h-3 text-violet-600" />
                                                        </span>
                                                        <span className="font-medium text-neutral-900 w-40 truncate">{f.name}</span>
                                                        <span className="text-neutral-400 text-xs">{f.email}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        {(excelImportResult.errors?.length ?? 0) > 0 && (
                                            <>
                                                <div className="px-4 py-2 bg-red-50 text-xs font-bold text-red-700 uppercase tracking-wider">
                                                    Errors ({excelImportResult.errors.length})
                                                </div>
                                                {excelImportResult.errors.map((e, i) => (
                                                    <div key={`e-${i}`} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-red-50/40">
                                                        <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                            <AlertTriangle className="w-3 h-3 text-red-600" />
                                                        </span>
                                                        <span className="font-bold text-neutral-700 w-16 flex-shrink-0">#{e.groupNumber}</span>
                                                        <span className="text-neutral-500 w-32 truncate flex-shrink-0">{e.student || '—'}</span>
                                                        <span className="text-red-600">{e.reason}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        {(excelImportResult.created.studentList?.length ?? 0) === 0 &&
                                         (excelImportResult.created.facultyList?.length ?? 0) === 0 &&
                                         (excelImportResult.errors?.length ?? 0) === 0 && (
                                            <p className="px-4 py-10 text-center text-sm text-neutral-400">Nothing to report.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end bg-neutral-50/30">
                                <button onClick={() => { setExcelImportResult(null); setExcelImportResultTab('students'); setExcelImportFile(null); setExcelImportSemester(''); }}
                                    className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-colors">Done</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* ── Snapshot Import Modal ─────────────────────────────── */}
                {showSnapshotImportModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-violet-600" />
                                    Snapshot Import
                                </h3>
                                <button onClick={() => { setShowSnapshotImportModal(false); setSnapshotImportFile(null); setSnapshotImportPreview(null); setSnapshotData(null); setSnapshotImportPreviewError(null); setSnapshotImportPreviewTab('projects'); }}
                                    className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto">
                                {!snapshotImportPreview ? (
                                    /* Stage 1: file picker */
                                    <div className="p-6 space-y-4">
                                        <p className="text-sm text-neutral-500">Choose a snapshot JSON file exported from this portal to preview what will be restored.</p>
                                        <label className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl cursor-pointer hover:bg-violet-50 hover:border-violet-300 transition-colors text-sm font-medium text-neutral-600">
                                            <Upload className="w-5 h-5 text-violet-500 flex-shrink-0" />
                                            <span className="truncate">{snapshotImportFile ? snapshotImportFile.name : 'Choose snapshot .json file'}</span>
                                            <input type="file" accept=".json" className="hidden" onChange={e => {
                                                const f = e.target.files?.[0] || null;
                                                setSnapshotImportFile(f);
                                                setSnapshotImportPreview(null);
                                                setSnapshotData(null);
                                                setSnapshotImportPreviewError(null);
                                            }} />
                                        </label>
                                        {snapshotImportPreviewError && (
                                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-red-700">{snapshotImportPreviewError}</p>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                            <AlertTriangle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-indigo-800">Snapshots contain only <strong>archived projects and their evaluations</strong> (mentor name, group name, batch, members, marks). Users, groups, and panels are not imported.</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* Stage 2: preview with tabs */
                                    <>
                                        {/* Stat cards */}
                                        <div className="px-6 pt-5 pb-3 grid grid-cols-3 gap-2">
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-blue-700">{snapshotImportPreview.summary.projects.create}</p>
                                                <p className="text-xs font-bold text-blue-500 mt-0.5">New Projects</p>
                                            </div>
                                            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-neutral-500">{snapshotImportPreview.summary.projects.skip}</p>
                                                <p className="text-xs font-bold text-neutral-400 mt-0.5">Skipped (exists)</p>
                                            </div>
                                            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
                                                <p className="text-2xl font-black text-violet-700">{snapshotImportPreview.summary.projects.total}</p>
                                                <p className="text-xs font-bold text-violet-500 mt-0.5">Total</p>
                                            </div>
                                        </div>

                                        {/* Tab bar */}
                                        <div className="px-6 border-b border-neutral-100 flex gap-0">
                                            {([
                                                { key: 'projects', label: 'Projects', count: snapshotImportPreview.summary.projects.create, active: 'border-blue-500 text-blue-700 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
                                                { key: 'warnings', label: 'Warnings', count: snapshotImportPreview.summary.projects.skip,   active: 'border-amber-500 text-amber-700 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
                                            ] as const).map(tab => (
                                                <button key={tab.key} onClick={() => setSnapshotImportPreviewTab(tab.key as any)}
                                                    className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${snapshotImportPreviewTab === tab.key ? tab.active : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                                    {tab.label}
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${snapshotImportPreviewTab === tab.key ? tab.badge : 'bg-neutral-100 text-neutral-500'}`}>{tab.count}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Tab content */}
                                        <div className="min-h-[180px]">
                                            {snapshotImportPreviewTab === 'projects' && (
                                                snapshotImportPreview.projects.filter((p: any) => p.status === 'create').length > 0 ? (
                                                    <div className="max-h-72 overflow-y-auto">
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-neutral-50 sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Project</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Mentor</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase">Group / Batch</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase text-center">Members</th>
                                                                    <th className="px-4 py-2 font-bold text-neutral-500 text-xs uppercase text-center">Evals</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-neutral-100">
                                                                {snapshotImportPreview.projects.filter((p: any) => p.status === 'create').map((p: any, i: number) => (
                                                                    <tr key={i} className="hover:bg-neutral-50">
                                                                        <td className="px-4 py-2 font-medium text-neutral-900">{p.title}</td>
                                                                        <td className="px-4 py-2 text-neutral-600 text-xs">{p.archivedMentorName || '—'}</td>
                                                                        <td className="px-4 py-2 text-neutral-500 text-xs">
                                                                            {p.archivedGroupName || '—'}
                                                                            {p.archivedBatch && <span className="ml-1 text-neutral-400">({p.archivedBatch})</span>}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center text-xs text-neutral-600">{p.memberCount}</td>
                                                                        <td className="px-4 py-2 text-center text-xs">
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                {p.hasMidTerm && <span className="px-1 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">M</span>}
                                                                                {p.hasEndTerm && <span className="px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">E</span>}
                                                                                {p.hasFinal && <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700 text-[9px] font-bold">F</span>}
                                                                                {!p.hasMidTerm && !p.hasEndTerm && !p.hasFinal && <span className="text-neutral-300">—</span>}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : <p className="px-4 py-10 text-center text-sm text-neutral-400">No new projects — all titles already exist in this DB.</p>
                                            )}
                                            {snapshotImportPreviewTab === 'warnings' && (() => {
                                                const skipped = snapshotImportPreview.projects.filter((p: any) => p.status === 'skip');
                                                return skipped.length === 0
                                                    ? <p className="px-4 py-10 text-center text-sm text-neutral-400">No skipped items — every project is new.</p>
                                                    : (
                                                        <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100">
                                                            {skipped.map((s: any, i: number) => (
                                                                <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                                                                    <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                                    </span>
                                                                    <span className="text-xs font-bold text-neutral-400 w-16 flex-shrink-0">Project</span>
                                                                    <span className="text-neutral-600 truncate">{s.title}</span>
                                                                    <span className="ml-auto text-xs text-amber-600 font-medium flex-shrink-0">title already exists</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                            })()}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-neutral-100 flex justify-between items-center bg-neutral-50/30">
                                <button onClick={() => {
                                    if (snapshotImportPreview) { setSnapshotImportPreview(null); setSnapshotData(null); setSnapshotImportPreviewTab('projects'); }
                                    else { setShowSnapshotImportModal(false); setSnapshotImportFile(null); setSnapshotImportPreviewError(null); }
                                }} className="px-5 py-2.5 text-neutral-600 font-bold hover:bg-neutral-100 rounded-xl transition-colors text-sm">
                                    {snapshotImportPreview ? '← Back' : 'Cancel'}
                                </button>
                                {!snapshotImportPreview ? (
                                    <button
                                        disabled={!snapshotImportFile || snapshotImportLoading}
                                        onClick={async () => {
                                            if (!snapshotImportFile) return;
                                            setSnapshotImportLoading(true);
                                            setSnapshotImportPreviewError(null);
                                            try {
                                                const text = await snapshotImportFile.text();
                                                let json: any;
                                                try { json = JSON.parse(text); }
                                                catch { throw new Error('File is not valid JSON.'); }
                                                setSnapshotData(json);
                                                const res = await api.post('/import/snapshot/preview', json);
                                                setSnapshotImportPreview(res.data);
                                                setSnapshotImportPreviewTab('projects');
                                            } catch (err: any) {
                                                setSnapshotImportPreviewError(err.response?.data?.message || err.message || 'Invalid snapshot file.');
                                            } finally {
                                                setSnapshotImportLoading(false);
                                            }
                                        }}
                                        className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {snapshotImportLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing…</> : 'Preview Import'}
                                    </button>
                                ) : (
                                    <button
                                        disabled={snapshotImportLoading}
                                        onClick={async () => {
                                            setSnapshotImportLoading(true);
                                            try {
                                                const res = await api.post('/import/snapshot/commit', snapshotData);
                                                setSnapshotImportResult({ result: res.data.result, errors: res.data.errors || [] });
                                                setSnapshotImportPreview(null);
                                                setSnapshotData(null);
                                                setShowSnapshotImportModal(false);
                                                setSnapshotImportFile(null);
                                                setSnapshotImportPreviewTab('projects');
                                                setSnapshotImportResultTab('warnings');
                                            } catch (err: any) {
                                                setSnapshotImportResult({ result: {}, errors: [{ type: 'request', key: '—', reason: err.response?.data?.message || 'Server error' }] });
                                                setShowSnapshotImportModal(false);
                                            } finally {
                                                setSnapshotImportLoading(false);
                                            }
                                        }}
                                        className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {snapshotImportLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</> : <><Save className="w-4 h-4" />Restore Snapshot</>}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* ── Snapshot Import Result Modal ──────────────────────── */}
                {snapshotImportResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-500" /> Snapshot Imported
                                </h3>
                                <button onClick={() => { setSnapshotImportResult(null); setSnapshotImportFile(null); }} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            {/* Stat cards */}
                            <div className="px-6 pt-5 pb-3 grid grid-cols-2 gap-2">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-blue-700">{snapshotImportResult.result.projects ?? 0}</p>
                                    <p className="text-xs font-bold text-blue-500 mt-0.5">Projects Imported</p>
                                </div>
                                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-neutral-500">{snapshotImportResult.result.skipped ?? 0}</p>
                                    <p className="text-xs font-bold text-neutral-400 mt-0.5">Skipped</p>
                                </div>
                            </div>

                            {/* Tab bar */}
                            <div className="px-6 border-b border-neutral-100 flex gap-0">
                                {([
                                    { key: 'warnings', label: 'Warnings', count: snapshotImportResult.errors.length, active: 'border-amber-500 text-amber-700 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
                                ] as const).map(tab => (
                                    <button key={tab.key} onClick={() => setSnapshotImportResultTab(tab.key as any)}
                                        className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${snapshotImportResultTab === tab.key ? tab.active : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
                                        {tab.label}
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${snapshotImportResultTab === tab.key ? tab.badge : 'bg-neutral-100 text-neutral-500'}`}>{tab.count}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Tab content */}
                            <div className="flex-1 overflow-y-auto min-h-[120px]">
                                {snapshotImportResult.errors.length === 0
                                    ? <p className="px-4 py-10 text-center text-sm text-neutral-400">No errors — import completed cleanly.</p>
                                    : (
                                        <div className="divide-y divide-neutral-100">
                                            {snapshotImportResult.errors.map((e, i) => (
                                                <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                                                    <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                        <AlertTriangle className="w-3 h-3 text-red-600" />
                                                    </span>
                                                    <span className="text-xs font-bold text-neutral-400 w-16 capitalize flex-shrink-0">{e.type}</span>
                                                    <span className="text-neutral-500 w-40 truncate flex-shrink-0">{e.key}</span>
                                                    <span className="text-red-600 text-xs">{e.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end bg-neutral-50/30">
                                <button onClick={() => { setSnapshotImportResult(null); setSnapshotImportFile(null); }}
                                    className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-colors">Done</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Smart Import Modal */}
                {showImportModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-indigo-600" />
                                    Smart Import - {smartImportTarget === 'student' ? 'Students' : 'Faculty'}
                                </h3>
                                <button onClick={() => setShowImportModal(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 bg-neutral-50/30">
                                {!importPreview ? (
                                    <div className="max-w-xl mx-auto space-y-6">
                                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-sm text-indigo-800 space-y-1.5">
                                            <p><strong>Instructions:</strong> Upload an Excel (.xlsx, .xls) or CSV file.</p>
                                            <p>Required columns for <b>Students</b>: Name (or FullName), Email, RollNumber. (Optional: Branch, Semester)</p>
                                            <p>Required columns for <b>Faculty</b>: Name (or FullName), Email, Department. (Optional: Expertise)</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 space-y-1">
                                            <p className="font-semibold">Recommended import order</p>
                                            <p><span className="font-medium">Step 1 — Faculty CSV:</span> Register faculty accounts.</p>
                                            <p><span className="font-medium">Step 2 — Student CSV:</span> Register student accounts so they can receive activation OTPs.</p>
                                            <p><span className="font-medium">Step 3 — Full Excel Import:</span> Import the IIITNR sheet to create groups and projects; users are matched by email / roll number.</p>
                                            <p className="text-xs text-amber-700 mt-1">All imported users start with password <strong>changeme</strong>. Students must activate via OTP; faculty can sign in immediately and are forced to change the password on first login.</p>
                                        </div>

                                        <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-10 text-center hover:bg-indigo-50 hover:border-indigo-300 transition-colors w-full cursor-pointer relative">
                                            <input
                                                type="file"
                                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setImportFile(file);
                                                        setImportLoading(true);
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        formData.append('importType', smartImportTarget || 'student');

                                                        try {
                                                            const res = await api.post('/users/import-preview', formData, {
                                                                headers: { 'Content-Type': 'multipart/form-data' }
                                                            });
                                                            setImportPreview(res.data);
                                                        } catch (error: any) {
                                                            alert(error.response?.data?.message || 'Error processing file.');
                                                            setImportFile(null);
                                                        } finally {
                                                            setImportLoading(false);
                                                        }
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={importLoading}
                                            />
                                            {importLoading ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                                    <p className="font-bold text-neutral-600">Analyzing {importFile?.name || 'Data'}...</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 bg-white rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2 shadow-sm border border-indigo-100">
                                                        <FileText className="w-8 h-8" />
                                                    </div>
                                                    <p className="font-bold text-neutral-700 text-lg">Click or drag file to upload</p>
                                                    <p className="text-sm text-neutral-500">Supports .CSV, .XLSX, .XLS up to 10MB</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-neutral-500 font-bold mb-1 uppercase tracking-wider">Total Rows</p>
                                                    <p className="text-2xl font-black text-neutral-800">{importPreview.totalRows}</p>
                                                </div>
                                                <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500"><FileText className="w-5 h-5" /></div>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-green-600 font-bold mb-1 uppercase tracking-wider">Ready to Import</p>
                                                    <p className="text-2xl font-black text-green-700">{importPreview.validRows.length}</p>
                                                </div>
                                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600"><CheckCircle className="w-5 h-5" /></div>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-red-600 font-bold mb-1 uppercase tracking-wider">Invalid Rows</p>
                                                    <p className="text-2xl font-black text-red-700">{importPreview.invalidRows.length}</p>
                                                </div>
                                                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><AlertCircle className="w-5 h-5" /></div>
                                            </div>
                                        </div>

                                        {importPreview.invalidRows.length > 0 && (
                                            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                                                <div className="bg-red-50 px-4 py-3 border-b border-red-100">
                                                    <h4 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Validation Errors</h4>
                                                    <p className="text-xs text-red-600 mt-1">These rows will be skipped during import.</p>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-neutral-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-2 font-bold text-neutral-500">Row</th>
                                                                <th className="px-4 py-2 font-bold text-neutral-500">Reason</th>
                                                                <th className="px-4 py-2 font-bold text-neutral-500">Data Extract</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-neutral-100">
                                                            {importPreview.invalidRows.map((invalid: any, idx: number) => (
                                                                <tr key={idx} className="bg-white">
                                                                    <td className="px-4 py-2 font-bold text-neutral-600 w-16">#{invalid.rowNumber}</td>
                                                                    <td className="px-4 py-2 text-red-600 font-medium">{invalid.reason}</td>
                                                                    <td className="px-4 py-2 text-neutral-500 font-mono text-xs">{JSON.stringify(invalid.data).substring(0, 100)}...</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
                                            <div className="bg-green-50 px-4 py-3 border-b border-green-100">
                                                <h4 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Valid Entries Preview (Showing first 5)</h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-neutral-50">
                                                        <tr>
                                                            <th className="px-4 py-2 font-bold text-neutral-500">Name</th>
                                                            <th className="px-4 py-2 font-bold text-neutral-500">Email</th>
                                                            <th className="px-4 py-2 font-bold text-neutral-500">Branch/Dept</th>
                                                            {smartImportTarget === 'student' && <th className="px-4 py-2 font-bold text-neutral-500">Roll No</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-100">
                                                        {importPreview.validRows.slice(0, 5).map((row: any, idx: number) => (
                                                            <tr key={idx} className="bg-white">
                                                                <td className="px-4 py-2 font-medium text-neutral-900">{row.name}</td>
                                                                <td className="px-4 py-2 text-neutral-500">{row.email}</td>
                                                                <td className="px-4 py-2 text-neutral-500">{row.branch || row.department}</td>
                                                                {smartImportTarget === 'student' && <td className="px-4 py-2 font-mono text-neutral-600 pt-1">{row.rollNumber}</td>}
                                                            </tr>
                                                        ))}
                                                        {importPreview.validRows.length === 0 && (
                                                            <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400">No valid rows found to import.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>

                            {/* Simple import result */}
                            {simpleImportResult && (
                                <div className="px-6 pb-4 space-y-3">
                                    <div className="flex items-center gap-4 p-4 rounded-xl border bg-neutral-50">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-neutral-800">{simpleImportResult.created} of {simpleImportResult.total} users imported successfully</p>
                                            {simpleImportResult.errors.length > 0 && <p className="text-xs text-red-600 mt-0.5">{simpleImportResult.errors.length} error(s)</p>}
                                        </div>
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    </div>
                                    {simpleImportResult.errors.length > 0 && (
                                        <div className="border border-red-200 rounded-xl overflow-hidden">
                                            <div className="bg-red-50 px-4 py-2 text-xs font-bold text-red-700 uppercase tracking-wider">Errors ({simpleImportResult.errors.length})</div>
                                            <div className="divide-y divide-red-100 max-h-40 overflow-y-auto">
                                                {simpleImportResult.errors.map((e, i) => (
                                                    <div key={i} className="px-4 py-2 text-xs flex gap-3">
                                                        <span className="font-medium text-neutral-700 w-32 truncate">{e.name || e.email}</span>
                                                        <span className="text-red-600">{e.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-3 bg-white">
                                <button
                                    onClick={() => {
                                        setSimpleImportResult(null);
                                        if (simpleImportResult || !importPreview) {
                                            setShowImportModal(false);
                                        } else {
                                            setImportPreview(null);
                                            setImportFile(null);
                                        }
                                    }}
                                    className="px-5 py-2.5 text-neutral-600 font-bold hover:bg-neutral-100 rounded-xl transition-colors"
                                >
                                    {simpleImportResult ? 'Close' : importPreview ? 'Start Over' : 'Cancel'}
                                </button>
                                {importPreview && importPreview.validRows.length > 0 && !simpleImportResult && (
                                    <button
                                        onClick={async () => {
                                            setImportLoading(true);
                                            try {
                                                const res = await api.post('/users/import-commit', { validRows: importPreview.validRows });
                                                setSimpleImportResult({ created: res.data.created, total: res.data.total, errors: res.data.errors || [] });
                                                if (smartImportTarget === 'student') {
                                                    const resStudents = await api.get('/users/students');
                                                    setStudents(Array.isArray(resStudents.data) ? resStudents.data : []);
                                                } else {
                                                    const resFaculty = await api.get('/users/faculty');
                                                    setFaculty(Array.isArray(resFaculty.data) ? resFaculty.data : []);
                                                }
                                            } catch (error: any) {
                                                setSimpleImportResult({ created: 0, total: importPreview.validRows.length, errors: [{ email: '', name: 'Request failed', reason: error.response?.data?.message || 'Server error' }] });
                                            } finally {
                                                setImportLoading(false);
                                            }
                                        }}
                                        disabled={importLoading}
                                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200"
                                    >
                                        {importLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</> : <><Save className="w-4 h-4" /> Confirm & Import {importPreview.validRows.length} Users</>}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
