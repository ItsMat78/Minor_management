import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, Download, Lock, Pencil } from 'lucide-react';
import api from '../utils/api';
import { errorMessage } from '../utils/apiError';

// Must match WORKBOOK_WEEKS on the server.
export const WORKBOOK_WEEKS = 15;

export interface WorkbookEntry {
    week: number;
    content: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
    // Live projects reference members by id; archive entries arrive with names resolved.
    attendance: { student?: string; name?: string; status: 'present' | 'absent' }[];
    approvedAt?: string | null;
}

interface WorkbookProps {
    projectId: string;
    entries: WorkbookEntry[] | undefined;
    members: { _id: string; name: string }[];
    // member: writes weeks · mentor: attendance + approval · viewer: read-only (admin, archive)
    role: 'member' | 'mentor' | 'viewer';
    canExport?: boolean;
    archived?: boolean;
    groupName?: string;
}

// The weekly workbook: WORKBOOK_WEEKS fixed weeks. Group members record what was done; the
// mentor marks each member's attendance and approves (signs) the week, which locks it.
const Workbook: React.FC<WorkbookProps> = ({ projectId, entries: entriesProp, members, role, canExport, archived, groupName }) => {
    const [entries, setEntries] = useState<WorkbookEntry[]>(entriesProp || []);
    useEffect(() => { setEntries(entriesProp || []); }, [entriesProp]);

    const [openWeek, setOpenWeek] = useState<number | null>(null);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const readOnly = role === 'viewer' || archived;
    const byWeek = new Map(entries.map(e => [e.week, e]));
    const approvedCount = entries.filter(e => e.approvedAt).length;
    const nameOf = (id?: string) => members.find(m => String(m._id) === String(id))?.name || 'Former member';

    const toggleWeek = (week: number) => {
        setError('');
        setEditing(false);
        setOpenWeek(openWeek === week ? null : week);
    };

    const call = async (fn: () => Promise<any>, fallback: string) => {
        setBusy(true);
        setError('');
        try {
            const res = await fn();
            setEntries(res.data || []);
            return true;
        } catch (err) {
            setError(errorMessage(err, fallback));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const saveContent = async (week: number) => {
        const ok = await call(() => api.put(`/projects/${projectId}/workbook/${week}`, { content: draft }), 'Could not save this week.');
        if (ok) setEditing(false);
    };

    const markAttendance = (week: number, studentId: string, status: 'present' | 'absent') =>
        call(() => api.put(`/projects/${projectId}/workbook/${week}/attendance`, { attendance: { [studentId]: status } }), 'Could not save attendance.');

    const setApproved = (week: number, approved: boolean) =>
        call(() => api.put(`/projects/${projectId}/workbook/${week}/approve`, { approved }), 'Could not update approval.');

    const exportXlsx = async () => {
        try {
            const res = await api.get(`/projects/${projectId}/workbook/export`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Workbook_Group_${groupName || projectId}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(errorMessage(err, 'Could not export the workbook.'));
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" /> Weekly Workbook
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500 tabular-nums">{approvedCount}/{WORKBOOK_WEEKS} approved</span>
                    {canExport && (
                        <button
                            onClick={exportXlsx}
                            className="text-xs font-bold text-indigo-700 flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 border border-indigo-200"
                        >
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
                {Array.from({ length: WORKBOOK_WEEKS }, (_, i) => i + 1).map(week => {
                    const entry = byWeek.get(week);
                    const isOpen = openWeek === week;
                    const approved = !!entry?.approvedAt;
                    const present = entry?.attendance.filter(a => a.status === 'present').length ?? 0;
                    const statusOf = (id: string) => entry?.attendance.find(a => String(a.student) === String(id))?.status;
                    const allMarked = members.length > 0 && members.every(m => statusOf(m._id));

                    return (
                        <div key={week}>
                            <button
                                onClick={() => toggleWeek(week)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
                            >
                                <span className="w-14 shrink-0 text-xs font-black uppercase tracking-wider text-neutral-400">Wk {week}</span>
                                <span className={`flex-1 min-w-0 truncate text-sm ${entry ? 'text-neutral-700' : 'text-neutral-300 italic'}`}>
                                    {entry ? entry.content : 'Nothing recorded'}
                                </span>
                                {entry && entry.attendance.length > 0 && (
                                    <span className="shrink-0 text-[10px] font-bold text-neutral-500 tabular-nums">{present}/{entry.attendance.length} present</span>
                                )}
                                {approved ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Approved" />
                                ) : entry ? (
                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-amber-600">Pending</span>
                                ) : null}
                                <ChevronDown className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-4 space-y-4 bg-neutral-50/50">
                                    {/* Content: editable by members until approved */}
                                    {editing ? (
                                        <div className="space-y-2 pt-1">
                                            <textarea
                                                value={draft}
                                                onChange={e => setDraft(e.target.value)}
                                                rows={5}
                                                placeholder={`What did the group work on in week ${week}?`}
                                                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditing(false)} disabled={busy} className="px-3 py-1.5 text-xs font-bold text-neutral-600 rounded-lg hover:bg-neutral-100">Cancel</button>
                                                <button onClick={() => saveContent(week)} disabled={busy} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                                    {busy ? 'Saving…' : 'Save'}
                                                </button>
                                            </div>
                                            {entry && <p className="text-[11px] text-neutral-400">Saving empty text clears this week.</p>}
                                        </div>
                                    ) : (
                                        <div className="pt-1">
                                            {entry ? (
                                                <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                                            ) : (
                                                <p className="text-sm text-neutral-400 italic">Nothing recorded for this week.</p>
                                            )}
                                            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                                                {entry?.lastEditedAt && role !== 'viewer' ? (
                                                    <span className="text-[11px] text-neutral-400">
                                                        Last edited by {nameOf(entry.lastEditedBy)} · {new Date(entry.lastEditedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                ) : <span />}
                                                {role === 'member' && !readOnly && (approved ? (
                                                    <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Approved — locked</span>
                                                ) : (
                                                    <button
                                                        onClick={() => { setDraft(entry?.content || ''); setEditing(true); setError(''); }}
                                                        className="text-xs font-bold text-indigo-700 flex items-center gap-1 hover:underline"
                                                    >
                                                        <Pencil className="w-3 h-3" /> {entry ? 'Edit' : 'Write this week'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attendance: needs content; the mentor marks it until the week is approved */}
                                    {entry && (
                                        <div>
                                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Attendance</p>
                                            {role === 'mentor' && !readOnly && !approved ? (
                                                <div className="space-y-1.5">
                                                    {members.map(m => {
                                                        const s = statusOf(m._id);
                                                        return (
                                                            <div key={m._id} className="flex items-center justify-between gap-2 text-sm">
                                                                <span className="truncate text-neutral-700">{m.name}</span>
                                                                <div className="flex gap-1 shrink-0">
                                                                    {(['present', 'absent'] as const).map(opt => (
                                                                        <button
                                                                            key={opt}
                                                                            disabled={busy}
                                                                            onClick={() => markAttendance(week, m._id, opt)}
                                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold capitalize border transition-colors ${s === opt
                                                                                ? (opt === 'present' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-500 text-white border-red-500')
                                                                                : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'}`}
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : entry.attendance.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {entry.attendance.map((a, i) => (
                                                        <span key={i} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.status === 'present' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                            {a.name || nameOf(a.student)} · {a.status === 'present' ? 'Present' : 'Absent'}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-neutral-400 italic">Not marked yet.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Approval (the mentor's signature) */}
                                    {entry && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-100">
                                            {approved ? (
                                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved on {new Date(entry.approvedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-amber-600">Awaiting mentor approval</span>
                                            )}
                                            {role === 'mentor' && !readOnly && (
                                                <button
                                                    disabled={busy || (!approved && !allMarked)}
                                                    title={!approved && !allMarked ? 'Mark attendance for every member first' : undefined}
                                                    onClick={() => setApproved(week, !approved)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${approved
                                                        ? 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                                >
                                                    {approved ? 'Un-approve' : 'Approve week'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Workbook;
