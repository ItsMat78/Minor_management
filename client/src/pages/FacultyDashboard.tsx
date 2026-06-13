import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { GlobalEventBanner } from '../components/GlobalEventBanner';
import { Search, ChevronDown, ChevronUp, Users, Clock, CheckCircle, XCircle, FileText, LayoutGrid, LayoutList, X, LogOut, ChevronRight, Layout, Settings, Menu, GraduationCap, Medal, Archive, Download, Upload, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import MenteeGroupDetails from '../components/MenteeGroupDetails';
import CustomBatchDropdown from '../components/CustomBatchDropdown';
import { useParticipatingBatches } from '../hooks/useParticipatingBatches';

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
        targetBatch?: number | string;
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
    const groupData = item.group || item;
    const isDropper = groupData?.targetBatch && groupData.targetBatch !== getOriginalGroupBatchYear(groupData);
    const projectId = item.project?._id || item._id || 'default';
    const borderColor = isDropper ? 'bg-red-500' : getProjectColor(projectId);

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
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col cursor-pointer relative ${isDropper ? 'border-red-200 hover:border-red-300 bg-red-50/30' : 'border-neutral-200 hover:border-indigo-200'} ${item.project?.hasNewUpdate ? '!border-blue-300 !shadow-md' : ''
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

                    {(() => {
                        if (isDropper) {
                            return (
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-md uppercase tracking-wider shadow-sm border border-red-200">
                                    Original Batch: {getOriginalGroupBatchYear(groupData)}
                                </span>
                            );
                        }
                        const sem = item.semester || item.project?.semester || (() => {
                            const batchYear = parseInt(getOriginalGroupBatchYear(groupData));
                            if (!isNaN(batchYear)) {
                                return (new Date().getFullYear() - batchYear) * 2;
                            }
                            return null;
                        })();
                        if (sem) {
                            return (
                                <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">
                                    Sem {sem}
                                </span>
                            );
                        }
                        return null;
                    })()}
                </div>

                <h3 className="text-lg font-bold text-neutral-900 line-clamp-2 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                    {item.title || item.project?.title || item.name}
                </h3>

                <div className="flex items-center gap-2 text-sm text-neutral-600 font-medium mb-4">
                    <Users className={`w-4 h-4 ${isDropper ? 'text-red-400' : 'text-neutral-400'}`} />
                    <span className={isDropper ? 'text-red-700 font-bold' : ''}>
                        {item.group?.name || item.name}
                        {isDropper && ` (Dropper/Batch override: ${groupData.targetBatch})`}
                    </span>
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


function getOriginalGroupBatchYear(group: any) {
    if (group.members && group.members.length > 0 && group.members[0].rollNumber) {
        return '20' + group.members[0].rollNumber.toString().substring(0, 2);
    }
    return 'Unknown';
}

const getRubricConfig = (activeEvents: any[], activeTab: string) => {
    const eventType = activeTab === 'mid-term' ? 'mid_term_evaluation' : 'end_term_evaluation';
    const event = activeEvents?.find(e => e.type === eventType);
    if (event?.rubricParams) {
        return event.rubricParams;
    }
    return RUBRIC_CONFIG[activeTab];
};

const renderEvalCard = (item: any, activeTab: string, handleOpenEvaluation: any, activeEvents: any[], isPanel: boolean = false, viewMode: 'grid' | 'list' = 'grid') => {
    const projectData = item.project || item;
    const groupData = item.group || item;
    const isDropper = groupData.targetBatch && groupData.targetBatch !== getOriginalGroupBatchYear(groupData);

    const studentEvals = (projectData?.studentEvaluations || []).filter((e: any) => e.evalType === activeTab);
    const isEvaluated = studentEvals.some((e: any) => (e.marks ?? 0) > 0);
    const avgMarks = isEvaluated
        ? Math.round(studentEvals.reduce((sum: number, e: any) => sum + (e.marks || 0), 0) / studentEvals.length)
        : null;
    const RUBRIC_CONFIG_LOCAL = getRubricConfig(activeEvents, activeTab);

    if (viewMode === 'list') {
        const members = item.members || item.group?.members || [];
        return (
            <div key={item._id} className={`flex items-center gap-3 px-3 py-2 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80 transition-colors ${isDropper ? 'bg-red-50 border-l-2 border-l-red-400' : ''}`}>
                {/* Group number badge */}
                <div className="shrink-0 w-10 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isDropper ? 'text-red-500' : 'text-neutral-400'}`}>G{item.name || item.group?.name}</span>
                </div>

                {/* Project + members */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate leading-tight" title={projectData?.title}>
                        {projectData?.title || 'Untitled Project'}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {members.map((m: any, idx: number) => (
                            <span key={idx} className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0 rounded">
                                {m.name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Status + action */}
                <div className="flex items-center gap-2 shrink-0">
                    {isEvaluated && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                    <button
                        onClick={() => handleOpenEvaluation(item, activeTab as 'mid-term' | 'end-term', isPanel)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${isEvaluated
                            ? 'bg-white border border-neutral-200 text-neutral-600 hover:border-indigo-300 hover:text-indigo-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                    >
                        {isEvaluated ? 'Edit' : 'Evaluate'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div key={item._id} className={`rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col h-full ${isDropper ? 'bg-red-50 border-red-200 hover:border-red-300 border-l-4 border-l-red-500' : 'bg-white border-neutral-200'}`}>
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
                <p className={`text-sm font-medium flex items-center gap-1.5 align-middle ${isDropper ? 'text-red-700 font-bold' : 'text-neutral-500'}`}>
                    {item.name || item.group?.name} {isDropper ? `(Dropper: ${groupData.targetBatch})` : ''}
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
            <div className={`mt-auto rounded-xl p-4 border flex flex-col gap-3 transition-colors ${isDropper ? 'bg-red-100/30 border-red-200 group-hover:border-red-300' : 'bg-neutral-50 border-neutral-100 group-hover:border-indigo-100'}`}>
                <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDropper ? 'text-red-400' : 'text-neutral-400'}`}>Score</span>
                    <span className={`text-xl font-bold ${isEvaluated ? 'text-indigo-600' : 'text-neutral-300'}`}>
                        {isEvaluated ? avgMarks : '--'} <span className={`text-sm font-medium ${isDropper ? 'text-red-400' : 'text-neutral-400'}`}>/ {RUBRIC_CONFIG_LOCAL?.maxMarks || 100}</span>
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
    const { user, logout, activeEvents } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') as 'directory' | 'proposals' | 'mentees' | 'profile' | 'mid-term' | 'end-term' | 'archive' | null;
    const [activeTab, setActiveTab] = useState<'directory' | 'proposals' | 'mentees' | 'profile' | 'mid-term' | 'end-term' | 'archive'>(initialTab || 'mentees');

    const { batches: participatingBatchYears } = useParticipatingBatches();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    // Desktop: sidebar docked open. Mobile: starts collapsed so it doesn't cover
    // the content (it opens as an overlay when toggled).
    const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
    );
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
    const [loadingArchive, setLoadingArchive] = useState(false);

    useEffect(() => {
        const current = searchParams.get('tab');
        if (current !== activeTab) {
            const next = new URLSearchParams(searchParams);
            next.set('tab', activeTab);
            setSearchParams(next, { replace: true });
        }
        if (activeTab === 'mid-term' || activeTab === 'end-term') {
            setViewMode('list');
        }
    }, [activeTab]);
    const [mentees, setMentees] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [pendingProposalCount, setPendingProposalCount] = useState(0);
    const [loadingMentees, setLoadingMentees] = useState(false);
    const [panelGroups, setPanelGroups] = useState<any[]>([]);
    const [manualMarksMode, setManualMarksMode] = useState(true);

    // Evaluation State
    const [evaluatingProject, setEvaluatingProject] = useState<any>(null);
    const [evaluationRemarks, setEvaluationRemarks] = useState<string>('');
    const [evaluationType, setEvaluationType] = useState<'mid-term' | 'end-term' | null>(null); // Removed 'final-report'
    type EvalStudentEntry = { stars: number; attendance: 'present' | 'absent'; guide: Record<string, number | ''>; panel1: Record<string, number | ''>; panel2: Record<string, number | ''> };
    const [studentEvalData, setStudentEvalData] = useState<Record<string, EvalStudentEntry>>({});
    const [studentMidData, setStudentMidData] = useState<Record<string, EvalStudentEntry> | null>(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBatch, setFilterBatch] = useState<string>('All');
    const [proposalView, setProposalView] = useState<'proposals' | 'approved'>('proposals');
    const [filterDirectoryYear, setFilterDirectoryYear] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Grouped' | 'Available'>('All');
    const [filterBranch, setFilterBranch] = useState<string>('All');
    const [sortOption, setSortOption] = useState<string>('Default'); // Added sort state
    const [collapsedEvalFaculties, setCollapsedEvalFaculties] = useState<Record<string, boolean>>({});
    const [importingPanelId, setImportingPanelId] = useState<string | null>(null);
    const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);

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

    // Eagerly fetch the pending proposal count on mount so the badge is visible
    // before the faculty navigates to the Proposals tab.
    useEffect(() => {
        api.get('/projects/faculty')
            .then(res => {
                const pending = (res.data || []).filter((p: any) => p.status === 'Pending' || p.status === 'Draft');
                setPendingProposalCount(pending.length);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (activeTab === 'proposals') {
            fetchProjects();
        } else if (['mentees', 'mid-term', 'end-term'].includes(activeTab)) { // Removed 'final-report'
            fetchMentees();
            fetchPanelGroups();
        } else if (activeTab === 'directory') {
            fetchStudents();
        } else if (activeTab === 'archive') {
            (async () => {
                setLoadingArchive(true);
                try {
                    const res = await api.get('/projects/archived/faculty');
                    setArchivedProjects(Array.isArray(res.data) ? res.data : []);
                } catch (err) {
                    setArchivedProjects([]);
                } finally {
                    setLoadingArchive(false);
                }
            })();
        }
    }, [activeTab]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects/faculty');
            setProjects(res.data);
            // Keep the badge count in sync whenever we do a full fetch.
            const pending = (res.data || []).filter((p: any) => p.status === 'Pending' || p.status === 'Draft');
            setPendingProposalCount(pending.length);
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
            setProjects(prev => {
                const updated = prev.map(p => p._id === id ? { ...p, status, feedback: res.data.feedback, updatedAt: res.data.updatedAt } : p);
                setPendingProposalCount(updated.filter(p => p.status === 'Pending' || (p.status as string) === 'Draft').length);
                return updated;
            });

            setFeedback('');
            // Close the modal once the decision is submitted — the list already reflects the new
            // status, so leaving the modal open made it look like the action didn't take effect.
            if (selectedProject && selectedProject._id === id) {
                setSelectedProject(null);
            }
        } catch (error: any) {
            console.error(`Failed to ${status} project`, error);
            alert(error.response?.data?.message || `Failed to ${status} project`);
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

    const handleOpenEvaluation = (item: any, type: 'mid-term' | 'end-term') => {
        setEvaluatingProject(item);
        setEvaluationType(type);

        const projectData = item.project || item;
        const evalMeta = type === 'mid-term' ? projectData.midTermEvaluation : projectData.endTermEvaluation;
        setEvaluationRemarks(evalMeta?.remarks || '');


        const members = item.members || item.group?.members || [];

        const buildData = (evals: any[], evalT: 'mid-term' | 'end-term'): Record<string, EvalStudentEntry> => {
            const config = getRubricConfig(activeEvents, evalT);
            const result: Record<string, EvalStudentEntry> = {};
            members.forEach((m: any) => {
                const ev = evals.find((e: any) => String(e.student?._id || e.student) === String(m._id));
                const guideFields = config?.sections.find((s: any) => s.key === 'guide')?.fields || [];
                const panelFields = config?.sections.find((s: any) => s.key === 'panel')?.fields || [];
                const initGuide: Record<string, number | ''> = {};
                const initPanel1: Record<string, number | ''> = {};
                const initPanel2: Record<string, number | ''> = {};
                guideFields.forEach((f: any) => { initGuide[f.key] = ev?.guide?.[f.key] ?? ''; });
                panelFields.forEach((f: any) => {
                    initPanel1[f.key] = ev?.panel1?.[f.key] ?? ev?.panel?.[f.key] ?? ''; // legacy fallback
                    initPanel2[f.key] = ev?.panel2?.[f.key] ?? '';
                });
                result[m._id] = { stars: ev?.stars ?? 0, attendance: ev?.attendance ?? 'present', guide: initGuide, panel1: initPanel1, panel2: initPanel2 };
            });
            return result;
        };

        const allEvals = projectData?.studentEvaluations || [];
        const midEvals = allEvals.filter((e: any) => e.evalType === 'mid-term');
        const endEvals = allEvals.filter((e: any) => e.evalType === 'end-term');

        if (type === 'end-term') {
            setStudentEvalData(buildData(endEvals, 'end-term'));
            setStudentMidData(buildData(midEvals, 'mid-term'));
        } else {
            setStudentEvalData(buildData(midEvals, 'mid-term'));
            setStudentMidData(null);
        }
    };

    const handleDownloadTemplate = async (panelId: string, mode: string) => {
        try {
            const panelData = panelGroups.find((p: any) => p.panel._id === panelId);
            const panelNum = panelData?.panelNumber || 'Unknown';
            const batchYr = panelData?.panel?.batchYear || 'Unknown';
            const dateStr = new Date().toISOString().split('T')[0];

            const res = await api.get(`/panels/${panelId}/evaluation-template?evalType=${activeTab}&marksMode=${mode}`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Panel_${panelNum}_Batch_${batchYr}_${activeTab}_Template_${dateStr}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Failed to download template.');
        }
    };

    const handleImportTemplate = async (panelId: string, file: File, mode: string) => {
        setImportingPanelId(panelId);
        setImportErrors([]);
        setImportSuccess(null);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post(`/panels/${panelId}/evaluation-import?evalType=${activeTab}&marksMode=${mode}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportSuccess(`Successfully updated ${res.data.updatedGroups} group(s).`);
            await fetchMentees();
            await fetchPanelGroups();
        } catch (err: any) {
            const data = err.response?.data;
            if (data?.errors) {
                setImportErrors(data.errors);
            } else {
                setImportErrors([{ row: 0, message: data?.message || 'Import failed.' }]);
            }
        } finally {
            setImportingPanelId(null);
        }
    };

    const handleExportFinalSheet = async (panelId: string) => {
        try {
            const panelData = panelGroups.find((p: any) => p.panel._id === panelId);
            const panelNum = panelData?.panelNumber || 'Unknown';
            const batchYr = panelData?.panel?.batchYear || 'Unknown';
            const dateStr = new Date().toISOString().split('T')[0];

            const res = await api.get(`/panels/${panelId}/export-final?evalType=full`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Panel_${panelNum}_Batch_${batchYr}_Full_FinalMarks_${dateStr}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Failed to export final sheet.');
        }
    };


    const handleSubmitEvaluation = async () => {
        if (!evaluatingProject || !evaluationType) return;
        try {
            const projectData = evaluatingProject.project || evaluatingProject;
            const projectId = projectData._id;

            const sanitize = (obj: Record<string, number | ''>) => {
                const clean: Record<string, number> = {};
                Object.keys(obj || {}).forEach(k => { clean[k] = obj[k] === '' ? 0 : Number(obj[k]); });
                return clean;
            };

            const mapEntries = (map: Record<string, EvalStudentEntry>) =>
                Object.entries(map).map(([studentId, data]) => ({
                    studentId,
                    stars: data.stars,
                    attendance: data.attendance,
                    guide: sanitize(data.guide),
                    panel1: sanitize(data.panel1),
                    panel2: sanitize(data.panel2),
                }));

            const students = mapEntries(studentEvalData);
            const midStudents = studentMidData ? mapEntries(studentMidData) : undefined;

            await api.put(`/projects/${projectId}/evaluation`, {
                type: evaluationType,
                remarks: evaluationRemarks,
                students,
                ...(midStudents ? { midStudents } : {}),
            });

            await fetchMentees();
            await fetchPanelGroups();
            setEvaluatingProject(null);
            setEvaluationType(null);
            setEvaluationRemarks('');
            setStudentEvalData({});
            setStudentMidData(null);
        } catch (error: any) {
            console.error("Failed to submit evaluation", error);
            alert(error?.response?.data?.message || "Failed to submit evaluation.");
        }
    };


    // Switch tab, leave any open group-detail view, and on mobile (where the
    // sidebar is an overlay) collapse it so the selected view is visible.
    const selectTab = (tab: typeof activeTab) => {
        setActiveTab(tab);
        setViewGroup(null);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
        >
            {icon}
            {label}
            {badge > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold leading-none shadow-sm">
                    {badge}
                </span>
            )}
        </button>
    );

    // Filter Logic
    const getFilteredProjects = () => {
        return projects.filter(p => {
            let matches = true;

            const matchesSearch =
                (p.title || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.group?.name || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.group?.members || []).some((m: any) => (m.name || '').toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.tags || []).some((t: any) => (t || '').toString().toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) matches = false;

            if (filterBatch !== 'All') {
                const gBatch = p.group?.targetBatch ? String(p.group.targetBatch) : (p.group?.members?.[0]?.rollNumber ? '20' + String(p.group.members[0].rollNumber).substring(0, 2) : 'Unknown');
                if (gBatch !== filterBatch) matches = false;
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
                (g.name || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                (g.project?.title || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                (g.members || []).some((m: any) => (m.name || '').toString().toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesBatch = filterBatch === 'All' || (() => {
                const gBatch = g.targetBatch ? String(g.targetBatch) : (g.members?.[0]?.rollNumber ? '20' + String(g.members[0].rollNumber).substring(0, 2) : 'Unknown');
                return gBatch === filterBatch;
            })();

            return matchesSearch && matchesBatch;
        }).sort((a, b) => {
            if (sortOption === 'Name (A-Z)') return (a.name || '').toString().localeCompare((b.name || '').toString());
            if (sortOption === 'Name (Z-A)') return (b.name || '').toString().localeCompare((a.name || '').toString());
            if (sortOption === 'Project (A-Z)') return (a.project?.title || '').toString().localeCompare((b.project?.title || '').toString());

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
            const gBatch = p.group?.targetBatch ? String(p.group.targetBatch) : (p.group?.members?.[0]?.rollNumber ? '20' + String(p.group.members[0].rollNumber).substring(0, 2) : 'Unknown');
            matchesBatch = gBatch === filterBatch;
        }

        return isApproved && matchesBatch;
    });

    const currentTeamsCount = activeTab === 'mentees' ? filteredMentees.length : approvedInView.length;
    const currentStudentsCount = activeTab === 'mentees'
        ? filteredMentees.reduce((acc, m) => acc + (m.members?.length || 0), 0)
        : approvedInView.reduce((acc, p) => acc + (p.group?.members?.length || 0), 0);

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
                        onClick={() => selectTab('directory')}
                    />
                    <SidebarItem
                        icon={<FileText className="w-5 h-5" />}
                        label="Project Proposals"
                        active={activeTab === 'proposals'}
                        onClick={() => selectTab('proposals')}
                        badge={pendingProposalCount}
                    />
                    <SidebarItem
                        icon={<Users className="w-5 h-5" />}
                        label="My Mentees"
                        active={activeTab === 'mentees'}
                        onClick={() => selectTab('mentees')}
                    />
                    <SidebarItem
                        icon={<Settings className="w-5 h-5" />}
                        label="My Profile"
                        active={activeTab === 'profile'}
                        onClick={() => selectTab('profile')}
                    />
                    <SidebarItem
                        icon={<Archive className="w-5 h-5" />}
                        label="Past Projects"
                        active={activeTab === 'archive'}
                        onClick={() => selectTab('archive')}
                    />

                    {!activeEvents?.some(e => e.type === 'group_formation_project_proposal' && new Date(e.extensionDate || e.endDate) > new Date()) && (activeEvents?.some(e => e.type === 'mid_term_evaluation') || activeEvents?.some(e => e.type === 'end_term_evaluation')) && (
                        <div className="pt-4 border-t border-neutral-100 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="px-4 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Evaluations</p>
                            {activeEvents?.some(e => e.type === 'mid_term_evaluation') && (
                                <SidebarItem
                                    icon={<GraduationCap className="w-5 h-5" />}
                                    label="Mid-Term Eval"
                                    active={activeTab === 'mid-term'}
                                    onClick={() => selectTab('mid-term')}
                                />
                            )}
                            {activeEvents?.some(e => e.type === 'end_term_evaluation') && (
                                <SidebarItem
                                    icon={<Medal className="w-5 h-5" />}
                                    label="End-Term Eval"
                                    active={activeTab === 'end-term'}
                                    onClick={() => selectTab('end-term')}
                                />
                            )}
                        </div>
                    )}
                </nav>
                <div className="p-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 mb-4">
                        {user?.photoUrl ? (
                            <img src={user.photoUrl} alt={user?.name} className="h-9 w-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
                        ) : (
                            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm shrink-0">
                                {user?.name.charAt(0)}
                            </div>
                        )}
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-neutral-900 truncate">{user?.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <a
                        href="/userManual.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mb-2 flex items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all"
                    >
                        <FileText className="w-4 h-4" /> Help &amp; User Manual
                    </a>
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
                <header className="flex items-center h-16 px-4 sm:px-6 gap-2 border-b border-neutral-200 bg-white sticky top-0 z-10 justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                                <Menu className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-lg sm:text-xl font-bold text-neutral-800 flex items-center gap-2 min-w-0 truncate">
                            {activeTab === 'mentees' && viewGroup ? (
                                <>
                                    <span onClick={() => setViewGroup(null)} className="cursor-pointer hover:text-indigo-600 transition-colors shrink-0">My Mentees</span>
                                    <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
                                    <span className="text-neutral-900 truncate min-w-0">{viewGroup.name}</span>
                                </>
                            ) : (
                                activeTab === 'proposals' ? 'Project Proposals' :
                                    activeTab === 'mentees' ? 'My Mentees' :
                                        activeTab === 'directory' ? 'Student Directory' :
                                            activeTab === 'mid-term' ? 'Mid-Term Evaluation' :
                                                activeTab === 'end-term' ? 'End-Term Evaluation' :
                                                    activeTab === 'archive' ? 'Past Projects' :
                                                        'My Profile'
                            )}
                        </h1>
                    </div>
                    <GlobalEventBanner />
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {activeTab === 'archive' ? (
                        <div className="max-w-6xl mx-auto">
                            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex items-center gap-4 mb-6">
                                <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
                                    <Archive className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-neutral-900">Past Projects You Mentored</h2>
                                    <p className="text-xs text-neutral-500">Read-only archive of projects from prior semesters where you were the guide.</p>
                                </div>
                            </div>

                            {loadingArchive ? (
                                <div className="flex items-center justify-center h-48">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                                </div>
                            ) : archivedProjects.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-neutral-200 text-neutral-500 text-sm">
                                    No archived projects found for your account.
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                                            <tr>
                                                <th className="text-left px-4 py-3">Title</th>
                                                <th className="text-left px-4 py-3">Group</th>
                                                <th className="text-left px-4 py-3">Members</th>
                                                <th className="text-left px-4 py-3">Mid</th>
                                                <th className="text-left px-4 py-3">End</th>
                                                <th className="text-left px-4 py-3">Final</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {archivedProjects.map((p: any) => {
                                                const g = p.group || {};
                                                const liveMembers: any[] = g.members || [];
                                                const members: any[] = liveMembers.length > 0
                                                    ? liveMembers
                                                    : (p.archivedMembers || []);
                                                const groupName = g.name || p.archivedGroupName || '—';
                                                return (
                                                    <tr key={p._id} className="border-t border-neutral-100 hover:bg-neutral-50 align-top">
                                                        <td className="px-4 py-3 font-semibold text-neutral-900">{p.title || '—'}</td>
                                                        <td className="px-4 py-3 text-neutral-700">{groupName}</td>
                                                        <td className="px-4 py-3 text-neutral-700">
                                                            {members.length === 0 ? '—' : (
                                                                <div className="space-y-0.5 text-xs">
                                                                    {members.map((m: any, i: number) => (
                                                                        <div key={m._id || m.rollNumber || m.email || i}>{m.name} <span className="text-neutral-400">({m.rollNumber || '—'})</span></div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-neutral-700">{p.midTermEvaluation?.totalMarks ?? '—'}</td>
                                                        <td className="px-4 py-3 text-neutral-700">{p.endTermEvaluation?.totalMarks ?? '—'}</td>
                                                        <td className="px-4 py-3 text-neutral-700">{p.finalReportEvaluation?.totalMarks ?? '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'profile' ? (
                        /* Profile View */
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-white p-6 sm:p-10 rounded-3xl border border-neutral-200 shadow-sm text-center">
                                <div className="relative inline-block mb-6">
                                    {user?.photoUrl ? (
                                        <img src={user.photoUrl} alt={user.name} className="h-24 w-24 rounded-full object-cover border-4 border-indigo-100 shadow-md mx-auto" />
                                    ) : (
                                        <div className="h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl mx-auto">
                                            {user?.name.charAt(0)}
                                        </div>
                                    )}
                                    <label className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-1.5 cursor-pointer hover:bg-indigo-700 shadow-md" title="Upload photo">
                                        <Settings className="w-3.5 h-3.5" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const fd = new FormData();
                                                fd.append('photo', file);
                                                try {
                                                    await api.post('/users/profile-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                    window.location.reload();
                                                } catch { alert('Photo upload failed'); }
                                            }}
                                        />
                                    </label>
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
                                                        {participatingBatchYears.map(y => (
                                                            <option key={y} value={y}>{y}</option>
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

                                                    {['mid-term', 'end-term'].includes(activeTab) ? (
                                                        <CustomBatchDropdown
                                                            value={filterBatch}
                                                            onChange={setFilterBatch}
                                                            panelGroups={panelGroups}
                                                        />
                                                    ) : (
                                                        <select
                                                            className="px-3 py-2 bg-white rounded-xl border border-neutral-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                                                            value={filterBatch}
                                                            onChange={(e) => setFilterBatch(e.target.value)}
                                                        >
                                                            <option value="All">Batch: All</option>
                                                            {participatingBatchYears.map(year => (
                                                                <option key={year} value={year}>{year}-{parseInt(year) + 4}</option>
                                                            ))}
                                                        </select>
                                                    )}
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
                                                (() => {
                                                    // Dynamically groups them based on existing mentees
                                                    let batchesToRender: string[] = [];
                                                    if (filterBatch !== 'All') {
                                                        batchesToRender = [filterBatch];
                                                    } else {
                                                        const batches = new Set<string>();
                                                        displayItems.forEach((item: any) => {
                                                            const groupData = item.group || item;
                                                            if (groupData.targetBatch) {
                                                                batches.add(groupData.targetBatch.toString());
                                                            } else {
                                                                const members = groupData.members || [];
                                                                const hasRoll = members.find((m: any) => m.rollNumber);
                                                                if (hasRoll) {
                                                                    const prefix = hasRoll.rollNumber.substring(0, 2);
                                                                    batches.add('20' + prefix);
                                                                } else {
                                                                    batches.add('Unknown');
                                                                }
                                                            }
                                                        });
                                                        batchesToRender = Array.from(batches).sort().reverse();
                                                    }

                                                    return batchesToRender.map(batchKey => {
                                                        const batchMentees = filterBatch === 'All'
                                                            ? displayItems.filter((item: any) => {
                                                                const groupData = item.group || item;
                                                                if (groupData.targetBatch) {
                                                                    return groupData.targetBatch.toString() === batchKey;
                                                                }
                                                                const members = groupData.members || [];
                                                                const hasRoll = members.find((m: any) => m.rollNumber);
                                                                if (batchKey === 'Unknown') return !hasRoll;
                                                                return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchKey.slice(2)));
                                                            })
                                                            : displayItems;

                                                        if (batchMentees.length === 0) return null;

                                                        const teamsCount = batchMentees.length;
                                                        const studentsCount = batchMentees.reduce((acc: number, item: any) => acc + (item.members?.length || item.group?.members?.length || 0), 0);

                                                        return (
                                                            <div key={batchKey} className="space-y-6">
                                                                {(filterBatch === 'All' || batchKey === 'Unknown') && (
                                                                    <div
                                                                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all group select-none relative overflow-hidden ${isBatchExpanded(batchKey) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50'}`}
                                                                        onClick={() => toggleBatch(batchKey)}
                                                                    >
                                                                        {isBatchExpanded(batchKey) && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>}
                                                                        <div className="flex items-center gap-4 pl-2">
                                                                            <div className={`p-2 rounded-xl transition-colors ${isBatchExpanded(batchKey) ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                                                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${!isBatchExpanded(batchKey) ? '-rotate-90' : ''}`} />
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="text-xl font-bold text-neutral-900">{batchKey === 'Unknown' ? 'Other/Uncategorized' : `Batch ${batchKey}-${parseInt(batchKey) + 4}`}</h3>
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

                                                                {(isBatchExpanded(batchKey) || filterBatch !== 'All') && (
                                                                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full text-left">
                                                                                <thead className="bg-neutral-50 border-b border-neutral-100">
                                                                                    <tr>
                                                                                        <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider w-1/3">Project Details</th>
                                                                                        <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Members</th>
                                                                                        <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                                                                                        <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider">Last Update</th>
                                                                                        <th className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Action</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-neutral-100">
                                                                                    {batchMentees.map((item: any) => {
                                                                                        const groupData = item.group || item;
                                                                                        const isDropper = groupData?.targetBatch && groupData.targetBatch !== getOriginalGroupBatchYear(groupData);
                                                                                        return (
                                                                                            <tr
                                                                                                key={item._id}
                                                                                                onClick={() => handleGroupClick(item)}
                                                                                                className={`cursor-pointer transition-all group relative overflow-hidden ${item.project?.hasNewUpdate
                                                                                                    ? 'bg-amber-50/50 hover:bg-amber-50'
                                                                                                    : isDropper ? 'bg-red-50/30 hover:bg-red-50' : 'bg-white hover:bg-neutral-50'}`}
                                                                                            >
                                                                                                {item.project?.hasNewUpdate ? (
                                                                                                    <td className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 animate-pulse"></td>
                                                                                                ) : isDropper ? (
                                                                                                    <td className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></td>
                                                                                                ) : null}
                                                                                                <td className="px-4 py-3">
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
                                                                                                        <span className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 ${isDropper ? 'text-red-700 font-bold' : 'text-neutral-500'}`}>
                                                                                                            <Users className={`w-3 h-3 ${isDropper ? 'text-red-400' : ''}`} />
                                                                                                            <span className="truncate">
                                                                                                                {item.name}
                                                                                                                {isDropper && ` (Dropper/Batch override: ${groupData.targetBatch})`}
                                                                                                            </span>
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
                                                                                                <td className="px-4 py-3">
                                                                                                    <div className="flex flex-col space-y-1">
                                                                                                        {(item.members || item.group?.members || []).map((m: any, idx: number) => (
                                                                                                            <div key={idx} className="flex items-center gap-2">
                                                                                                                <span className="text-sm font-medium text-neutral-700">{m.name || 'Unknown'}</span>
                                                                                                                {m.rollNumber && <span className="text-[11px] text-neutral-400 font-mono">({m.rollNumber})</span>}
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td className="px-4 py-3">
                                                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${(item.status || item.project?.status) === 'Approved' ? 'bg-green-100 text-green-700' :
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
                                                                                                <td className="px-4 py-3 text-sm text-neutral-500 font-mono text-xs">
                                                                                                    {new Date(item.project?.updatedAt || item.createdAt).toLocaleDateString()}
                                                                                                </td>
                                                                                                <td className="px-4 py-3 text-right">
                                                                                                    <div className="inline-flex items-center gap-1 text-indigo-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                        View <ChevronRight className="w-3 h-3" />
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })())}
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
                                                        const groupData = item.group || item;
                                                        if (groupData.targetBatch) {
                                                            return groupData.targetBatch.toString() === batchYear.toString();
                                                        }
                                                        const members = groupData.members || [];
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

                                                                            const panelId = pData.panel._id;
                                                                            return (
                                                                                <div key={idx} className="border-t border-indigo-100 pt-6 mt-6 first:mt-0 first:border-0 first:pt-0">
                                                                                    {/* Per-panel bulk actions toolbar */}
                                                                                    <div className="mb-5 flex flex-col xl:flex-row xl:items-center gap-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                                                                                        <div className="flex items-center gap-3 mr-auto flex-wrap">
                                                                                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">EVALUATIONS</span>
                                                                                            <div className="flex items-center gap-2 border-l border-indigo-200 pl-3">
                                                                                                <button
                                                                                                    onClick={() => setManualMarksMode(!manualMarksMode)}
                                                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${manualMarksMode ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                                                                                                >
                                                                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${manualMarksMode ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                                                                                </button>
                                                                                                <span className="text-[10px] font-bold text-neutral-600 select-none cursor-pointer uppercase tracking-wider" onClick={() => setManualMarksMode(!manualMarksMode)}>
                                                                                                    {manualMarksMode ? 'Direct Mode' : 'Rubric Mode'}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex flex-wrap items-center gap-3 mt-3 xl:mt-0">
                                                                                            <button
                                                                                                onClick={() => handleDownloadTemplate(panelId, manualMarksMode ? 'direct' : 'rubric')}
                                                                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                                                                                            >
                                                                                                <Download className="w-3.5 h-3.5" /> Download Template
                                                                                            </button>
                                                                                            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer shadow-sm transition-colors ${importingPanelId === panelId ? 'bg-neutral-100 text-neutral-400 border border-neutral-200' : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                                                                                                <Upload className="w-3.5 h-3.5" />
                                                                                                {importingPanelId === panelId ? 'Uploading...' : 'Upload Evaluations'}
                                                                                                <input
                                                                                                    type="file"
                                                                                                    accept=".xlsx"
                                                                                                    className="hidden"
                                                                                                    disabled={!!importingPanelId}
                                                                                                    onChange={(e) => {
                                                                                                        const f = e.target.files?.[0];
                                                                                                        if (f) { setImportErrors([]); setImportSuccess(null); handleImportTemplate(panelId, f, manualMarksMode ? 'direct' : 'rubric'); }
                                                                                                        e.target.value = '';
                                                                                                    }}
                                                                                                />
                                                                                            </label>
                                                                                            <button
                                                                                                onClick={() => handleExportFinalSheet(panelId)}
                                                                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors shadow-sm"
                                                                                            >
                                                                                                <FileText className="w-3.5 h-3.5" /> Export Final Sheet
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                    {/* Import result feedback */}
                                                                                    {importSuccess && (
                                                                                        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
                                                                                            <CheckCircle className="w-4 h-4 shrink-0" /> {importSuccess}
                                                                                        </div>
                                                                                    )}
                                                                                    {importErrors.length > 0 && (
                                                                                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                                                                                            <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                                                                                                <AlertCircle className="w-4 h-4" /> {importErrors.length} error(s) found — no data was saved
                                                                                            </div>
                                                                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                                                                {importErrors.map((e, i) => (
                                                                                                    <p key={i} className="text-xs text-red-600">
                                                                                                        {e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}
                                                                                                    </p>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
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
                                                                                                        {facInfo.photoUrl ? (
                                                                                                            <img src={facInfo.photoUrl} alt={facInfo.name} className="w-8 h-8 rounded-full object-cover border border-indigo-200 shrink-0" />
                                                                                                        ) : (
                                                                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                                                                                                {facInfo.name.charAt(0)}
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {facInfo.name}'s Group
                                                                                                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronUp className="w-4 h-4 text-neutral-400" />}
                                                                                                    </h5>
                                                                                                    <span className="text-xs font-bold bg-neutral-200 text-neutral-600 px-3 py-1 rounded-full uppercase tracking-wider">{facInfo.groups.length} Teams</span>
                                                                                                </div>
                                                                                                {!isCollapsed && (
                                                                                                    <div className={viewMode === 'grid' ? 'p-6 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 auto-rows-fr' : 'divide-y divide-neutral-100'}>
                                                                                                        {facInfo.groups.map((item: any) => renderEvalCard(item, activeTab, handleOpenEvaluation, activeEvents, true, viewMode))}
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
                                                                <div className="w-full xl:w-64 shrink-0 sticky top-24 space-y-6">
                                                                    {panelGroupsInBatch.map((pData: any, idx: number) => (
                                                                        <div key={idx} className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
                                                                            <div className="flex bg-indigo-600 px-6 py-5 items-center justify-around">
                                                                                <h4 className="text-white font-bold flex items-center gap-3">
                                                                                    <Users className="w-5 h-5 text-indigo-200" />
                                                                                    Panel {pData.panelNumber || pData.panel?.panelNumber}
                                                                                    {pData.panel?.room && (
                                                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-white-200 text-indigo-700 rounded-lg text-xs font-bold w-fit">
                                                                                            <span>Room No: {pData.panel.room}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </h4>


                                                                            </div>

                                                                            <div className="p-6">
                                                                                <div className="mb-6 last:mb-0">

                                                                                    <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Panel Members</h5>
                                                                                    <div className="space-y-4">
                                                                                        {pData.panel.faculty?.map((fac: any, fIdx: number) => (
                                                                                            <div key={fIdx} className="flex items-center gap-3">
                                                                                                {fac.photoUrl ? (
                                                                                                    <img src={fac.photoUrl} alt={fac.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-indigo-100 shrink-0" />
                                                                                                ) : (
                                                                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm ring-1 ring-indigo-100 shrink-0">
                                                                                                        {fac.name?.charAt(0) || '?'}
                                                                                                    </div>
                                                                                                )}
                                                                                                <div className="flex-1 min-w-0">
                                                                                                    <p className="text-sm font-bold text-neutral-900 break-words line-clamp-2 leading-tight mb-0.5">{fac.name}</p>
                                                                                                    <p className="text-xs text-neutral-500 truncate" title={fac.email}>{fac.email}</p>
                                                                                                </div>

                                                                                            </div>

                                                                                        ))}

                                                                                    </div>

                                                                                </div>

                                                                            </div>

                                                                        </div>

                                                                    ))}
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
                                                    {(() => {
                                                        const batches = new Set<string>();
                                                        displayItems.forEach((item: any) => {
                                                            const groupData = item.group || item;
                                                            if (groupData.targetBatch) {
                                                                batches.add(groupData.targetBatch.toString());
                                                            } else {
                                                                const members = groupData.members || [];
                                                                const hasRoll = members.find((m: any) => m.rollNumber);
                                                                if (hasRoll) {
                                                                    const prefix = hasRoll.rollNumber.substring(0, 2);
                                                                    batches.add('20' + prefix);
                                                                } else {
                                                                    batches.add('Unknown');
                                                                }
                                                            }
                                                        });

                                                        const batchesToRender = Array.from(batches).sort().reverse();

                                                        return batchesToRender.map(batchKey => {
                                                            const batchMentees = displayItems.filter((item: any) => {
                                                                const groupData = item.group || item;
                                                                if (groupData.targetBatch) {
                                                                    return groupData.targetBatch.toString() === batchKey;
                                                                }
                                                                const members = groupData.members || [];
                                                                const hasRoll = members.find((m: any) => m.rollNumber);
                                                                if (batchKey === 'Unknown') return !hasRoll;
                                                                return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchKey.slice(2)));
                                                            });

                                                            if (batchMentees.length === 0) return null;

                                                            const teamsCount = batchMentees.length;
                                                            const studentsCount = batchMentees.reduce((acc: number, item: any) => acc + (item.members?.length || item.group?.members?.length || 0), 0);

                                                            return (
                                                                <div key={batchKey} className="space-y-6">
                                                                    <div
                                                                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all group select-none relative overflow-hidden ${isBatchExpanded(batchKey) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50'}`}
                                                                        onClick={() => toggleBatch(batchKey)}
                                                                    >
                                                                        {isBatchExpanded(batchKey) && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>}
                                                                        <div className="flex items-center gap-4 pl-2">
                                                                            <div className={`p-2 rounded-xl transition-colors ${isBatchExpanded(batchKey) ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                                                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${!isBatchExpanded(batchKey) ? '-rotate-90' : ''}`} />
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="text-xl font-bold text-neutral-900">{batchKey === 'Unknown' ? 'Other/Uncategorized' : `Batch ${batchKey}`}</h3>
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
                                                                    {isBatchExpanded(batchKey) && (
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
                                                        });
                                                    })()}
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
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-4xl bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[90vh] flex flex-col focus:outline-none border border-neutral-100">
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
                                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">G-{selectedProject?.group?.name || 'TBD'}</span>
                                        <span className="text-[10px] text-neutral-400 font-medium">• Submitted {new Date(selectedProject?.createdAt || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <Dialog.Close className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </Dialog.Close>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                            {/* Left Side: Details & Team */}
                            <div className="lg:w-3/5 p-6 sm:p-8 overflow-y-auto space-y-10 border-r border-neutral-100 bg-white custom-scrollbar">
                                <div>
                                    <h4 className="flex items-center gap-3 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-5">
                                        Project Overview
                                        <div className="h-px flex-1 bg-neutral-100"></div>
                                    </h4>
                                    <p className="text-neutral-700 leading-relaxed text-sm whitespace-pre-wrap">
                                        {selectedProject?.description || "No description provided."}
                                    </p>
                                </div>

                                {(selectedProject?.tags?.filter((t: string) => t && t.trim()).length ?? 0) > 0 && (
                                    <div>
                                        <h4 className="flex items-center gap-3 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-4">
                                            Technologies & Focus
                                            <div className="h-px flex-1 bg-neutral-100"></div>
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedProject?.tags?.filter((t: string) => t && t.trim()).map((tag: string, i: number) => (
                                                <span key={i} className="px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold transition-all hover:bg-indigo-600 hover:text-white hover:border-indigo-600 cursor-default">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="flex items-center gap-3 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-5">
                                        Team Composition
                                        <div className="h-px flex-1 bg-neutral-100"></div>
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {selectedProject?.group?.members?.map((m: any, idx: number) => (
                                            <div key={m._id} className="flex items-center gap-4 p-4 bg-neutral-50 border border-neutral-100 rounded-[24px] hover:bg-white hover:border-indigo-200 transition-all cursor-default shadow-sm hover:shadow-md">
                                                {m.photoUrl ? (
                                                    <img src={m.photoUrl} alt={m.name} className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-indigo-100 shrink-0 border border-neutral-200" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-100 shrink-0">
                                                        {m.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-neutral-900 text-sm truncate mb-0.5">{m.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] text-neutral-500 font-mono items-center flex gap-1 font-bold">
                                                            {m.rollNumber}
                                                        </p>
                                                        {idx === 0 && <span className="text-[9px] bg-neutral-900 text-white px-1.5 py-0.5 rounded-md font-black tracking-tighter shadow-sm shrink-0">LEADER</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="lg:w-2/5 p-6 sm:p-8 bg-neutral-50/50 overflow-y-auto space-y-10 border-l border-neutral-100">
                                <div>
                                    <h4 className="flex items-center gap-3 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-5 px-1">
                                        Project Assets
                                        <div className="h-px flex-1 bg-neutral-200/50"></div>
                                    </h4>
                                    {selectedProject?.attachments && selectedProject.attachments.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedProject.attachments.map((url: string, i: number) => {
                                                const fileName = url.split('/').pop()?.split('-').pop() || `File ${i + 1}`;
                                                const isLink = url.startsWith('http') && !url.includes('/uploads/');
                                                return (
                                                    <a
                                                        key={i}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-4 p-4 bg-white border border-neutral-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/5 group transition-all"
                                                    >
                                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors border border-indigo-100/50">
                                                            {isLink ? <Layout className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-neutral-900 truncate mb-0.5">
                                                                {isLink ? "External Resource" : fileName}
                                                            </p>
                                                            <p className="text-[9px] text-neutral-400 font-black uppercase tracking-widest leading-none">
                                                                {isLink ? "Digital Link" : "Document Asset"}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-6 sm:p-10 border-2 border-dashed border-neutral-200 rounded-3xl text-center bg-white/50 backdrop-blur-sm">
                                            <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-300">
                                                <Archive className="w-6 h-6" />
                                            </div>
                                            <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">No Attachments</p>
                                        </div>
                                    )}
                                </div>

                                {/* Review Area */}
                                <div className="pt-6 border-t border-neutral-200">
                                    <h4 className="flex items-center gap-2 text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Project Action</h4>

                                    {(selectedProject?.status === 'Pending' || (selectedProject?.status as any) === 'Draft' || (selectedProject?.status as any) === 'Rejected') ? (
                                        <div className="flex flex-col gap-4">
                                            <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1">Review & Decision</label>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <textarea
                                                        value={feedback}
                                                        onChange={(e) => setFeedback(e.target.value)}
                                                        placeholder="Add remarks or reasons for feedback..."
                                                        className="w-full px-5 py-4 rounded-3xl border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white text-sm transition-all h-[152px] resize-none shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-3 shrink-0 w-32">
                                                    <button
                                                        onClick={() => selectedProject && handleAction(selectedProject._id, 'Approved')}
                                                        disabled={!!actionLoading}
                                                        className="flex-1 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all flex flex-col items-center justify-center gap-2 active:scale-95 disabled:opacity-50 group"
                                                    >
                                                        {actionLoading === 'Approved' ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <><CheckCircle className="w-6 h-6 transition-transform group-hover:scale-110" /> Approve</>}
                                                    </button>
                                                    <button
                                                        onClick={() => selectedProject && handleAction(selectedProject._id, 'Rejected')}
                                                        disabled={!!actionLoading}
                                                        className="flex-1 px-4 bg-white border-2 border-red-50 text-red-500 hover:bg-red-50 hover:border-red-100 hover:text-red-600 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 active:scale-95 disabled:opacity-50 group"
                                                    >
                                                        {actionLoading === 'Rejected' ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500/30 border-t-red-500" /> : <><XCircle className="w-6 h-6 transition-transform group-hover:scale-110" /> Reject</>}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (selectedProject?.group?._id) {
                                                    navigate(`/faculty/group/${selectedProject.group._id}`);
                                                }
                                            }}
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            Jump to Dashboard <ChevronRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Evaluation Modal */}
            <Dialog.Root open={!!evaluatingProject} onOpenChange={(open) => !open && setEvaluatingProject(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-[1300px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col focus:outline-none max-h-[92vh]">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0 gap-4">
                            <div>
                                <Dialog.Title className="text-lg font-bold text-neutral-900 flex items-center gap-3">
                                    {evaluationType === 'mid-term' ? 'Mid-Term Evaluation' : 'End-Term Evaluation'}
                                    {evaluatingProject && (
                                        <span className="text-sm font-normal text-neutral-500">
                                            — Group {evaluatingProject.name || evaluatingProject.group?.name} · {evaluatingProject.project?.title || evaluatingProject.title}
                                        </span>
                                    )}
                                </Dialog.Title>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setManualMarksMode(!manualMarksMode)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manualMarksMode ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manualMarksMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-sm font-medium text-neutral-600 select-none cursor-pointer" onClick={() => setManualMarksMode(!manualMarksMode)}>
                                    {manualMarksMode ? 'Direct Marks Entry' : 'Rubric Mode'}
                                </span>
                                <div className="h-6 w-px bg-neutral-200"></div>
                                <Dialog.Close className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                                    <X className="w-5 h-5 text-neutral-500" />
                                </Dialog.Close>
                            </div>
                        </div>

                        {/* Table area */}
                        <div className="flex-1 overflow-auto p-4 space-y-5">
                            {(() => {
                                const members = evaluatingProject?.members || evaluatingProject?.group?.members || [];
                                if (members.length === 0) return <div className="p-8 text-center text-neutral-500">No members found.</div>;

                                // One wide table: students × rows, Guide + E1 + E2 as column groups
                                const renderEvalTable = (
                                    blockLabel: string,
                                    evalT: 'mid-term' | 'end-term',
                                    dataMap: Record<string, EvalStudentEntry>,
                                    setDataMap: (fn: (p: Record<string, EvalStudentEntry>) => Record<string, EvalStudentEntry>) => void
                                ) => {
                                    const config = getRubricConfig(activeEvents, evalT);
                                    if (!config) return null;
                                    const guideFields = config.sections.find((s: any) => s.key === 'guide')?.fields || [];
                                    const panelFields = config.sections.find((s: any) => s.key === 'panel')?.fields || [];
                                    const empty = { stars: 0, attendance: 'present' as const, guide: {}, panel1: {}, panel2: {} };

                                    return (
                                        <div className="rounded-xl border border-neutral-200 overflow-hidden">
                                            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-xs font-black uppercase tracking-wider text-neutral-600">{blockLabel}</div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead className="sticky top-0 z-10 bg-white">
                                                        <tr className="border-b border-neutral-200">
                                                            <th rowSpan={manualMarksMode ? 1 : 2} className="px-3 py-2 text-left text-[11px] font-bold text-neutral-700 border-r border-neutral-200 w-32 align-middle">Student</th>
                                                            <th rowSpan={manualMarksMode ? 1 : 2} className="px-2 py-2 text-center text-[11px] font-bold text-neutral-600 border-r border-neutral-200 w-24 align-middle">Attendance</th>
                                                            <th rowSpan={manualMarksMode ? 1 : 2} className="px-2 py-2 text-center text-[11px] font-bold text-neutral-600 border-r border-neutral-200 w-20 align-middle">Stars</th>
                                                            {manualMarksMode ? (
                                                                <>
                                                                    <th className="px-2 py-2 text-center text-[11px] font-black text-indigo-700 bg-indigo-50 border-r border-indigo-200 w-24">Guide Score</th>
                                                                    <th className="px-2 py-2 text-center text-[11px] font-black text-emerald-700 bg-emerald-50 border-r border-emerald-200 w-24">E1 Score</th>
                                                                    <th className="px-2 py-2 text-center text-[11px] font-black text-amber-700 bg-amber-50 border-r border-amber-200 w-24">E2 Score</th>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {guideFields.length > 0 && <th colSpan={guideFields.length} className="px-2 py-1 text-center text-[11px] font-black text-indigo-700 bg-indigo-50 border-r border-indigo-200">Guide</th>}
                                                                    {panelFields.length > 0 && <th colSpan={panelFields.length} className="px-2 py-1 text-center text-[11px] font-black text-amber-700 bg-amber-50 border-r border-amber-200">Panel (E1 / E2)</th>}
                                                                </>
                                                            )}
                                                            <th rowSpan={manualMarksMode ? 1 : 2} className="px-2 py-2 text-center text-[11px] font-bold text-neutral-500 border-l border-neutral-200 w-14 align-middle">Total</th>
                                                        </tr>
                                                        {!manualMarksMode && (
                                                            <tr className="border-b border-neutral-200">
                                                                {guideFields.map((f: any) => (
                                                                    <th key={f.key} className="px-1 py-1 text-center text-[10px] font-bold text-indigo-600 bg-indigo-50/60 border-r border-indigo-100 max-w-[80px]">
                                                                        <div>{f.label}</div><div className="font-normal text-indigo-400">/{f.max}</div>
                                                                    </th>
                                                                ))}
                                                                {panelFields.map((f: any) => (
                                                                    <th key={f.key} className="px-1 py-1 text-center text-[10px] font-bold text-amber-600 bg-amber-50/60 border-r border-amber-100 max-w-[80px]">
                                                                        <div>{f.label}</div><div className="font-normal text-amber-400">/{f.max}</div>
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        )}
                                                    </thead>
                                                    <tbody>
                                                        {members.map((m: any, mi: number) => {
                                                            const sd = dataMap[m._id] || empty;
                                                            const gTotal = guideFields.reduce((s: number, f: any) => s + Number(sd.guide?.[f.key] || 0), 0);
                                                            const p1Total = panelFields.reduce((s: number, f: any) => s + Number(sd.panel1?.[f.key] || 0), 0);
                                                            const p2Total = panelFields.reduce((s: number, f: any) => s + Number(sd.panel2?.[f.key] || 0), 0);
                                                            const rowTotal = gTotal + (p2Total > 0 ? (p1Total + p2Total) / 2 : p1Total);
                                                            const upd = (patch: Partial<EvalStudentEntry>) =>
                                                                setDataMap(prev => ({ ...prev, [m._id]: { ...prev[m._id], ...patch } }));

                                                            const gMaxSum = guideFields.reduce((s: number, f: any) => s + f.max, 0);
                                                            const pMaxSum = panelFields.reduce((s: number, f: any) => s + f.max, 0);
                                                            // A field stored as a number (including 0) means a record exists; '' means not yet evaluated
                                                            const hasGuideData = guideFields.some((f: any) => typeof sd.guide?.[f.key] === 'number');
                                                            const hasPanel1Data = panelFields.some((f: any) => typeof sd.panel1?.[f.key] === 'number');
                                                            const hasPanel2Data = panelFields.some((f: any) => typeof sd.panel2?.[f.key] === 'number');
                                                            const hasAnyData = hasGuideData || hasPanel1Data;

                                                            const handleDirectDistribute = (val: number, fields: any[], targetKey: 'guide' | 'panel1' | 'panel2', maxSum: number) => {
                                                                const newSubMap: Record<string, number> = {};
                                                                if (val === 0 || maxSum === 0) {
                                                                    fields.forEach((f: any) => newSubMap[f.key] = 0);
                                                                } else {
                                                                    let remaining = val;
                                                                    fields.forEach((f: any, idx: number) => {
                                                                        if (idx === fields.length - 1) {
                                                                            newSubMap[f.key] = Number(remaining.toFixed(2));
                                                                        } else {
                                                                            const fieldVal = (val / maxSum) * f.max;
                                                                            newSubMap[f.key] = Number(fieldVal.toFixed(2));
                                                                            remaining -= newSubMap[f.key];
                                                                        }
                                                                    });
                                                                }
                                                                upd({ [targetKey]: { ...sd[targetKey], ...newSubMap } });
                                                            };

                                                            return (
                                                                <tr key={m._id} className={`border-b border-neutral-100 ${mi % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'} hover:bg-indigo-50/10`}>
                                                                    <td className="px-3 py-2 border-r border-neutral-200">
                                                                        <div className="font-semibold text-xs text-neutral-900">{m.name}</div>
                                                                        <div className="text-[10px] text-neutral-400">{m.rollNumber}</div>
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-center border-r border-neutral-200">
                                                                        <button type="button" onClick={() => upd({ attendance: sd.attendance === 'present' ? 'absent' : 'present' })}
                                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${sd.attendance === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                            {sd.attendance === 'present' ? '✓ P' : '✗ A'}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-center border-r border-neutral-200">
                                                                        <div className="flex justify-center gap-0">
                                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                                <button key={s} type="button" onClick={() => upd({ stars: s })}
                                                                                    className={`text-sm leading-none ${s <= sd.stars ? 'text-amber-400' : 'text-neutral-300 hover:text-amber-300'}`}>★</button>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    {manualMarksMode ? (
                                                                        <>
                                                                            <td className="px-2 py-1 border-r border-indigo-100 text-center relative">
                                                                                <input type="number" min={0} max={gMaxSum} value={hasGuideData ? Number(gTotal.toFixed(1)) : ''}
                                                                                    onChange={e => { const v = e.target.value === '' ? 0 : Math.min(Number(e.target.value), gMaxSum); handleDirectDistribute(v, guideFields, 'guide', gMaxSum); }}
                                                                                    className="w-16 px-1 py-1 text-center text-sm font-bold border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" placeholder="—" />
                                                                                <div className="text-[9px] text-indigo-400 font-bold mt-1">/{gMaxSum}</div>
                                                                            </td>
                                                                            <td className="px-2 py-1 border-r border-emerald-100 text-center relative">
                                                                                <input type="number" min={0} max={pMaxSum} value={hasPanel1Data ? Number(p1Total.toFixed(1)) : ''}
                                                                                    onChange={e => { const v = e.target.value === '' ? 0 : Math.min(Number(e.target.value), pMaxSum); handleDirectDistribute(v, panelFields, 'panel1', pMaxSum); }}
                                                                                    className="w-16 px-1 py-1 text-center text-sm font-bold border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white" placeholder="—" />
                                                                                <div className="text-[9px] text-emerald-400 font-bold mt-1">/{pMaxSum}</div>
                                                                            </td>
                                                                            <td className="px-2 py-1 border-r border-amber-100 text-center relative">
                                                                                <input type="number" min={0} max={pMaxSum} value={hasPanel2Data ? Number(p2Total.toFixed(1)) : ''}
                                                                                    onChange={e => { const v = e.target.value === '' ? 0 : Math.min(Number(e.target.value), pMaxSum); handleDirectDistribute(v, panelFields, 'panel2', pMaxSum); }}
                                                                                    className="w-16 px-1 py-1 text-center text-sm font-bold border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" placeholder="—" />
                                                                                <div className="text-[9px] text-amber-400 font-bold mt-1">/{pMaxSum}</div>
                                                                            </td>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {guideFields.map((f: any) => (
                                                                                <td key={f.key} className="px-1 py-1 border-r border-indigo-100 text-center">
                                                                                    <input type="number" min={0} max={f.max} value={sd.guide?.[f.key] ?? ''}
                                                                                        onChange={e => { const v = e.target.value === '' ? '' : Math.min(Number(e.target.value), f.max); upd({ guide: { ...sd.guide, [f.key]: v } }); }}
                                                                                        className="w-12 px-1 py-0.5 text-center text-sm font-bold border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" placeholder="—" />
                                                                                </td>
                                                                            ))}
                                                                            {panelFields.map((f: any) => (
                                                                                <td key={f.key} className="px-1 py-1 border-r border-amber-100 text-center">
                                                                                    <div className="flex flex-col gap-0.5 items-center">
                                                                                        <div className="flex items-center gap-0.5">
                                                                                            <span className="text-[9px] font-bold text-emerald-500 w-4">E1</span>
                                                                                            <input type="number" min={0} max={f.max} value={sd.panel1?.[f.key] ?? ''}
                                                                                                onChange={e => { const v = e.target.value === '' ? '' : Math.min(Number(e.target.value), f.max); upd({ panel1: { ...sd.panel1, [f.key]: v } }); }}
                                                                                                className="w-10 px-1 py-0.5 text-center text-xs font-bold border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white" placeholder="—" />
                                                                                        </div>
                                                                                        <div className="flex items-center gap-0.5">
                                                                                            <span className="text-[9px] font-bold text-amber-500 w-4">E2</span>
                                                                                            <input type="number" min={0} max={f.max} value={sd.panel2?.[f.key] ?? ''}
                                                                                                onChange={e => { const v = e.target.value === '' ? '' : Math.min(Number(e.target.value), f.max); upd({ panel2: { ...sd.panel2, [f.key]: v } }); }}
                                                                                                className="w-10 px-1 py-0.5 text-center text-xs font-bold border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" placeholder="—" />
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            ))}
                                                                        </>
                                                                    )}
                                                                    <td className="px-2 py-2 text-center border-l border-neutral-200">
                                                                        <span className={`text-sm font-black ${hasAnyData ? 'text-indigo-700' : 'text-neutral-300'}`}>{hasAnyData ? Math.round(rowTotal * 10) / 10 : '—'}</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                };
                                return (
                                    <>
                                        {studentMidData && renderEvalTable('Mid-Term Scores (editing existing)', 'mid-term', studentMidData, fn => setStudentMidData(p => fn(p!)))}
                                        {renderEvalTable(evaluationType === 'end-term' ? 'End-Term Scores' : 'Mid-Term Scores', evaluationType as 'mid-term' | 'end-term', studentEvalData, setStudentEvalData)}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Footer: remarks + submit */}
                        <div className="shrink-0 border-t border-neutral-100 bg-neutral-50/50 px-6 py-4">
                            <div className="flex flex-col sm:flex-row gap-3 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-neutral-600 mb-1">Remarks (group-level)</label>
                                    <textarea
                                        value={evaluationRemarks}
                                        onChange={(e) => setEvaluationRemarks(e.target.value)}
                                        placeholder="Overall feedback for the group..."
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                    />
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => setEvaluatingProject(null)}
                                        className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-600 font-bold rounded-xl hover:bg-neutral-50 transition-colors text-sm">
                                        Cancel
                                    </button>
                                    <button onClick={handleSubmitEvaluation}
                                        className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm shadow-sm">
                                        <CheckCircle className="w-4 h-4" /> Submit
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
