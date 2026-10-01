import React from 'react';
import { Users } from 'lucide-react';

// One entry from /projects/archived or /projects/archived/faculty. Everyone gets the title,
// description, tags, members, supervisor, session and semester; groupName, roll numbers and
// marks are only present on the viewer's own projects (the server leaves them out otherwise).
export interface ArchivedProject {
    _id: string;
    title: string;
    description?: string;
    tags: string[];
    supervisor: string | null;
    batch: string | null;
    session: string;
    semester: number | null;
    isMine: boolean;
    groupName?: string | null;
    members: { name: string; rollNumber?: string; marks?: { midTerm: number | null; endTerm: number | null } }[];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const ArchivedProjectCard: React.FC<{ project: ArchivedProject }> = ({ project: p }) => {
    const withMarks = p.members.filter(m => m.marks);
    return (
        <div className={`p-5 rounded-xl border transition-colors ${p.isMine ? 'border-emerald-200 bg-emerald-50/30' : 'border-neutral-200 hover:border-indigo-200 hover:bg-neutral-50'}`}>
            <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded font-medium">{p.session}</span>
                {p.semester && <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded font-medium">Sem {ROMAN[p.semester - 1] || p.semester}</span>}
                {p.batch && <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded font-medium">Batch {p.batch}</span>}
                {p.isMine && p.groupName && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded font-medium">Group {p.groupName}</span>}
                {p.isMine && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-bold">Yours</span>}
            </div>
            <h4 className="font-bold text-neutral-900 mb-1 line-clamp-2">{p.title}</h4>
            <p className="text-sm text-neutral-500 line-clamp-3 mb-3">{p.description || 'No description.'}</p>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span><span className="font-semibold">Supervisor:</span> {p.supervisor || '—'}</span>
            </div>
            {p.members.length > 0 && (
                <p className="text-xs text-neutral-500">
                    <span className="font-semibold">Members:</span> {p.members.map(m => m.rollNumber ? `${m.name} (${m.rollNumber})` : m.name).join(', ')}
                </p>
            )}
            {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                    {p.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-xs rounded">{tag}</span>
                    ))}
                </div>
            )}
            {withMarks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1 text-xs text-neutral-600">
                    {withMarks.map((m, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                            <span className="truncate">{withMarks.length > 1 ? m.name : 'Your marks'}</span>
                            <span className="shrink-0 tabular-nums">
                                <span className="font-semibold">Mid:</span> {m.marks!.midTerm ?? '—'}
                                <span className="ml-3 font-semibold">End:</span> {m.marks!.endTerm ?? '—'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ArchivedProjectCard;
