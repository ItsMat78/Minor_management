import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Search, ChevronDown, ChevronUp, Users, Clock, CheckCircle, XCircle, FileText, LayoutGrid, LayoutList, X, LogOut, ChevronRight, Layout, Settings, Menu, GraduationCap, Medal } from 'lucide-react';
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
    midTermEvaluation?: {
        marks: number;
        remarks: string;
        date: string;
        guide: {
            dataElicitation: number;
            problemDefinition: number;
            planning: number;
        };
        panel: {
            literatureSurvey: number;
            presentationSkills: number;
            technicalUnderstanding: number;
        };
    };
    endTermEvaluation?: {
        marks: number;
        remarks: string;
        date: string;
        guide: {
            requirementSpecification: number;
            systemDesign: number;
            implementation: number;
            projectManagement: number;
            planningVsExecution: number;
        };
        panel: {
            testingAndResults: number;
            innovationAndRelevance: number;
            presentationAndViva: number;
            conceptualDepth: number;
        };
    };
    finalReportEvaluation?: {
        marks: number;
        remarks: string;
        date: string;
        guide: {
            reportWriting: number;
        };
        panel: {
            finalReport: number;
        };
    };
}

const RUBRIC_CONFIG: any = {
    'mid-term': {
        maxMarks: 30,
        sections: [
            {
                title: 'Guide Evaluation',
                maxMarks: 15,
                fields: [
                    { key: 'dataElicitation', label: 'Data Elicitation', max: 5, description: 'Identifies topic, explores basic trends' },
                    { key: 'problemDefinition', label: 'Problem Definition', max: 5, description: 'Simple and well-scoped' },
                    { key: 'planning', label: 'Planning', max: 5, description: 'Basic timeline, effort distribution' },
                ],
                key: 'guide'
            },
            {
                title: 'Panel Evaluation',
                maxMarks: 15,
                fields: [
                    { key: 'literatureSurvey', label: 'Literature Survey', max: 5, description: '4-6 generic online sources' },
                    { key: 'presentationSkills', label: 'Presentation Skills', max: 5, description: 'Basic slide design, clarity in speech' },
                    { key: 'technicalUnderstanding', label: 'Technical Understanding', max: 5, description: 'Working knowledge of tools' },
                ],
                key: 'panel'
            }
        ]
    },
    'end-term': {
        maxMarks: 70,
        sections: [
            {
                title: 'Guide Evaluation',
                maxMarks: 35,
                fields: [
                    { key: 'requirementSpecification', label: 'Requirement Specification', max: 7, description: 'Functional needs outlined' },
                    { key: 'systemDesign', label: 'System Design', max: 7, description: 'Block diagram or flowchart' },
                    { key: 'implementation', label: 'Implementation', max: 7, description: 'Working model with basic coding' },
                    { key: 'projectManagement', label: 'Project Management', max: 7, description: 'Manual task tracking, logbook' },
                    { key: 'planningVsExecution', label: 'Planning vs Execution', max: 7, description: 'Deviations noted casually' },
                ],
                key: 'guide'
            },
            {
                title: 'Panel Evaluation',
                maxMarks: 35,
                fields: [
                    { key: 'testingAndResults', label: 'Testing & Results', max: 10, description: 'Functional testing with screenshots' },
                    { key: 'innovationAndRelevance', label: 'Innovation & Relevance', max: 5, description: 'Minor creative aspect' },
                    { key: 'presentationAndViva', label: 'Presentation & Viva', max: 10, description: 'Clear explanation, guided answers' },
                    { key: 'conceptualDepth', label: 'Conceptual Depth', max: 10, description: 'Understanding basic tools and outcomes' },
                ],
                key: 'panel'
            }
        ]
    }
};

const getProjectColor = (id: string) => { // Existing function kept
    const colors = [
        'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
        'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
        'bg-rose-500', 'bg-orange-500', 'bg-amber-500',
        'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
        'bg-lime-500'
    ];
    let hash = 0;
    if (!id) return colors[0];
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const MenteeCard = ({ item, activeTab, navigate, setSelectedProject }: any) => {
    const projectId = item.project?._id || item._id || 'default';
    const borderColor = getProjectColor(projectId);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => {
                if (setSelectedProject) {
                    setSelectedProject(item);
                }
            }}
            className={`bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all group flex flex-col cursor-pointer relative ${item.project?.hasNewUpdate ? '!border-blue-300 !shadow-md' : ''
                }`}
        >
            {/* Unique Color Stripe */}
            <div className={`h-1.5 w-full ${borderColor}`} />

            {item.project?.hasNewUpdate && (
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded border border-blue-100 shadow-sm z-10">
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
                    ) : (
                        <div className="flex flex-wrap gap-1 max-w-[75%]">
                            {(item.members || item.group?.members || []).map((m: any, idx: number) => (
                                <span key={idx} className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                    {m.name}
                                </span>
                            ))}
                        </div>
                    )}

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
};


const renderEvalCard = (item: any, activeTab: string, handleOpenEvaluation: any, isPanel: boolean = false, viewMode: 'grid' | 'list' = 'grid') => {
    const projectData = item.project || item;
    const evalData = activeTab === 'mid-term' ? projectData?.midTermEvaluation :
        projectData?.endTermEvaluation; // Removed finalReportEvaluation

    const isEvaluated = !!evalData && !!evalData.marks;
    const RUBRIC_CONFIG_LOCAL = { // Renamed to avoid conflict with global RUBRIC_CONFIG
        'mid-term': { maxMarks: 30 },
        'end-term': { maxMarks: 70 }, // Updated maxMarks for end-term
    } as any;

    if (viewMode === 'list') {
        return (
            <div key={item._id} className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6">
                {isEvaluated && (
                    <div className="absolute top-0 right-0 p-2 px-3 bg-green-50 rounded-bl-2xl border-l border-b border-green-100 text-green-700 flex items-center gap-1.5 font-bold text-[10px] z-10 hidden md:flex uppercase tracking-wider">
                        <CheckCircle className="w-3 h-3" />
                        Evaluated
                    </div>
                )}
                {isPanel && (
                    <div className="absolute top-0 left-0 p-2 px-3 bg-amber-50 rounded-br-2xl border-r border-b border-amber-100 text-amber-700 font-bold text-[10px] z-10 hidden md:flex uppercase tracking-wider">
                        Panel Eval
                    </div>
                )}
                <div className="flex-1 min-w-0 md:pr-4 pt-2 md:pt-0">
                    <div className="flex items-center gap-2 mb-1">
                        {isPanel && <span className="md:hidden px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold uppercase tracking-wider">Panel Eval</span>}
                        {isEvaluated && <span className="md:hidden px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider"><CheckCircle className="w-3 h-3" /> Evaluated</span>}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 truncate" title={projectData?.title}>{projectData?.title || 'Untitled Project'}</h3>
                    <p className="text-sm text-neutral-500 font-medium truncate flex items-center gap-1.5 align-middle mt-1 uppercase tracking-wider">
                        {item.name || item.group?.name}
                    </p>
                    {projectData?.attachments && projectData.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {projectData.attachments.slice(0, 2).map((url: string, idx: number) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-50 text-indigo-600 rounded-lg text-xs font-bold border border-neutral-200 hover:bg-neutral-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                                    File {idx + 1}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-6 shrink-0 w-full md:w-auto bg-neutral-50 p-4 rounded-xl border border-neutral-100 group-hover:border-indigo-100 transition-colors">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 text-right">Score</span>
                        <div className="flex items-end justify-end gap-1">
                            <span className={`text-2xl leading-none font-bold ${isEvaluated ? 'text-indigo-600' : 'text-neutral-300'}`}>
                                {isEvaluated ? evalData.marks : '--'}
                            </span>
                            <span className="text-sm font-medium text-neutral-400 leading-none pb-0.5">/ {RUBRIC_CONFIG_LOCAL[activeTab]?.maxMarks || 100}</span>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-neutral-200 hidden md:block"></div>
                    <button
                        onClick={() => handleOpenEvaluation(item, activeTab as 'mid-term' | 'end-term' | 'final-report', isPanel)}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${isEvaluated
                            ? 'bg-white border text-neutral-600 hover:text-indigo-600 hover:bg-neutral-50 hover:border-indigo-200 shadow-sm'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 hover:-translate-y-0.5'
                            }`}
                    >
                        {isEvaluated ? 'Edit Evaluation' : 'Evaluate Now'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div key={item._id} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col h-full">
            {isEvaluated && (
                <div className="absolute top-0 right-0 p-3 bg-green-50 rounded-bl-2xl border-l border-b border-green-100 text-green-700 flex items-center gap-1.5 font-bold text-xs z-10">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>
                    Evaluated
                </div>
            )}
            {isPanel && (
                <div className="absolute top-0 left-0 p-2 bg-amber-50 rounded-br-2xl border-r border-b border-amber-100 text-amber-700 font-bold text-[10px] z-10">
                    Panel Eval
                </div>
            )}
            <div className="mb-4 mt-2">
                <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1 pr-8" title={projectData?.title}>{projectData?.title || 'Untitled Project'}</h3>
                <p className="text-sm text-neutral-500 font-medium flex items-center gap-1.5 align-middle">
                    {item.name || item.group?.name}
                </p>
            </div>
            {projectData?.attachments && projectData.attachments.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {projectData.attachments.slice(0, 2).map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-50 text-indigo-600 rounded-lg text-xs font-bold border border-neutral-200 hover:bg-neutral-100" onClick={(e) => e.stopPropagation()}>
                            File {idx + 1}
                        </a>
                    ))}
                </div>
            )}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex flex-col gap-3 group-hover:border-indigo-100 transition-colors mt-auto">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Score</span>
                    <span className={`text-xl font-bold ${isEvaluated ? 'text-indigo-600' : 'text-neutral-300'}`}>
                        {isEvaluated ? evalData.marks : '--'} <span className="text-sm text-neutral-400 font-medium">/ {RUBRIC_CONFIG_LOCAL[activeTab]?.maxMarks || 100}</span>
                    </span>
                </div>
                <button
                    onClick={() => handleOpenEvaluation(item, activeTab as 'mid-term' | 'end-term' | 'final-report', isPanel)}
                    className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${isEvaluated
                        ? 'bg-white border text-neutral-600 hover:text-indigo-600 hover:bg-neutral-50 hover:border-indigo-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                >
                    {isEvaluated ? 'Edit Evaluation' : 'Evaluate Now'}
                </button>
            </div>
        </div>
    );
};

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
    const [activeTab, setActiveTab] = useState<'proposals' | 'mentees' | 'profile' | 'directory' | 'mid-term' | 'end-term'>(initialTab || 'mentees'); // Removed 'final-report'
    const [mentees, setMentees] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingMentees, setLoadingMentees] = useState(false);
    const [panelGroups, setPanelGroups] = useState<any[]>([]);
    const [manualMarksMode, setManualMarksMode] = useState(false);

    // Evaluation State
    const [evaluatingProject, setEvaluatingProject] = useState<any>(null);
    const [evaluationMarks, setEvaluationMarks] = useState<number>(0);
    const [evaluationRemarks, setEvaluationRemarks] = useState<string>('');
    const [evaluationDetails, setEvaluationDetails] = useState<any>({});
    const [evaluationType, setEvaluationType] = useState<'mid-term' | 'end-term' | null>(null); // Removed 'final-report'

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBatch, setFilterBatch] = useState<string>('All');
    const [proposalView, setProposalView] = useState<'proposals' | 'approved'>('proposals');
    const [filterDirectoryYear, setFilterDirectoryYear] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Grouped' | 'Available'>('All');
    const [filterBranch, setFilterBranch] = useState<string>('All');
    const [sortOption, setSortOption] = useState<string>('Default'); // Added sort state
    const [collapsedEvalFaculties, setCollapsedEvalFaculties] = useState<Record<string, boolean>>({});

    const projectGuideId = React.useMemo(() => {
        if (!evaluatingProject) return null;
        const project = evaluatingProject.project || evaluatingProject;
        return typeof (project?.faculty) === 'string'
            ? project?.faculty
            : project?.faculty?._id;
    }, [evaluatingProject]);

    const panelMembers = React.useMemo(() => {
        if (!evaluatingProject) return [];
        const project = evaluatingProject.project || evaluatingProject;
        const projectGroupId = evaluatingProject.group?._id || evaluatingProject._id;

        const projectPanel = panelGroups.find((p: any) =>
            p.groups.some((g: any) =>
                g._id === projectGroupId ||
                g.project?._id === project._id
            )
        );

        // Ensure the guide is always included if they are not already in the panel members
        const members = projectPanel?.panel?.faculty || [];
        const guide = project?.faculty;
        if (guide && typeof guide !== 'string' && !members.some((m: any) => m._id === guide._id)) {
            return [...members, guide];
        }
        return members;
    }, [evaluatingProject, panelGroups]);

    const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
    const toggleBatch = (year: string) => {
        setExpandedBatches(prev => ({
            ...prev,
            [year]: !prev[year]
        }));
    };
    const isBatchExpanded = (year: string) => expandedBatches[year] === true;

    // Group Details View State (integrated to fix sidebar issues)
    const [viewGroup, setViewGroup] = useState<any>(null);

    // Keep viewGroup in sync with mentees data to reflect updates immediately
    useEffect(() => {
        if (viewGroup) {
            const updatedGroup = mentees.find(m => m._id === viewGroup._id);
            if (updatedGroup) {
                setViewGroup(updatedGroup);
            }
        }
    }, [mentees]);

    useEffect(() => {
        if (activeTab === 'proposals') {
            fetchProjects();
        } else if (['mentees', 'mid-term', 'end-term'].includes(activeTab)) { // Removed 'final-report'
            fetchMentees();
            fetchPanelGroups();
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

    const fetchPanelGroups = async () => {
        try {
            const res = await api.get('/panels/my-panels');
            setPanelGroups(res.data);
        } catch (error) {
            console.error("Failed to fetch panel groups", error);
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

    const handleOpenEvaluation = (item: any, type: 'mid-term' | 'end-term') => { // Removed 'final-report'
        setEvaluatingProject(item);
        setEvaluationType(type);

        // Determine existing evaluation data
        // item can be a Group (with item.project) or a Project (direct)
        const projectData = item.project || item;
        let existingEval: any;
        if (type === 'mid-term') existingEval = projectData.midTermEvaluation;
        else if (type === 'end-term') existingEval = projectData.endTermEvaluation;

        // Initialize details from rubric config
        const config = RUBRIC_CONFIG[type];
        const initialDetails: any = { guide: {}, panel: {}, facultyScores: {} };

        // Initialize facultyScores for all panel members
        panelMembers.forEach((fac: any) => {
            initialDetails.facultyScores[fac._id] = existingEval?.facultyScores?.[fac._id] ?? '';
        });

        // Restore field-level scores if not in manual mode (or if manual mode was not used previously)
        if (config) {
            config.sections.forEach((section: any) => {
                const sectionKey = section.key; // 'guide' or 'panel'
                section.fields.forEach((field: any) => {
                    const val = existingEval?.[sectionKey]?.[field.key] || ''; // Use '' for empty input
                    initialDetails[sectionKey][field.key] = val;
                });
            });
        }

        setEvaluationDetails(initialDetails);
        setEvaluationMarks(existingEval?.marks || 0); // Total marks
        setEvaluationRemarks(existingEval?.remarks || '');
        // Always default to Direct Marks Entry
        setManualMarksMode(true);
    };

    const handleDetailChange = (section: string, field: string, value: number | string) => {
        setEvaluationDetails((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    // Auto-calculate marks when details change
    useEffect(() => {
        if (!evaluationType || !RUBRIC_CONFIG[evaluationType]) return;

        if (manualMarksMode) {
            let guideScore = 0;
            let evaluatorScores: number[] = [];

            panelMembers.forEach((fac: any) => {
                const score = Number(evaluationDetails.facultyScores?.[fac._id] || 0);
                if (fac._id === projectGuideId) {
                    guideScore = score;
                } else {
                    evaluatorScores.push(score);
                }
            });

            let totalMarks = guideScore;
            if (evaluatorScores.length > 0) {
                const avgEvaluatorScore = evaluatorScores.reduce((a, b) => a + b, 0) / evaluatorScores.length;
                totalMarks += avgEvaluatorScore;
            }
            setEvaluationMarks(Math.round(totalMarks));
        } else {
            let total = 0;
            RUBRIC_CONFIG[evaluationType].sections.forEach((sect: any) => {
                sect.fields.forEach((f: any) => {
                    const val = evaluationDetails[sect.key]?.[f.key];
                    total += Number(val || 0);
                });
            });
            setEvaluationMarks(total);
        }
    }, [evaluationDetails, evaluationType, manualMarksMode, panelMembers, projectGuideId]);

    const handleSubmitEvaluation = async () => {
        if (!evaluatingProject || !evaluationType) return;
        try {
            const projectData = evaluatingProject.project || evaluatingProject;
            const projectId = projectData._id;

            // Sanitize guide and panel to ensure no empty strings are sent
            const sanitize = (obj: any) => {
                const clean: any = {};
                Object.keys(obj || {}).forEach(k => {
                    clean[k] = obj[k] === '' ? 0 : Number(obj[k]);
                });
                return clean;
            };

            // Construct payload
            const payload: any = {
                type: evaluationType,
                marks: evaluationMarks,
                remarks: evaluationRemarks,
            };

            if (manualMarksMode) {
                payload.facultyScores = sanitize(evaluationDetails.facultyScores);
                payload.guide = {}; // Ensure guide/panel fields are empty if using facultyScores
                payload.panel = {};
            } else {
                payload.guide = sanitize(evaluationDetails.guide);
                payload.panel = sanitize(evaluationDetails.panel);
                payload.facultyScores = {}; // Ensure facultyScores is empty if not using manual mode
            }

            await api.put(`/projects/${projectId}/evaluation`, payload);

            // Refresh Data
            await fetchMentees();
            await fetchPanelGroups();
            setEvaluatingProject(null);
            setEvaluationType(null);
            setEvaluationDetails({});
            setEvaluationMarks(0);
            setEvaluationRemarks('');
            setManualMarksMode(false);
        } catch (error) {
            console.error("Failed to submit evaluation", error);
            alert("Failed to submit evaluation. Check console for details.");
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
        return mentees.filter(g => {
            const matchesSearch =
                g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.project?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.members.some((m: any) => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesBatch = filterBatch === 'All' || (() => {
                const batchSuffix = filterBatch.slice(2);
                return g.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
            })();

            return matchesSearch && matchesBatch;
        }).sort((a, b) => {
            if (sortOption === 'Name (A-Z)') return a.name.localeCompare(b.name);
            if (sortOption === 'Name (Z-A)') return b.name.localeCompare(a.name);
            if (sortOption === 'Project (A-Z)') return (a.project?.title || '').localeCompare(b.project?.title || '');

            // Default sort: Has Update First
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

    const currentTeamsCount = activeTab === 'mentees' ? filteredMentees.length : approvedInView.length;
    const currentStudentsCount = activeTab === 'mentees'
        ? filteredMentees.reduce((acc, m) => acc + (m.members?.length || 0), 0)
        : approvedInView.reduce((acc, p) => acc + (p.group?.members?.length || 0), 0);

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
                        <div className="max-w-7xl mx-auto flex flex-col">

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
                                                <>
                                                    {activeTab === 'mentees' && (
                                                        <select
                                                            className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                            value={sortOption}
                                                            onChange={(e) => setSortOption(e.target.value)}
                                                        >
                                                            <option value="Default">Sort By: Updated</option>
                                                            <option value="Name (A-Z)">Group Name (A-Z)</option>
                                                            <option value="Name (Z-A)">Group Name (Z-A)</option>
                                                            <option value="Project (A-Z)">Project Title (A-Z)</option>
                                                        </select>
                                                    )}

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
                                                </>
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
                                            {['mentees', 'mid-term', 'end-term'].includes(activeTab) && (
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
                                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm overflow-x-auto">
                                    <table className="w-full text-left text-sm min-w-[800px]">
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
                            ) : (activeTab === 'proposals' ? loading : loadingMentees) ? (
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
                                                (filterBatch === 'All' ? Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).reverse() : [parseInt(filterBatch || '0')]).map(batchYear => {
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
                                                                <div
                                                                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all group select-none relative overflow-hidden ${isBatchExpanded(batchYear.toString()) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50'}`}
                                                                    onClick={() => toggleBatch(batchYear.toString())}
                                                                >
                                                                    {isBatchExpanded(batchYear.toString()) && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>}
                                                                    <div className="flex items-center gap-4 pl-2">
                                                                        <div className={`p-2 rounded-xl transition-colors ${isBatchExpanded(batchYear.toString()) ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                                            <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${!isBatchExpanded(batchYear.toString()) ? '-rotate-90' : ''}`} />
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-xl font-bold text-neutral-900">Batch {batchYear}-{batchYear + 4}</h3>
                                                                            <p className="text-sm font-medium text-neutral-500 mt-0.5">{batchMentees.length} Active Projects</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-3 pr-2" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="px-4 py-2 bg-white text-indigo-700 rounded-xl border border-indigo-100/50 flex items-center gap-3 shadow-sm">
                                                                            <div className="p-1.5 bg-indigo-50 rounded-lg">
                                                                                <Users className="w-4 h-4 text-indigo-600" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Teams</span>
                                                                                <span className="text-sm font-bold leading-none">{teamsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="px-4 py-2 bg-white text-emerald-700 rounded-xl border border-emerald-100/50 flex items-center gap-3 shadow-sm">
                                                                            <div className="p-1.5 bg-emerald-50 rounded-lg">
                                                                                <Users className="w-4 h-4 text-emerald-600" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Students</span>
                                                                                <span className="text-sm font-bold leading-none">{studentsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {(isBatchExpanded(batchYear.toString()) || filterBatch !== 'All') && (
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
                                                            )}
                                                        </div>
                                                    );
                                                }))}
                                        </div>
                                    ) : activeTab === 'mid-term' || activeTab === 'end-term' ? (
                                        /* EVALUATION VIEW - Filter by Batch */
                                        <div className="space-y-12 pb-20">

                                            {filterBatch === 'All' ? (
                                                <div className="text-center py-20 bg-white rounded-3xl border border-indigo-100 shadow-sm">
                                                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400">
                                                        <Users className="w-8 h-8" />
                                                    </div>
                                                    <h3 className="text-xl font-black text-indigo-900 mb-2">Select a Batch Year</h3>
                                                    <p className="text-neutral-500 max-w-md mx-auto text-sm">
                                                        Please set the 'Filter by batch' dropdown above to view and evaluate panels for a specific year.
                                                    </p>
                                                </div>
                                            ) : (
                                                [parseInt(filterBatch)].map(batchYear => {
                                                    const batchSuffix = batchYear.toString().slice(2);

                                                    // My Mentees in this batch
                                                    const batchProjects = filteredMentees.filter((item: any) => {
                                                        const members = item.members || item.group?.members || [];
                                                        return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                    });

                                                    // Panel Groups in this batch
                                                    const panelGroupsInBatch = panelGroups.filter((p: any) => p.panel.batchYear === batchYear);

                                                    if (batchProjects.length === 0 && panelGroupsInBatch.length === 0) {
                                                        return (
                                                            <div className="text-center py-20 bg-white rounded-3xl border border-neutral-200">
                                                                <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-4" />
                                                                <h3 className="text-lg font-bold text-neutral-900 mb-2">No Evaluation Room Configured</h3>
                                                                <p className="text-sm text-neutral-500 max-w-sm mx-auto">There are currently no projects assigned to you or a panel you are part of for this batch.</p>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div key={batchYear} className="flex flex-col xl:flex-row gap-8 items-start">
                                                            <div className="flex-1 space-y-10 min-w-0 w-full">
                                                                {/* Panel Groups */}
                                                                {panelGroupsInBatch.length > 0 && (
                                                                    <div>
                                                                        <h3 className="text-2xl font-black text-indigo-900 mb-6 flex items-center gap-3">
                                                                            <Users className="w-6 h-6 text-indigo-500" />
                                                                            Your Panel Area
                                                                        </h3>
                                                                        {panelGroupsInBatch.map((pData: any, idx: number) => {
                                                                            if (pData.groups.length === 0) return null;

                                                                            // Group by faculty
                                                                            const facultyGroups: Record<string, { name: string, groups: any[] }> = {};
                                                                            pData.groups.forEach((g: any) => {
                                                                                const facId = typeof g.project.faculty === 'string' ? g.project.faculty : g.project.faculty?._id;
                                                                                const facName = typeof g.project.faculty === 'string' ? 'Unknown' : g.project.faculty?.name;
                                                                                if (!facultyGroups[facId]) facultyGroups[facId] = { name: facName, groups: [] };
                                                                                facultyGroups[facId].groups.push(g);
                                                                            });

                                                                            return (
                                                                                <div key={idx} className="border-t border-indigo-100 pt-6 mt-6 first:mt-0 first:border-0 first:pt-0">
                                                                                    {Object.values(facultyGroups).map((facInfo: any, fIdx: number) => {
                                                                                        const sectionKey = `${batchYear}-${idx}-${fIdx}`;
                                                                                        const isCollapsed = collapsedEvalFaculties[sectionKey] || false;
                                                                                        return (
                                                                                            <div key={fIdx} className="mb-10 last:mb-0 bg-white rounded-3xl overflow-hidden border border-neutral-200 shadow-sm">
                                                                                                <div
                                                                                                    className="bg-neutral-50 px-6 py-4 flex items-center justify-between border-b border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors group"
                                                                                                    onClick={() => setCollapsedEvalFaculties(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                                                                                                >
                                                                                                    <h5 className="font-black text-neutral-800 flex items-center gap-3 text-lg group-hover:text-indigo-700 transition-colors">
                                                                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                                                                                            {facInfo.name.charAt(0)}
                                                                                                        </div>
                                                                                                        {facInfo.name}'s Group
                                                                                                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronUp className="w-4 h-4 text-neutral-400" />}
                                                                                                    </h5>
                                                                                                    <span className="text-xs font-bold bg-neutral-200 text-neutral-600 px-3 py-1 rounded-full uppercase tracking-wider">{facInfo.groups.length} Teams</span>
                                                                                                </div>
                                                                                                {!isCollapsed && (
                                                                                                    <div className={`p-6 ${viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 auto-rows-fr' : 'flex flex-col gap-4'}`}>
                                                                                                        {facInfo.groups.map((item: any) => renderEvalCard(item, activeTab, handleOpenEvaluation, true, viewMode))}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right Sidebar for Panel Information */}
                                                            {panelGroupsInBatch.length > 0 && (
                                                                <div className="w-full xl:w-64 shrink-0 sticky top-24">
                                                                    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
                                                                        <div className="bg-indigo-600 px-6 py-5">
                                                                            <h4 className="text-white font-bold flex items-center gap-2">
                                                                                <Users className="w-5 h-5 text-indigo-200" />
                                                                                Panel Information
                                                                            </h4>
                                                                        </div>
                                                                        <div className="p-6">
                                                                            {panelGroupsInBatch.map((pData: any, idx: number) => (
                                                                                <div key={idx} className="mb-6 last:mb-0">
                                                                                    <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Panel Members</h5>
                                                                                    <div className="space-y-4">
                                                                                        {pData.panel.faculty?.map((fac: any, fIdx: number) => (
                                                                                            <div key={fIdx} className="flex items-center gap-3">
                                                                                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm ring-1 ring-indigo-100">
                                                                                                    {fac.name?.charAt(0) || '?'}
                                                                                                </div>
                                                                                                <div className="flex-1 min-w-0">
                                                                                                    <p className="text-sm font-bold text-neutral-900 break-words line-clamp-2 leading-tight mb-0.5">{fac.name}</p>
                                                                                                    <p className="text-xs text-neutral-500 truncate" title={fac.email}>{fac.email}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
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
                                                                <div
                                                                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all group select-none relative overflow-hidden ${isBatchExpanded(batchYear.toString()) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50'}`}
                                                                    onClick={() => toggleBatch(batchYear.toString())}
                                                                >
                                                                    {isBatchExpanded(batchYear.toString()) && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>}
                                                                    <div className="flex items-center gap-4 pl-2">
                                                                        <div className={`p-2 rounded-xl transition-colors ${isBatchExpanded(batchYear.toString()) ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                                            <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${!isBatchExpanded(batchYear.toString()) ? '-rotate-90' : ''}`} />
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-xl font-bold text-neutral-900">Batch {batchYear}</h3>
                                                                            <p className="text-sm font-medium text-neutral-500 mt-0.5">{batchMentees.length} Active Projects</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-3 pr-2" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="px-4 py-2 bg-white text-indigo-700 rounded-xl border border-indigo-100/50 flex items-center gap-3 shadow-sm">
                                                                            <div className="p-1.5 bg-indigo-50 rounded-lg">
                                                                                <Users className="w-4 h-4 text-indigo-600" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Teams</span>
                                                                                <span className="text-sm font-bold leading-none">{teamsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="px-4 py-2 bg-white text-emerald-700 rounded-xl border border-emerald-100/50 flex items-center gap-3 shadow-sm">
                                                                            <div className="p-1.5 bg-emerald-50 rounded-lg">
                                                                                <Users className="w-4 h-4 text-emerald-600" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Students</span>
                                                                                <span className="text-sm font-bold leading-none">{studentsCount}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {isBatchExpanded(batchYear.toString()) && (
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
                                                                )}
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
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl bg-white rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col focus:outline-none max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-100 bg-neutral-50/50">
                            <div>
                                <Dialog.Title className="text-xl font-bold text-neutral-900">
                                    {evaluationType === 'mid-term' ? 'Mid-Term Evaluation' : 'End-Term Evaluation'}
                                </Dialog.Title>
                            </div>
                            <Dialog.Close className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </Dialog.Close>
                        </div>

                        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
                            {/* Left Column: Project Details */}
                            <div className="col-span-1 border-r border-neutral-100 bg-white p-8 overflow-y-auto hidden lg:block">
                                <div className="mb-8 flex items-start gap-3">
                                    <div className="mt-1 shrink-0">
                                        <FileText className="w-6 h-6 text-indigo-500" />
                                    </div>
                                    <h3 className="text-2xl font-black text-indigo-900 leading-tight">
                                        {evaluatingProject?.project?.title || evaluatingProject?.title || 'Project Details'}
                                    </h3>
                                </div>

                                <div className="space-y-8">
                                    {/* Abstract */}
                                    <div>
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900 mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            Abstract & Description
                                        </h4>
                                        <p className="text-sm text-neutral-600 leading-relaxed">
                                            {evaluatingProject?.project?.description || evaluatingProject?.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    {/* Team Members */}
                                    {((evaluatingProject?.members) || (evaluatingProject?.group?.members))?.length > 0 && (
                                        <div>
                                            <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900 mb-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                Team Members
                                            </h4>
                                            <div className="space-y-2">
                                                {(evaluatingProject?.members || evaluatingProject?.group?.members).map((member: any) => (
                                                    <div key={member._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 transition-colors">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-100">
                                                            {member.name?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-neutral-900">{member.name}</p>
                                                            <p className="text-xs text-neutral-500 font-medium">{member.rollNumber}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(evaluatingProject?.project?.attachments?.length > 0 || evaluatingProject?.attachments?.length > 0) && (
                                        <div>
                                            <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900 mb-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                                Resources & Links
                                            </h4>
                                            <div className="space-y-2">
                                                {(evaluatingProject?.project?.attachments || evaluatingProject?.attachments).map((att: string, i: number) => {
                                                    const isLink = att.startsWith('http') && !att.includes('/uploads/');

                                                    return (
                                                        <a
                                                            key={i}
                                                            href={att}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 p-2.5 bg-neutral-50 border border-neutral-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                                                        >
                                                            <div className="text-indigo-600">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-neutral-800 truncate group-hover:text-indigo-700 transition-colors">
                                                                    {isLink ? 'External Link' : att.split('/').pop()}
                                                                </p>
                                                            </div>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Evaluation Inputs */}
                            <div className="col-span-1 lg:col-span-2 flex flex-col overflow-hidden h-full">
                                <div className="p-6 space-y-8 overflow-y-auto flex-1">
                                    {/* Sticky Score Display */}
                                    <div className="sticky top-0 z-10 flex items-center justify-between bg-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-indigo-200 border border-indigo-500 backdrop-blur-md">
                                        <div>
                                            <h4 className="font-bold text-indigo-100 text-sm uppercase tracking-wider mb-1">Total Score</h4>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl font-bold">{evaluationMarks}</span>
                                                <span className="text-indigo-200 font-medium">/ {evaluationType ? RUBRIC_CONFIG[evaluationType]?.maxMarks : 100}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Direct Marks Entry</span>
                                                <button
                                                    onClick={() => setManualMarksMode(!manualMarksMode)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${manualMarksMode ? 'bg-emerald-400' : 'bg-indigo-400/50'}`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${manualMarksMode ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rubric Sections OR Manual Mode */}
                                    {manualMarksMode ? (
                                        <div className="space-y-4">
                                            <h4 className="text-lg font-bold text-neutral-900 border-b border-neutral-100 pb-2">Direct Faculty Marks Entry</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                {panelMembers.map((fac: any) => {
                                                    const isGuide = fac._id === projectGuideId;
                                                    const maxMarks = evaluationType === 'mid-term' ? (isGuide ? RUBRIC_CONFIG['mid-term'].sections[0].maxMarks : RUBRIC_CONFIG['mid-term'].sections[1].maxMarks) : (isGuide ? RUBRIC_CONFIG['end-term'].sections[0].maxMarks : RUBRIC_CONFIG['end-term'].sections[1].maxMarks);
                                                    const facScore = evaluationDetails.facultyScores?.[fac._id] ?? '';

                                                    return (
                                                        <div key={fac._id} className={`${isGuide ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-neutral-200'} p-5 rounded-2xl border flex flex-col justify-between`}>
                                                            <div className="mb-4">
                                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                    <label className="text-base font-bold text-neutral-800 break-words leading-tight">
                                                                        {fac.name}
                                                                    </label>
                                                                    {isGuide ? (
                                                                        <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-md shadow-sm border border-indigo-200">Guide</span>
                                                                    ) : (
                                                                        <span className="inline-block px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase rounded-md border border-neutral-200">Evaluator</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-neutral-500 truncate" title={fac.email}>{fac.email}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3 bg-neutral-50 p-2 rounded-xl self-start w-full justify-between shadow-inner border border-neutral-100">
                                                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Score:</span>
                                                                <div className="flex items-center gap-2 text-right">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={maxMarks}
                                                                        value={facScore}
                                                                        onChange={(e) => {
                                                                            setEvaluationDetails((prev: any) => ({
                                                                                ...prev,
                                                                                facultyScores: {
                                                                                    ...prev.facultyScores,
                                                                                    [fac._id]: e.target.value
                                                                                }
                                                                            }));
                                                                        }}
                                                                        className="w-16 px-2 py-1.5 border border-neutral-300 rounded-lg text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white shadow-sm"
                                                                        placeholder="-"
                                                                    />
                                                                    <span className="text-sm font-bold text-neutral-400">/ {maxMarks}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        evaluationType && RUBRIC_CONFIG[evaluationType]?.sections.map((section: any, idx: number) => (
                                            <div key={idx} className="space-y-4">
                                                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                                                    <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                                        {section.title}
                                                        <span className="text-xs font-normal text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                                                            Max {section.maxMarks}
                                                        </span>
                                                    </h4>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {section.fields.map((field: any) => (
                                                        <div key={field.key} className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 hover:border-indigo-100 transition-colors">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <label className="text-sm font-bold text-neutral-700 block mb-1">
                                                                    {field.label}
                                                                </label>
                                                                <span className="text-xs font-bold text-neutral-400 bg-white px-1.5 py-0.5 rounded border border-neutral-100">
                                                                    /{field.max}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-neutral-500 mb-3 h-8 line-clamp-2" title={field.description}>
                                                                {field.description}
                                                            </p>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={field.max}
                                                                value={evaluationDetails[section.key]?.[field.key] ?? ''}
                                                                onChange={(e) => {
                                                                    const rawVal = e.target.value;
                                                                    if (rawVal === '') {
                                                                        handleDetailChange(section.key, field.key, '');
                                                                    } else {
                                                                        const val = Math.min(Number(rawVal), field.max);
                                                                        handleDetailChange(section.key, field.key, val);
                                                                    }
                                                                }}
                                                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-neutral-900 bg-white"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    <div className="h-px bg-neutral-100 w-full"></div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-neutral-700">Remarks & Feedback</label>
                                        <textarea
                                            value={evaluationRemarks}
                                            onChange={(e) => setEvaluationRemarks(e.target.value)}
                                            placeholder="Enter detailed feedback for the team..."
                                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm h-[100px] resize-none"
                                        />
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
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
};

export default FacultyDashboard;
