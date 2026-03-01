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
const DroppablePanel = ({ panel, index }: { panel: DraftPanel, index: number }) => {
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
                {isOvercrowded && (
                    <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100">
                        <AlertTriangle className="w-3 h-3" /> {'>'}3
                    </div>
                )}
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

const AutoCreatePanelsModal: React.FC<AutoCreatePanelsModalProps> = ({ faculties, batchYear, onClose, onConfirm, isEditingMode, initialPanels }) => {
    const [draftPanels, setDraftPanels] = useState<DraftPanel[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasOvercrowded, setHasOvercrowded] = useState(false);
    const [activeFaculty, setActiveFaculty] = useState<FacultyWorkload | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (isEditingMode && initialPanels) {
            setDraftPanels(initialPanels);
            return;
        }

        // Simple and smart auto-allocation logic
        const sortedFaculties = [...faculties].sort((a, b) => b.groupCount - a.groupCount);

        const N = Math.floor(sortedFaculties.length / 3);
        const panelsCount = N === 0 ? 1 : N;

        const initialDrafts: DraftPanel[] = Array.from({ length: panelsCount }, (_, i) => ({
            id: `panel-${i}`,
            faculties: []
        }));

        sortedFaculties.forEach(f => {
            // Pick a panel with least faculties first, if tied, pick the one with least groups
            const targetPanel = [...initialDrafts].sort((a, b) => {
                if (a.faculties.length !== b.faculties.length) {
                    return a.faculties.length - b.faculties.length;
                }
                const aGroups = a.faculties.reduce((sum, f) => sum + f.groupCount, 0);
                const bGroups = b.faculties.reduce((sum, f) => sum + f.groupCount, 0);
                return aGroups - bGroups;
            })[0];
            targetPanel.faculties.push(f);
        });

        setDraftPanels(initialDrafts);
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

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveFaculty = active.data.current?.type === "Faculty";
        const isOverFaculty = over.data.current?.type === "Faculty";
        const isOverPanel = over.data.current?.type === "Panel";

        if (!isActiveFaculty) return;

        setDraftPanels((prev) => {
            const activePanelId = active.data.current?.currentPanelId;
            const overPanelId = isOverPanel ? over.id : over.data.current?.currentPanelId;

            if (!activePanelId || !overPanelId || activePanelId === overPanelId) {
                return prev;
            }

            const activePanelIdx = prev.findIndex(p => p.id === activePanelId);
            const overPanelIdx = prev.findIndex(p => p.id === overPanelId);

            if (activePanelIdx === -1 || overPanelIdx === -1) return prev;

            const next = [...prev];
            next[activePanelIdx] = { ...next[activePanelIdx], faculties: [...next[activePanelIdx].faculties] };
            next[overPanelIdx] = { ...next[overPanelIdx], faculties: [...next[overPanelIdx].faculties] };

            const activeFacultyIdx = next[activePanelIdx].faculties.findIndex(f => f._id === activeId);
            const [movedFac] = next[activePanelIdx].faculties.splice(activeFacultyIdx, 1);

            if (isOverFaculty) {
                const overFacultyIdx = next[overPanelIdx].faculties.findIndex(f => f._id === overId);
                const isBelow =
                    over.data.current?.sortable?.index !== undefined &&
                    active.data.current?.sortable?.index !== undefined &&
                    over.data.current?.sortable?.index > active.data.current?.sortable?.index;
                const modifier = isBelow ? 1 : 0;
                const insertIndex = overFacultyIdx >= 0 ? overFacultyIdx + modifier : next[overPanelIdx].faculties.length;
                next[overPanelIdx].faculties.splice(insertIndex, 0, movedFac);
            } else {
                next[overPanelIdx].faculties.push(movedFac);
            }

            if (active.data.current) {
                active.data.current.currentPanelId = overPanelId;
            }

            return next;
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveFaculty(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activePanelId = active.data.current?.currentPanelId;
        const overPanelId = over.data.current?.currentPanelId || over.id;

        if (!activePanelId || !overPanelId) return;

        if (activePanelId === overPanelId && activeId !== overId) {
            setDraftPanels(prev => {
                const panelIdx = prev.findIndex(p => p.id === activePanelId);
                if (panelIdx === -1) return prev;

                const next = [...prev];
                const activeIndex = next[panelIdx].faculties.findIndex(f => f._id === activeId);
                const overIndex = next[panelIdx].faculties.findIndex(f => f._id === overId);

                if (activeIndex !== -1 && overIndex !== -1) {
                    next[panelIdx] = {
                        ...next[panelIdx],
                        faculties: arrayMove(next[panelIdx].faculties, activeIndex, overIndex)
                    };
                }
                return next;
            });
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
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-neutral-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-neutral-900 flex items-center gap-3">
                            <Users className="w-6 h-6 text-indigo-600" /> {isEditingMode ? 'Edit Panels Interface' : 'Auto-Create Panels'}
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-base font-bold ml-2">Batch {batchYear}</span>
                        </h3>
                        <p className="text-sm text-neutral-500 mt-2">
                            {isEditingMode ? 'Drag and drop faculties to reposition them between panels, or add available active faculties.' : 'Review and adjust the intelligently allocated panel structure. Drag nodes to remap faculties.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 bg-neutral-100/30">
                    {hasOvercrowded && (
                        <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3 shadow-sm">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-orange-900">Uneven Distribution Notice</h4>
                                <p className="text-sm text-orange-700 mt-0.5">
                                    {isEditingMode ? "Some panels have more than 3 members." : "Due to the total number of unallocated faculties, 1 or 2 faculties had to be merged into existing panels containing more than 3 members."} You can drag and drop to manually adjust this if you wish.
                                </p>
                            </div>
                        </div>
                    )}

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {draftPanels.map((p: any, i) => (
                                <DroppablePanel key={p.id} panel={p} index={i} />
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
