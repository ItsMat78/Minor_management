import React, { useState, useEffect } from 'react';
import { X, Users, GripVertical, AlertTriangle, Mail, Shuffle } from 'lucide-react';
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

// Panel sizing policy. Auto-generation aims for TARGET and is guaranteed to stay
// within [MIN, MAX]; only manual drags can push a panel past MAX.
const TARGET_PANEL_SIZE = 3;
const MIN_PANEL_SIZE = 2;
const MAX_PANEL_SIZE = 4;

interface FacultyWorkload {
    _id: string;
    name: string;
    email: string;
    groupCount: number;
}

interface DraftPanel {
    id: string;
    faculties: FacultyWorkload[];
    room?: string;
}

interface AutoCreatePanelsModalProps {
    faculties: FacultyWorkload[];
    batchYear: number;
    onClose: () => void;
    onConfirm: (panels: { faculty: string[], batchYear: number, room?: string, _id?: string, seed?: number }[]) => Promise<void>;
    isEditingMode?: boolean;
    initialPanels?: any[];
}

// ── Seeded draw ─────────────────────────────────────────────────────────────
// Allocation is deterministic: the same workloads always produce the same panels.
// A draw randomises only the *ties* — faculty supervising the same number of groups,
// and equally loaded panels at the same fill level — which reshuffles who sits with
// whom without touching the sort keys that drive load balance. Seed 0 means "no draw",
// i.e. the plain deterministic run. The seed is saved with the panels so any
// arrangement can be re-derived and checked afterwards.

const DRAW_RESTARTS = 12;

const pinned = import.meta.env.DEV ? Number(import.meta.env.VITE_PANEL_SEED) || 0 : 0;
const newSeed = () => pinned || Math.floor(Math.random() * 900000) + 100000;

/** True when two allocations hold the same faculty, panel for panel, in the same order. */
const sameArrangement = (a: DraftPanel[], b: DraftPanel[]) =>
    a.length === b.length &&
    a.every((panel, i) => {
        const other = b[i].faculties;
        return panel.faculties.length === other.length &&
            panel.faculties.every((f, j) => f._id === other[j]._id);
    });

const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Fisher-Yates. The trailing comma in <T,> stops TSX reading the parameter as JSX.
const shuffle = <T,>(items: T[], rng: () => number): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const panelLoad = (p: DraftPanel) => p.faculties.reduce((sum, m) => sum + m.groupCount, 0);

interface LoadSpread { gap: number; variance: number }

const loadSpread = (ps: DraftPanel[]): LoadSpread => {
    const loads = ps.map(panelLoad);
    if (loads.length === 0) return { gap: 0, variance: 0 };
    const mean = loads.reduce((s, l) => s + l, 0) / loads.length;
    return {
        gap: Math.max(...loads) - Math.min(...loads),
        variance: loads.reduce((s, l) => s + (l - mean) ** 2, 0)
    };
};

const beats = (a: LoadSpread, b: LoadSpread) =>
    a.gap < b.gap || (a.gap === b.gap && a.variance < b.variance - 1e-9);

const tiesWith = (a: LoadSpread, b: LoadSpread) =>
    a.gap === b.gap && Math.abs(a.variance - b.variance) < 1e-9;

/**
 * One allocation pass over the faculty who actually supervise groups.
 * Pass `rng` to break ties randomly; pass null for the deterministic run.
 */
const allocatePanels = (activeFacs: FacultyWorkload[], rng: (() => number) | null): DraftPanel[] => {
    const ordered = rng ? shuffle(activeFacs, rng) : [...activeFacs];
    // Stable sort, so equal group counts keep whatever order `ordered` gave them.
    const sortedActive = ordered.sort((a, b) => b.groupCount - a.groupCount);
    const activeCount = sortedActive.length;

    // Aim for panels of TARGET_PANEL_SIZE, but never take so few panels that one
    // overflows MAX_PANEL_SIZE (5 active faculty used to land in a single panel of 5)
    // nor so many that they drop below MIN_PANEL_SIZE.
    const panelsCount = activeCount === 0 ? 0 : Math.min(
        Math.max(
            Math.round(activeCount / TARGET_PANEL_SIZE),
            Math.ceil(activeCount / MAX_PANEL_SIZE)
        ),
        Math.max(1, Math.floor(activeCount / MIN_PANEL_SIZE))
    );

    const drafts: DraftPanel[] = Array.from({ length: panelsCount }, (_, i) => ({
        id: `panel-${i}`,
        faculties: []
    }));

    // Cardinality-constrained LPT. Every panel is entitled to `baseSize` members and
    // `extraSeats` of them get one more, so head counts stay within 1 of each other.
    // Heaviest faculty go first, filling panels level by level, and within a level the
    // lightest panel wins. Choosing purely by load instead reads as the more obvious
    // fix but is worse in practice: the small supervisors pile into whichever panel is
    // momentarily lightest, which fills it up and strands it far below the rest.
    const baseSize = panelsCount > 0 ? Math.floor(activeCount / panelsCount) : 0;
    let extraSeats = panelsCount > 0 ? activeCount % panelsCount : 0;

    sortedActive.forEach(f => {
        const seated = drafts.filter(p =>
            p.faculties.length < baseSize || (p.faculties.length === baseSize && extraSeats > 0)
        );
        // Seats are sized to hold everyone exactly, so `seated` only empties if the
        // arithmetic above is ever changed; fall back to the whole set.
        const pool = seated.length > 0 ? seated : drafts;
        const minSize = Math.min(...pool.map(p => p.faculties.length));
        const level = pool.filter(p => p.faculties.length === minSize);

        const targetPanel = (rng ? shuffle(level, rng) : level)
            .sort((a, b) => panelLoad(a) - panelLoad(b))[0];

        if (!targetPanel) return;
        if (targetPanel.faculties.length === baseSize) extraSeats--;
        targetPanel.faculties.push(f);
    });

    // Local search: exchange two faculty between panels whenever that narrows the gap
    // between the busiest and quietest panel. Greedy placement alone leaves avoidable
    // imbalance (5 active faculty landed 11/9 where 10/10 exists), and a swap can only
    // move load — every panel keeps the size the seat budget gave it.
    for (let pass = 0; drafts.length > 1 && pass < 30; pass++) {
        const current = loadSpread(drafts);
        let best: { a: number, b: number, i: number, j: number, gap: number, variance: number } | null = null;

        for (let a = 0; a < drafts.length; a++) {
            for (let b = a + 1; b < drafts.length; b++) {
                for (let i = 0; i < drafts[a].faculties.length; i++) {
                    for (let j = 0; j < drafts[b].faculties.length; j++) {
                        const fa = drafts[a].faculties[i];
                        const fb = drafts[b].faculties[j];
                        if (fa.groupCount === fb.groupCount) continue;

                        drafts[a].faculties[i] = fb;
                        drafts[b].faculties[j] = fa;
                        const candidate = loadSpread(drafts);
                        drafts[a].faculties[i] = fa;
                        drafts[b].faculties[j] = fb;

                        if (!beats(candidate, current)) continue;
                        if (best && !beats(candidate, best)) continue;
                        best = { a, b, i, j, ...candidate };
                    }
                }
            }
        }

        if (!best) break;
        const held = drafts[best.a].faculties[best.i];
        drafts[best.a].faculties[best.i] = drafts[best.b].faculties[best.j];
        drafts[best.b].faculties[best.j] = held;
    }

    return drafts;
};

/**
 * Runs the allocation several times and returns one of the best-balanced results.
 *
 * Restart 0 is the unshuffled run, so a draw can never come out worse balanced than
 * the plain deterministic allocation. Among the restarts that tie for the best spread
 * one is picked at random — always taking the single best would collapse every seed
 * back onto the same answer, leaving nothing to draw.
 */
const drawPanels = (activeFacs: FacultyWorkload[], seed: number): DraftPanel[] => {
    const deterministic = allocatePanels(activeFacs, null);
    if (!seed) return deterministic;

    const scored = [deterministic];
    for (let k = 1; k < DRAW_RESTARTS; k++) {
        // Spread the sub-seeds apart; adjacent seeds otherwise start mulberry32 in
        // nearly the same place and the restarts come back near-identical.
        scored.push(allocatePanels(activeFacs, mulberry32((seed + k * 0x9E3779B1) | 0)));
    }

    const withSpread = scored.map(panels => ({ panels, spread: loadSpread(panels) }));
    const best = withSpread.reduce((acc, s) => (beats(s.spread, acc.spread) ? s : acc));
    const tied = withSpread.filter(s => tiesWith(s.spread, best.spread));

    const pick = mulberry32(seed);
    return tied[Math.min(Math.floor(pick() * tied.length), tied.length - 1)].panels;
};

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
const DroppablePanel = ({ panel, index, onDelete, onRoomChange }: { panel: DraftPanel, index: number, onDelete: () => void, onRoomChange: (room: string) => void }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: panel.id,
        data: {
            type: "Panel",
            panel
        }
    });

    const totalGroups = panel.faculties.reduce((sum, f) => sum + f.groupCount, 0);
    const isOvercrowded = panel.faculties.length > MAX_PANEL_SIZE;

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
                            <AlertTriangle className="w-3 h-3" /> {'>'}{MAX_PANEL_SIZE}
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

            {/* Room input */}
            <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-neutral-400 shrink-0">📍 Room:</span>
                <input
                    type="text"
                    value={panel.room || ''}
                    onChange={e => onRoomChange(e.target.value)}
                    placeholder="e.g. 304"
                    className="flex-1 text-xs px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white"
                    onClick={e => e.stopPropagation()}
                />
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

// --- Combined state to guarantee atomic updates (prevents duplication bugs) ---
interface BoardState {
    panels: DraftPanel[];
    unallocated: FacultyWorkload[];
}

const AutoCreatePanelsModal: React.FC<AutoCreatePanelsModalProps> = ({ faculties, batchYear, onClose, onConfirm, isEditingMode, initialPanels }) => {
    const [board, setBoard] = useState<BoardState>({ panels: [], unallocated: [] });
    // Panels open on a fresh random draw. Seed 0 is the plain deterministic allocation,
    // still reachable from the Default Order button.
    const [seed, setSeed] = useState(newSeed);
    const [isSaving, setIsSaving] = useState(false);
    const [hasOvercrowded, setHasOvercrowded] = useState(false);
    const [activeFaculty, setActiveFaculty] = useState<FacultyWorkload | null>(null);

    // Convenience accessors (derived from single source of truth)
    const draftPanels = board.panels;
    const unallocatedFaculties = board.unallocated;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Pure helper — takes state snapshot, returns container id
    const findContainerIn = (state: BoardState, facultyId: string): string | null => {
        if (state.unallocated.some(f => f._id === facultyId)) return "unallocated-sidebar";
        const panel = state.panels.find(p => p.faculties.some(f => f._id === facultyId));
        return panel ? panel.id : null;
    };

    const deletePanel = (panelId: string) => {
        setBoard(prev => {
            const panel = prev.panels.find(p => p.id === panelId);
            if (!panel) return prev;
            const existingIds = new Set(prev.unallocated.map(f => f._id));
            return {
                panels: prev.panels.filter(p => p.id !== panelId),
                unallocated: [...prev.unallocated, ...panel.faculties.filter(f => !existingIds.has(f._id))]
            };
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
        setBoard(prev => {
            if (prev.unallocated.length === 0) return prev;
            const nextPanels = prev.panels.map(p => ({ ...p, faculties: [...p.faculties] }));
            const reserve = [...prev.unallocated];

            // Bring every panel up to TARGET first, and only then top up towards MAX —
            // otherwise the first panels would swallow the reserve while later ones stay
            // short. Reserve faculty carry no groups, so this never affects load balance.
            for (const limit of [TARGET_PANEL_SIZE, MAX_PANEL_SIZE]) {
                for (let i = 0; i < nextPanels.length && reserve.length > 0; i++) {
                    while (nextPanels[i].faculties.length < limit && reserve.length > 0) {
                        nextPanels[i].faculties.push(reserve.shift()!);
                    }
                }
            }

            return { panels: nextPanels, unallocated: reserve };
        });
    };

    useEffect(() => {
        if (isEditingMode && initialPanels) {
            // Any faculty from the provided list NOT in initialPanels should be unallocated
            const usedFacIds = new Set(initialPanels.flatMap(p => p.faculties.map((f: any) => f._id)));
            setBoard({
                panels: initialPanels.map((p: any) => ({ ...p, room: p.room || p._tempRoom || '' })),
                unallocated: faculties.filter(f => !usedFacIds.has(f._id))
            });
            return;
        }

        // Logic: Exclude faculty with 0 groups from auto-selection
        const activeFacs = faculties.filter(f => f.groupCount > 0);
        const reserveFacs = faculties.filter(f => f.groupCount === 0);

        setBoard({ panels: drawPanels(activeFacs, seed), unallocated: reserveFacs });
    }, [faculties, isEditingMode, initialPanels, seed]);

    useEffect(() => {
        setHasOvercrowded(draftPanels.some(p => p.faculties.length > MAX_PANEL_SIZE));
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

        const isOverSidebar = over.data.current?.type === "Sidebar" || over.id === "unallocated-sidebar";
        const overContainerId = isOverSidebar ? "unallocated-sidebar" : (over.data.current?.type === "Panel" ? over.id : over.data.current?.currentPanelId);

        if (!overContainerId) return;

        const facultyToMove = active.data.current?.faculty as FacultyWorkload;

        // Single atomic state update — finds source container from *latest* state
        setBoard(prev => {
            const activeContainerId = findContainerIn(prev, activeId);
            if (!activeContainerId || activeContainerId === overContainerId) return prev;

            let nextPanels = prev.panels;
            let nextUnallocated = prev.unallocated;

            // 1. Remove from source
            if (activeContainerId === "unallocated-sidebar") {
                nextUnallocated = nextUnallocated.filter(f => f._id !== activeId);
            } else {
                nextPanels = nextPanels.map(p =>
                    p.id === activeContainerId
                        ? { ...p, faculties: p.faculties.filter(f => f._id !== activeId) }
                        : p
                );
            }

            // 2. Add to destination (with duplicate guard)
            if (overContainerId === "unallocated-sidebar") {
                if (!nextUnallocated.some(f => f._id === activeId)) {
                    nextUnallocated = [...nextUnallocated, facultyToMove];
                }
            } else {
                nextPanels = nextPanels.map(p => {
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
                });
            }

            return { panels: nextPanels, unallocated: nextUnallocated };
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveFaculty(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        if (activeId === overId) return;

        // Single atomic update for same-container reordering
        setBoard(prev => {
            const activeContainerId = findContainerIn(prev, activeId);
            const overContainerId = over.data.current?.currentPanelId || findContainerIn(prev, overId) || over.id.toString();

            if (!activeContainerId || !overContainerId) return prev;
            if (activeContainerId !== overContainerId) return prev;

            if (activeContainerId === "unallocated-sidebar") {
                const activeIndex = prev.unallocated.findIndex(f => f._id === activeId);
                const overIndex = prev.unallocated.findIndex(f => f._id === overId);
                if (activeIndex === -1 || overIndex === -1) return prev;
                return { ...prev, unallocated: arrayMove(prev.unallocated, activeIndex, overIndex) };
            } else {
                const panelIdx = prev.panels.findIndex(p => p.id === activeContainerId);
                if (panelIdx === -1) return prev;
                const activeIndex = prev.panels[panelIdx].faculties.findIndex(f => f._id === activeId);
                const overIndex = prev.panels[panelIdx].faculties.findIndex(f => f._id === overId);
                if (activeIndex === -1 || overIndex === -1) return prev;
                const nextPanels = [...prev.panels];
                nextPanels[panelIdx] = {
                    ...nextPanels[panelIdx],
                    faculties: arrayMove(nextPanels[panelIdx].faculties, activeIndex, overIndex)
                };
                return { ...prev, panels: nextPanels };
            }
        });
    };

    const handleConfirm = async () => {
        // ensure no empty panels
        const validPanels = draftPanels.filter(p => p.faculties.length > 0);
        if (validPanels.length === 0) {
            alert('No panels generated.');
            return;
        }

        // A seed is only worth recording if the board is still what that seed produces.
        // Hand-editing (or arriving here through the edit/import flows, where the panels
        // were never drawn at all) makes the arrangement unreproducible, so it records no
        // draw rather than a seed that would re-derive to something else.
        const drawn = isEditingMode ? null : drawPanels(faculties.filter(f => f.groupCount > 0), seed);
        const recordedSeed = drawn && sameArrangement(drawn, validPanels) ? seed : 0;

        const dataToSave = validPanels.map((p: any) => ({
            batchYear: batchYear,
            faculty: p.faculties.map((f: any) => f._id),
            room: p.room || undefined,
            // Every panel in a batch carries the seed of the draw that produced it, so the
            // arrangement stays re-derivable after the fact. 0 means "no draw".
            seed: recordedSeed,
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
                                    Notice: Some panels have more than {MAX_PANEL_SIZE} members.
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
                                    <div className="flex items-center gap-2">
                                            
                                        {draftPanels.length > 0 && (
                                            <button
                                                onClick={clearAllPanels}
                                                className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5 border border-red-100"
                                            >
                                                <X className="w-3 h-3" /> Delete All Panels
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {draftPanels.map((p: any, i) => (
                                        <DroppablePanel
                                            key={p.id}
                                            panel={p}
                                            index={i}
                                            onDelete={() => deletePanel(p.id)}
                                            onRoomChange={(room) => setBoard(prev => ({
                                                ...prev,
                                                panels: prev.panels.map(panel => panel.id === p.id ? { ...panel, room } : panel)
                                            }))}
                                        />
                                    ))}
                                    <div className="bg-neutral-50/50 rounded-2xl p-5 border-2 border-dashed border-neutral-300 flex items-center justify-center flex-col text-neutral-500 hover:bg-indigo-50/30 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer group" onClick={() => {
                                        setBoard(prev => ({ ...prev, panels: [...prev.panels, { id: `new-panel-${Date.now()}`, faculties: [] }] }));
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

                <div className="px-8 py-5 bg-white border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] focus:outline-none">
                    <div className="flex items-start gap-2 text-xs text-neutral-500 max-w-xl">
                        <Mail className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <span>
                            {isEditingMode
                                ? 'Existing panels will not be re-notified. Any newly added panel will email its members their assignment.'
                                : 'Confirming will email every faculty member their panel assignment, including who else is on their panel.'}
                        </span>
                    </div>
                    <div className="flex justify-end gap-4 shrink-0">
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
        </div>
    );
};

export default AutoCreatePanelsModal;
