const fs = require('fs');
const path = 'client/src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// The corrupted section starts after line 1827 (</div> closing configBatchGroup inner content)
// and continues through line 1831 where it jumps into toggle confirmation modal content.
// We need to:
// 1. Close configBatchGroup properly with footer buttons
// 2. Insert the Create/Edit Event modal
// 3. Then properly start the Toggle Event Confirmation modal

const oldText = `                            </div>\r\n                            animate={{ opacity: 1, scale: 1 }}\r\n                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"\r\n                        >\r\n                            <div className="p-6">`;

const newText = `                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setConfigBatchGroup(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button onClick={() => handleUpdateBatchViaModal((document.getElementById('targetBatchUpdate') as HTMLSelectElement).value)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">Save Batch</button>
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
                                <button onClick={() => { setShowCreateEvent(false); setEditingEvent(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
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
                                    <select value={eventForm.type} onChange={(e) => { const type = e.target.value; const dl: any = { group_formation: 'Group Formation Period', project_proposal: 'Project Proposal Submission', mid_term_evaluation: 'Mid-Term Evaluation Period', end_term_evaluation: 'End-Term Evaluation Period', final_report: 'Final Report Submission' }; const dd: any = { group_formation: 'Students can form groups and find team members during this period.', project_proposal: 'Groups can submit their project proposals to faculty for approval.', mid_term_evaluation: 'Faculty will evaluate mid-term progress of all assigned groups.', end_term_evaluation: 'Final evaluation phase where marks entry and results are published.', final_report: 'Groups submit their final project reports for evaluation.' }; setEventForm(prev => ({ ...prev, type, label: prev.label || dl[type] || '', description: prev.description || dd[type] || '' })); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm">
                                        <option value="group_formation">Group Formation</option>
                                        <option value="project_proposal">Project Proposal</option>
                                        <option value="mid_term_evaluation">Mid-Term Evaluation</option>
                                        <option value="end_term_evaluation">End-Term Evaluation</option>
                                        <option value="final_report">Final Report</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Label (shown to all users)</label>
                                    <input type="text" value={eventForm.label} onChange={(e) => setEventForm(prev => ({ ...prev, label: e.target.value }))} placeholder="e.g., Group Formation Period" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                    <textarea value={eventForm.description} onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description..." rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date & Time</label>
                                        <input type="datetime-local" value={eventForm.startDate} onChange={(e) => setEventForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date & Time (Deadline)</label>
                                        <input type="datetime-local" value={eventForm.endDate} onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Extension Date (Optional) <span className="text-xs text-neutral-400 ml-2">Extends the deadline</span></label>
                                    <input type="datetime-local" value={eventForm.extensionDate} onChange={(e) => setEventForm(prev => ({ ...prev, extensionDate: e.target.value }))} className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-sm bg-orange-50/30" />
                                    {eventForm.extensionDate && (<button onClick={() => setEventForm(prev => ({ ...prev, extensionDate: '' }))} className="text-xs text-red-500 mt-1 hover:underline">Remove extension</button>)}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Year (Optional)</label>
                                    <select value={eventForm.batchYear} onChange={(e) => setEventForm(prev => ({ ...prev, batchYear: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm">
                                        <option value="">All Batches</option>
                                        {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(yr => (<option key={yr} value={yr.toString()}>{yr}-{yr + 4}</option>))}
                                    </select>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <div>
                                        <p className="text-sm font-bold text-neutral-900">Activate Immediately</p>
                                        <p className="text-xs text-neutral-500">Event will be visible to all users right away</p>
                                    </div>
                                    <button onClick={() => setEventForm(prev => ({ ...prev, isActive: !prev.isActive }))} className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors \${eventForm.isActive ? 'bg-green-500' : 'bg-neutral-300'}\`}>
                                        <span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm \${eventForm.isActive ? 'translate-x-6' : 'translate-x-1'}\`} />
                                    </button>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => { setShowCreateEvent(false); setEditingEvent(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button onClick={async () => { try { if (!eventForm.label || !eventForm.description || !eventForm.startDate || !eventForm.endDate) { alert('Please fill in all required fields.'); return; } const payload = { ...eventForm, extensionDate: eventForm.extensionDate || null, batchYear: eventForm.batchYear || undefined }; if (editingEvent) { await api.put(\`/events/\${editingEvent._id}\`, payload); } else { await api.post('/events', payload); } setShowCreateEvent(false); setEditingEvent(null); const res = await api.get('/events'); setEvents(Array.isArray(res.data) ? res.data : []); } catch (e: any) { alert(e.response?.data?.message || 'Failed to save event'); } }} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-md flex items-center gap-2">
                                    <Save className="w-4 h-4" /> {editingEvent ? 'Save Changes' : 'Create Event'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Toggle Event Confirmation */}
                {confirmToggleEvent && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-6">`;

if (content.includes(oldText)) {
    content = content.replace(oldText, newText);
    fs.writeFileSync(path, content, 'utf8');
    console.log('SUCCESS: File fixed!');
} else {
    console.log('ERROR: Old text not found. Trying with \\r\\n...');
    const oldTextCRLF = oldText.replace(/\n/g, '\r\n');
    if (content.includes(oldTextCRLF)) {
        content = content.replace(oldTextCRLF, newText.replace(/\n/g, '\r\n'));
        fs.writeFileSync(path, content, 'utf8');
        console.log('SUCCESS: File fixed with CRLF!');
    } else {
        console.log('ERROR: Could not find text to replace');
        // Let's find lines around 1828
        const lines = content.split(/\r?\n/);
        for (let i = 1826; i < 1834; i++) {
            console.log(`Line ${i+1}: ${JSON.stringify(lines[i])}`);
        }
    }
}
