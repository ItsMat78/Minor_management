import React from 'react';
import { FileText } from 'lucide-react';
import { resolveUploadUrl } from '../utils/uploadUrl';

type EvalType = 'mid-term' | 'end-term';

interface EvalDeliverablesProps {
    submissions?: Record<string, string | undefined> | null;
    // Which evaluation's files to show; omit to show both.
    evalType?: EvalType | null;
    // `compact` is a single row of chips for list rows and cards; the default is the labelled
    // strip that heads the evaluation modal.
    compact?: boolean;
}

const KEYS: Record<EvalType, { label: string; slots: { key: string; name: string }[] }> = {
    'mid-term': {
        label: 'Mid-Term',
        slots: [
            { key: 'midTermReport', name: 'Report' },
            { key: 'midTermPPT', name: 'Presentation' },
            { key: 'midTermPlagiarism', name: 'Plagiarism' },
        ],
    },
    'end-term': {
        label: 'End-Term',
        slots: [
            { key: 'endTermReport', name: 'Report' },
            { key: 'endTermPPT', name: 'Presentation' },
            { key: 'endTermPlagiarism', name: 'Plagiarism' },
        ],
    },
};

// The files a group uploaded for its mid/end-term evaluation, for the faculty and admin who grade
// it. The student dashboard has its own upload tray; this is the read-only side.
const EvalDeliverables: React.FC<EvalDeliverablesProps> = ({ submissions, evalType, compact = false }) => {
    const subs = submissions || {};
    const types: EvalType[] = evalType ? [evalType] : ['mid-term', 'end-term'];

    if (compact) {
        const links = types.flatMap(t => KEYS[t].slots
            .filter(s => subs[s.key])
            .map(s => ({ ...s, label: evalType ? s.name : `${KEYS[t].label} ${s.name}` })));
        if (links.length === 0) {
            return <span className="text-[10px] text-neutral-400 italic">No files submitted</span>;
        }
        return (
            <div className="flex flex-wrap gap-1">
                {links.map(l => (
                    <a
                        key={l.key}
                        href={resolveUploadUrl(subs[l.key])}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100"
                    >
                        <FileText className="w-2.5 h-2.5" /> {l.label}
                    </a>
                ))}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex flex-col gap-2">
            {types.map(t => (
                <div key={t} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 w-32 shrink-0">
                        {KEYS[t].label} Files
                    </span>
                    {KEYS[t].slots.map(s => subs[s.key] ? (
                        <a
                            key={s.key}
                            href={resolveUploadUrl(subs[s.key])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 rounded-lg text-xs font-semibold border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50"
                        >
                            <FileText className="w-3.5 h-3.5" /> {s.name}
                        </a>
                    ) : (
                        <span key={s.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-neutral-400 rounded-lg text-xs border border-dashed border-neutral-200">
                            {s.name} — not submitted
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default EvalDeliverables;

interface DeliverableCardsProps {
    submissions?: Record<string, string | undefined> | null;
    // Marks an evaluation whose submission window is currently open.
    open?: Partial<Record<EvalType, boolean>>;
    className?: string;
}

// Static so Tailwind's scanner sees every class (an interpolated `bg-${accent}-50` is never generated).
const COUNT_BADGE: Record<EvalType, string> = {
    'mid-term': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'end-term': 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

// One card per evaluation listing every slot, submitted or not — the project-workspace view the
// student, mentor and admin all share.
export const DeliverableCards: React.FC<DeliverableCardsProps> = ({ submissions, open = {}, className = 'space-y-3' }) => {
    const subs = submissions || {};
    return (
        <div className={className}>
            {(['mid-term', 'end-term'] as EvalType[]).map(t => {
                const { label, slots } = KEYS[t];
                return (
                    <div key={t} className="p-3 bg-white rounded-xl border border-neutral-200">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                                {label}
                                {open[t] && <span className="text-[9px] text-amber-600 font-bold uppercase">Open</span>}
                            </h5>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${COUNT_BADGE[t]}`}>
                                {slots.filter(s => subs[s.key]).length} / {slots.length}
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {slots.map(s => (
                                <div key={s.key} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="text-neutral-600 font-medium truncate">{s.name === 'Plagiarism' ? 'Plagiarism Report' : s.name}</span>
                                    {subs[s.key] ? (
                                        <a href={resolveUploadUrl(subs[s.key])} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-1 shrink-0">
                                            <FileText className="w-3 h-3" /> View
                                        </a>
                                    ) : (
                                        <span className="text-neutral-400 italic shrink-0">Not submitted</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
