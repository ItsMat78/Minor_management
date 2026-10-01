import React, { useEffect, useState } from 'react';
import { X, UserPlus, Power, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { errorMessage } from '../utils/apiError';

interface Coordinator {
    _id: string;
    name: string;
    email: string;
    isDeactivated: boolean;
    validUntil: string | null;
    isActive: boolean;
    createdAt: string;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

// Admin-only: create the yearly coordinator's account and deactivate the previous one at
// handover. Accounts are never deleted, so the audit trail keeps naming who did what.
const CoordinatorsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', validUntil: '' });
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState('');

    const load = async () => {
        try {
            const res = await api.get('/admin/coordinators');
            setCoordinators(res.data);
        } catch (err) {
            setError(errorMessage(err, 'Could not load coordinators.'));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError('');
        setCreated('');
        try {
            const res = await api.post('/admin/coordinators', { ...form, validUntil: form.validUntil || undefined });
            setCoordinators(cs => [res.data, ...cs]);
            setCreated(`Created ${res.data.email}. They will be asked to set a new password on first sign-in.`);
            setForm({ name: '', email: '', password: '', validUntil: '' });
        } catch (err) {
            setError(errorMessage(err, 'Could not create the coordinator.'));
        } finally {
            setCreating(false);
        }
    };

    const update = async (c: Coordinator, body: any) => {
        setBusyId(c._id);
        setError('');
        try {
            const res = await api.put(`/admin/coordinators/${c._id}`, body);
            setCoordinators(cs => cs.map(x => (x._id === c._id ? res.data : x)));
        } catch (err) {
            setError(errorMessage(err, 'Could not update the coordinator.'));
        } finally {
            setBusyId(null);
        }
    };

    const input = 'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900">Coordinators</h2>
                        <p className="text-xs text-neutral-500">Run the semester; no access to accounts, settings, rollover, snapshots or the audit log.</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Existing coordinators */}
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
                    ) : coordinators.length === 0 ? (
                        <p className="text-sm text-neutral-400 text-center py-4">No coordinator accounts yet.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
                            {coordinators.map(c => (
                                <li key={c._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-neutral-900 truncate">{c.name}</p>
                                        <p className="text-xs text-neutral-500 truncate">{c.email}</p>
                                    </div>
                                    <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                                        Valid until
                                        <input
                                            type="date"
                                            value={toDateInput(c.validUntil)}
                                            disabled={busyId === c._id}
                                            onChange={e => update(c, { validUntil: e.target.value || null })}
                                            className="border border-neutral-200 rounded-md px-2 py-1 text-xs"
                                        />
                                    </label>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                        {c.isActive ? 'Active' : c.isDeactivated ? 'Deactivated' : 'Expired'}
                                    </span>
                                    <button
                                        disabled={busyId === c._id}
                                        onClick={() => update(c, { isDeactivated: !c.isDeactivated })}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${c.isDeactivated
                                            ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                            : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                                    >
                                        <Power className="w-3.5 h-3.5" /> {c.isDeactivated ? 'Reactivate' : 'Deactivate'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* New coordinator */}
                    <form onSubmit={create} className="space-y-3 border-t border-neutral-100 pt-5">
                        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><UserPlus className="w-4 h-4 text-indigo-600" /> New coordinator</h3>
                        <p className="text-xs text-neutral-500">Needs its own email; a faculty member's existing login email cannot be reused.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input className={input} placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            <input className={input} type="email" placeholder="Login email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                            <input className={input} type="password" placeholder="Temporary password (8+ characters)" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                            <label className="flex items-center gap-2 text-xs text-neutral-500">
                                Valid until (optional)
                                <input className={`${input} flex-1`} type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} />
                            </label>
                        </div>
                        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
                        {created && <p className="text-xs font-semibold text-emerald-700">{created}</p>}
                        <div className="flex justify-end">
                            <button type="submit" disabled={creating} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                                {creating ? 'Creating…' : 'Create coordinator'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CoordinatorsModal;
