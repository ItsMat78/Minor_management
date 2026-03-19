import React, { useState, useEffect } from 'react';
import { X, Users, GripVertical, AlertTriangle } from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FacultyWorkload {
    _id: string;
    name: string;
    email: string;
    groupCount: number;
}

interface DraftPanel {
    id: string;
    faculties: FacultyWorkload[];
}

interface AutoCreatePanelsModalProps {
    faculties: FacultyWorkload[];
    batchYear: number;
    onClose: () => void;
    onConfirm: (panels: { faculty: string[], batchYear: number, _id?: string }[]) => Promise<void>;
    isEditingMode?: boolean;
    initialPanels?: any[];
}

// Draggable Faculty Item Component
const DraggableFaculty = ({ faculty, panelId, isOverlay }: { faculty: FacultyWorkload, panelId: string, isOverlay?: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: faculty._id,
        data: {
            type: "Faculty",
            faculty,
            currentPanelId: panelId
        }
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    if (isOverlay) {
        style.transform = 'scale(1.02)';
        style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
        style.cursor = 'grabbing';
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 bg-white p-3 rounded-xl border ${isOverlay ? 'border-indigo-400' : 'border-neutral-200'} shadow-sm hover:border-indigo-300 transition-colors cursor-grab active:cursor-grabbing group`}
            {...listeners} {...attributes}
        >
            <div className="text-neutral-400 group-hover:text-indigo-500">
                <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-neutral-900 truncate">{faculty.name}</h5>
                <p className="text-xs text-neutral-500 truncate">{faculty.email}</p>
            </div>
            <div className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                {faculty.groupCount} Grps
            </div>
        </div>
    );
};

// Droppable Panel Component
const DroppablePanel = ({ panel, index, onDelete }: { panel: DraftPanel, index: number, onDelete: () => void }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: panel.id,
        data: {
            type: "Panel",
            panel
        }
    });

    const totalGroups = panel.faculties.reduce((sum, f) => sum + f.groupCount, 0);
    const isOvercrowded = panel.faculties.length > 3;

    return (
        <div
            ref={setNodeRef}
            className={`bg-neutral-50 rounded-2xl p-5 border-2 transition-colors ${isOver ? 'border-indigo-400 bg-indigo-50/30' : 'border-neutral-200'} ${isOvercrowded ? 'ring-2 ring-orange-400/50' : ''}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                        {index + 1}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-neutral-900">Panel {index + 1}</h4>
                        <p className="text-xs text-neutral-500">{panel.faculties.length} items • {totalGroups} groups</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {isOvercrowded && (
                        <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100 mr-1">
                            <AlertTriangle className="w-3 h-3" /> {'>'}3
                        </div>
                    )}
                    <button
                        onClick={onDelete}
                        className="text-neutral-400 hover:text-red-600 hover:bg-neutral-100 p-1.5 rounded-full text-sm transition-colors"
                        title="Delete Panel (Moves faculty to reserve)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-2 min-h-[60px]">
                <SortableContext items={panel.faculties.map(f => f._id)} strategy={verticalListSortingStrategy}>
                    {panel.faculties.map(f => (
                        <DraggableFaculty key={f._id} faculty={f} panelId={panel.id} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};

// New: Unallocated Sidebar Component
const UnallocatedSidebar = ({ faculties, onAutoAdjust }: { faculties: FacultyWorkload[], onAutoAdjust: () => void }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: "unallocated-sidebar",
        data: {
            type: "Sidebar",
        }
    });

    return (
        <div
            ref={setNodeRef}
            className={`w-80 bg-white border-l border-neutral-200 flex flex-col h-full transition-colors shrink-0 ${isOver ? 'bg-indigo-50/50' : ''}`}
        >
            <div className="p-6 border-b border-neutral-100 bg-neutral-50/30">
                <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" /> Reserve Faculty
                </h4>
                <p className="text-xs text-neutral-500 mt-1">Faculty with 0 groups or manually unallocated.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-neutral-100/10">
                <SortableContext items={faculties.map(f => f._id)} strategy={verticalListSortingStrategy}>
                    {faculties.map(f => (
                        <DraggableFaculty key={f._id} faculty={f} panelId="unallocated-sidebar" />
                    ))}
                    {faculties.length === 0 && (
                        <div className="h-32 border-2 border-dashed border-neutral-200 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                            <Users className="w-8 h-8 text-neutral-300 mb-2" />
                            <p className="text-xs font-medium text-neutral-400">All faculty members are currently assigned to panels.</p>
                        </div>
                    )}
                </SortableContext>
            </div>
            <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
                <button
                    onClick={onAutoAdjust}
                    disabled={faculties.length === 0}
                    className="w-full py-3 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                    <Users className="w-4 h-4" /> Auto-adjust remaining faculty
                </button>
            </div>
        </div>
    );
};

const AutoCreatePanelsModal: React.FC<AutoCreatePanelsModalProps> = ({ faculties, batchYear, onClose, onConfirm, isEditingMode, initialPanels }) => {
    const [draftPanels, setDraftPanels] = useState<DraftPanel[]>([]);
    const [unallocatedFaculties, setUnallocatedFaculties] = useState<FacultyWorkload[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasOvercrowded, setHasOvercrowded] = useState(false);
    const [activeFaculty, setActiveFaculty] = useState<FacultyWorkload | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const findContainer = (id: string) => {
        if (unallocatedFaculties.some(f => f._id === id)) return "unallocated-sidebar";
        const panel = draftPanels.find(p => p.faculties.some(f => f._id === id));
        return panel ? panel.id : null;
    };

    const deletePanel = (panelId: string) => {
        setDraftPanels(prev => {
            const panel = prev.find(p => p.id === panelId);
            if (panel) {
                setUnallocatedFaculties(u => [...u, ...panel.faculties]);
            }
            return prev.filter(p => p.id !== panelId);
        });
    };

    const clearAllPanels = async () => {
        if (!confirm("This will PERMANENTLY delete all panels for this batch from the database. Faculty will be returned to the reserve. Proceed?")) return;
        
        setIsSaving(true);
        try {
            await onConfirm([]);
            // onClose is usually handled by parent after onConfirm, but in some flows onConfirm might not close it.
            // On the parent side (AdminDashboard), confirmAutoCreatePanels calls setShowAutoCreateModal(false).
        } catch (e) {
            console.error(e);
            alert('Failed to clear panels.');
        } finally {
            setIsSaving(false);
        }
    };

    const autoFillReserve = () => {
        if (unallocatedFaculties.length === 0) return;

        setDraftPanels(prev => {
            const next = [...prev];
            const reserve = [...unallocatedFaculties];
            
            // Distribute as many as possible to panels with < 3 members
            for (let i = 0; i < next.length && reserve.length > 0; i++) {
                while (next[i].faculties.length < 3 && reserve.length > 0) {
                    next[i] = {
                        ...next[i],
                        faculties: [...next[i].faculties, reserve.shift()!]
                    };
                }
            }
            
            setUnallocatedFaculties(reserve);
            return next;
        });
    };

    useEffect(() => {
        if (isEditingMode && initialPanels) {
            setDraftPanels(initialPanels);
            // Any faculty from the provided list NOT in initialPanels should be unallocated
            const usedFacIds = new Set(initialPanels.flatMap(p => p.faculties.map((f: any) => f._id)));
            setUnallocatedFaculties(faculties.filter(f => !usedFacIds.has(f._id)));
            return;
        }

        // Logic: Exclude faculty with 0 groups from auto-selection
        const activeFacs = faculties.filter(f => f.groupCount > 0);
        const reserveFacs = faculties.filter(f => f.groupCount === 0);

        const sortedActive = [...activeFacs].sort((a, b) => b.groupCount - a.groupCount);

        // Form panels only for active faculty
        const N = Math.floor(sortedActive.length / 3);
        const panelsCount = N === 0 ? (sortedActive.length > 0 ? 1 : 0) : N;

        const initialDrafts: DraftPanel[] = Array.from({ length: panelsCount }, (_, i) => ({
            id: `panel-${i}`,
            faculties: []
        }));

        sortedActive.forEach(f => {
            const targetPanel = [...initialDrafts].sort((a, b) => {
                if (a.faculties.length !== b.faculties.length) {
                    return a.faculties.length - b.faculties.length;
                }
                const aGroups = a.faculties.reduce((sum, f) => sum + f.groupCount, 0);
                const bGroups = b.faculties.reduce((sum, f) => sum + f.groupCount, 0);
                return aGroups - bGroups;
            })[0];
            if (targetPanel) targetPanel.faculties.push(f);
        });

        setDraftPanels(initialDrafts);
        setUnallocatedFaculties(reserveFacs);
    }, [faculties, isEditingMode, initialPanels]);

    useEffect(() => {
        setHasOvercrowded(draftPanels.some(p => p.faculties.length > 3));
    }, [draftPanels]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveFaculty(active.data.current?.faculty as FacultyWorkload);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        if (activeId === overId) return;

        const isActiveFaculty = active.data.current?.type === "Faculty";
        if (!isActiveFaculty) return;

        const activeContainerId = findContainer(activeId);
        const isOverSidebar = over.data.current?.type === "Sidebar" || over.id === "unallocated-sidebar";
        const overContainerId = isOverSidebar ? "unallocated-sidebar" : (over.data.current?.type === "Panel" ? over.id : over.data.current?.currentPanelId);

        if (!activeContainerId || !overContainerId || activeContainerId === overContainerId) return;

        // Perform atomic move if moving between containers
        const facultyToMove = active.data.current?.faculty;

        // 1. Remove from source
        if (activeContainerId === "unallocated-sidebar") {
            setUnallocatedFaculties(prev => prev.filter(f => f._id !== activeId));
        } else {
            setDraftPanels(prev => prev.map(p => 
                p.id === activeContainerId 
                    ? { ...p, faculties: p.faculties.filter(f => f._id !== activeId) }
                    : p
            ));
        }

        // 2. Add to destination
        if (overContainerId === "unallocated-sidebar") {
            setUnallocatedFaculties(prev => {
                if (prev.some(f => f._id === activeId)) return prev;
                return [...prev, facultyToMove];
            });
        } else {
            setDraftPanels(prev => prev.map(p => {
                if (p.id !== overContainerId) return p;
                if (p.faculties.some(f => f._id === activeId)) return p;
                
                const nextFaculties = [...p.faculties];
                if (over.data.current?.type === "Faculty") {
                    const overIdx = nextFaculties.findIndex(f => f._id === overId);
                    nextFaculties.splice(overIdx, 0, facultyToMove);
                } else {
                    nextFaculties.push(facultyToMove);
                }
                return { ...p, faculties: nextFaculties };
            }));
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveFaculty(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        const activeContainerId = findContainer(activeId);
        const overContainerId = over.data.current?.currentPanelId || findContainer(overId) || over.id.toString();

        if (!activeContainerId || !overContainerId) return;

        if (activeContainerId === overContainerId && activeId !== overId) {
            if (activeContainerId === "unallocated-sidebar") {
                setUnallocatedFaculties(prev => {
                    const activeIndex = prev.findIndex(f => f._id === activeId);
                    const overIndex = prev.findIndex(f => f._id === overId);
                    if (activeIndex === -1 || overIndex === -1) return prev;
                    return arrayMove(prev, activeIndex, overIndex);
                });
            } else {
                setDraftPanels(prev => {
                    const panelIdx = prev.findIndex(p => p.id === activeContainerId);
                    if (panelIdx === -1) return prev;
                    const next = [...prev];
                    const activeIndex = next[panelIdx].faculties.findIndex(f => f._id === activeId);
                    const overIndex = next[panelIdx].faculties.findIndex(f => f._id === overId);
                    if (activeIndex === -1 || overIndex === -1) return prev;
                    next[panelIdx] = {
                        ...next[panelIdx],
                        faculties: arrayMove(next[panelIdx].faculties, activeIndex, overIndex)
                    };
                    return next;
                });
            }
        }
    };

    const handleConfirm = async () => {
        // ensure no empty panels
        const validPanels = draftPanels.filter(p => p.faculties.length > 0);
        if (validPanels.length === 0) {
            alert('No panels generated.');
            return;
        }

        const dataToSave = validPanels.map((p: any) => ({
            batchYear: batchYear,
            faculty: p.faculties.map((f: any) => f._id),
            ...(p._tempPanelId ? { _id: p._tempPanelId } : {})
        }));

        setIsSaving(true);
        try {
            await onConfirm(dataToSave);
        } catch (e) {
            console.error(e);
            alert('Failed to save some panels.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1400px] max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-neutral-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-neutral-900 flex items-center gap-3">
                            <Users className="w-6 h-6 text-indigo-600" /> {isEditingMode ? 'Edit Panels Interface' : 'Auto-Create Panels'}
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-base font-bold ml-2">Batch {batchYear}</span>
                        </h3>
                        <p className="text-sm text-neutral-500 mt-2">
                            {isEditingMode ? 'Drag and drop faculties to reposition them between panels, or add available active faculties.' : 'Review and adjust the intelligently allocated panel structure. Drag nodes to remap faculties.'}
                        </p>
                        {hasOvercrowded && (
                            <div className="mt-4 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 shadow-sm inline-flex">
                                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="text-xs font-bold text-orange-800 leading-tight">
                                    Notice: {isEditingMode ? "Some panels have more than 3 members." : "Unallocated faculty were merged into existing panels to maintain structural integrity."}
                                </span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-full transition-colors mr-2">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 bg-neutral-100/30">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex h-[550px] overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                            {/* Panels Grid */}
                            <div className="flex-1 overflow-y-auto p-6 bg-neutral-100/30 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                                        Panel Configuration
                                    </h4>
                                    {draftPanels.length > 0 && (
                                        <button
                                            onClick={clearAllPanels}
                                            className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5 border border-red-100"
                                        >
                                            <X className="w-3 h-3" /> Delete All Panels
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {draftPanels.map((p: any, i) => (
                                        <DroppablePanel key={p.id} panel={p} index={i} onDelete={() => deletePanel(p.id)} />
                                    ))}
                                    <div className="bg-neutral-50/50 rounded-2xl p-5 border-2 border-dashed border-neutral-300 flex items-center justify-center flex-col text-neutral-500 hover:bg-indigo-50/30 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer group" onClick={() => {
                                        setDraftPanels(prev => [...prev, { id: `new-panel-${Date.now()}`, faculties: [] }]);
                                    }}>
                                        <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <span className="font-bold text-sm">Add Empty Panel</span>
                                    </div>
                                </div>
                            </div>

                            {/* Unallocated Sidebar */}
                            <UnallocatedSidebar faculties={unallocatedFaculties} onAutoAdjust={autoFillReserve} />
                        </div>

                        <DragOverlay>
                            {activeFaculty ? (
                                <DraggableFaculty faculty={activeFaculty} panelId="" isOverlay />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>

                <div className="px-8 py-5 bg-white border-t border-gray-100 flex justify-end gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] focus:outline-none">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : null}
                        Confirm & Save Panels
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutoCreatePanelsModal;
