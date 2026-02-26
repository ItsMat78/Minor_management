const fs = require('fs');

const path = 'e:/Projects/Minor_management/client/src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update State type
content = content.replace(
    `useState<'students' | 'groups' | 'faculty' | 'events' | 'exports'>('students');`,
    `useState<'students' | 'groups' | 'faculty' | 'events' | 'exports' | 'panels'>('students');`
);

// 2. Add Panels State
if (!content.includes('const [panels, setPanels] = useState<any[]>([])')) {
    content = content.replace(
        `const [loading, setLoading] = useState(false);`,
        `const [loading, setLoading] = useState(false);\n    const [panels, setPanels] = useState<any[]>([]);\n    const [showCreatePanel, setShowCreatePanel] = useState(false);\n    const [newPanelName, setNewPanelName] = useState('');\n    const [newPanelFaculty, setNewPanelFaculty] = useState<string[]>([]);\n    const [newPanelBatch, setNewPanelBatch] = useState<string>('');`
    );
}

// 3. Update useEffect
if (!content.includes('else if (activeTab === \'panels\')')) {
    content = content.replace(
        `                 } else if (activeTab === 'groups') {`,
        `                } else if (activeTab === 'panels') {\n                    const res = await api.get(\`/panels?batchYear=\${filterBatch}\`);\n                    setPanels(Array.isArray(res.data) ? res.data : []);\n                    const facultyRes = await api.get('/users/faculty');\n                    setFaculty(Array.isArray(facultyRes.data) ? facultyRes.data : []);\n                } else if (activeTab === 'groups') {`
    );
}

// 4. Update sidebar
if (!content.includes('label="Evaluation Panels"')) {
    content = content.replace(
        `                    <SidebarItem\n                        icon={<Users className="w-5 h-5" />}\n                        label="Faculty Directory"\n                        active={activeTab === 'faculty'}\n                        onClick={() => setActiveTab('faculty')}\n                    />`,
        `                    <SidebarItem\n                        icon={<Users className="w-5 h-5" />}\n                        label="Faculty Directory"\n                        active={activeTab === 'faculty'}\n                        onClick={() => setActiveTab('faculty')}\n                    />\n                    <SidebarItem\n                        icon={<Search className="w-5 h-5" />}\n                        label="Evaluation Panels"\n                        active={activeTab === 'panels'}\n                        onClick={() => setActiveTab('panels')}\n                    />`
    );
}

// 5. Update Header Title
content = content.replace(
    `{activeTab === 'faculty' && 'Faculty Directory'}`,
    `{activeTab === 'faculty' && 'Faculty Directory'}\n                            {activeTab === 'panels' && 'Evaluation Panels'}`
);

// 6. Common Toolbar for Panels (search, batch dropdown)
content = content.replace(
    `(activeTab === 'students' || activeTab === 'groups' || activeTab === 'faculty')`,
    `(activeTab === 'students' || activeTab === 'groups' || activeTab === 'faculty' || activeTab === 'panels')`
);

// Include filterBatch in panels condition for toolbar batch selector
content = content.replace(
    `(activeTab === 'students' || activeTab === 'groups') && (`,
    `(activeTab === 'students' || activeTab === 'groups' || activeTab === 'panels') && (`
);

// 7. Render panels tab. We will insert it right before `{activeTab === 'events' && (`
const panelsContent = `
                                {activeTab === 'panels' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-end">
                                            <button onClick={() => setShowCreatePanel(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
                                                Create New Panel
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {panels.map(panel => (
                                                <div key={panel._id} className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <h3 className="text-lg font-bold text-neutral-900">{panel.name}</h3>
                                                            <p className="text-sm text-neutral-500">Batch {panel.batchYear}</p>
                                                        </div>
                                                        <button 
                                                            onClick={async () => {
                                                                if(confirm('Delete panel?')) {
                                                                    await api.delete(\`/panels/\${panel._id}\`);
                                                                    const res = await api.get(\`/panels?batchYear=\${filterBatch}\`);
                                                                    setPanels(Array.isArray(res.data) ? res.data : []);
                                                                }
                                                            }}
                                                            className="text-red-500 hover:bg-red-50 p-2 rounded text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold text-neutral-700">Faculty Members:</h4>
                                                        {panel.faculty.map((f: any) => (
                                                            <div key={f._id} className="text-sm text-neutral-600 bg-neutral-50 p-2 rounded border border-neutral-100 flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                                                {f.name} ({f.email})
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {panels.length === 0 && (
                                                <div className="col-span-1 lg:col-span-2 text-center text-neutral-500 py-10 bg-white rounded-xl border border-neutral-200">
                                                    No panels found for this batch.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
`;

if (!content.includes('activeTab === \'panels\' && (')) {
    content = content.replace(
        `{activeTab === 'events' && (`,
        `${panelsContent}\n                                {activeTab === 'events' && (`
    );
}

// 8. Add Create Panel Modal
const createPanelModal = `
                {showCreatePanel && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Create Panel</h3>
                                <button onClick={() => setShowCreatePanel(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Panel Name</label>
                                    <input type="text" value={newPanelName} onChange={(e) => setNewPanelName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. Code Review Panel A" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year (Start Year)</label>
                                    <select value={newPanelBatch} onChange={(e) => setNewPanelBatch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                        <option value="">Select Batch</option>
                                        {Array.from({ length: 7 }, (_, i) => (new Date().getFullYear() - 7) + i).map(year => (
                                            <option key={year} value={year.toString()}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Faculty Members (Max 3)</label>
                                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                        {faculty.map((f: any) => (
                                            <label key={f._id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded">
                                                <input 
                                                    type="checkbox" 
                                                    checked={newPanelFaculty.includes(f._id)}
                                                    onChange={(e) => {
                                                        if(e.target.checked) {
                                                            if (newPanelFaculty.length >= 3) return;
                                                            setNewPanelFaculty([...newPanelFaculty, f._id]);
                                                        } else {
                                                            setNewPanelFaculty(newPanelFaculty.filter(id => id !== f._id));
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm">{f.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{newPanelFaculty.length}/3 selected</p>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setShowCreatePanel(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button 
                                    onClick={async () => {
                                        try {
                                            await api.post('/panels', { name: newPanelName, faculty: newPanelFaculty, batchYear: parseInt(newPanelBatch) });
                                            setShowCreatePanel(false);
                                            setNewPanelName('');
                                            setNewPanelFaculty([]);
                                            setNewPanelBatch('');
                                            const res = await api.get(\`/panels?batchYear=\${filterBatch}\`);
                                            setPanels(Array.isArray(res.data) ? res.data : []);
                                        } catch (e: any) { alert(e.response?.data?.message || 'Error creating panel'); }
                                    }}
                                    disabled={!newPanelName || !newPanelBatch || newPanelFaculty.length === 0}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    Create Panel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
`;

if (!content.includes('showCreatePanel && (')) {
    content = content.replace(
        `{editingFaculty && (`,
        `${createPanelModal}\n                {editingFaculty && (`
    );
}

fs.writeFileSync(path, content, 'utf8');
console.log('AdminDashboard.tsx updated successfully');
