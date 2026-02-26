const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'client', 'src', 'pages', 'AdminDashboard.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add import
if (!content.includes('AutoCreatePanelsModal')) {
    content = content.replace(
        "import MenteeGroupDetails from '../components/MenteeGroupDetails';",
        "import MenteeGroupDetails from '../components/MenteeGroupDetails';\nimport AutoCreatePanelsModal from '../components/AutoCreatePanelsModal';"
    );
}

// 2. Add state inside AdminDashboard
if (!content.includes('showAutoCreateModal')) {
    content = content.replace(
        "const [panels, setPanels] = useState<any[]>([]);",
        "const [panels, setPanels] = useState<any[]>([]);\n    const [showAutoCreateModal, setShowAutoCreateModal] = useState(false);\n    const [autoCreateFaculties, setAutoCreateFaculties] = useState<any[]>([]);"
    );
}

// 3. Add handleAutoCreateClick logic
const handleAutoCreateCode = `
    const handleAutoCreateClick = () => {
        if (filterBatch === 'All') {
            alert("Please select a specific batch year from the filter to auto-create panels.");
            return;
        }

        const batchYearNum = parseInt(filterBatch);
        const batchSuffix = filterBatch.slice(2);

        // Find faculties already in a panel for this batch
        const existingFacultyIdsInPanels = new Set();
        panels.forEach(p => {
            if (p.batchYear === batchYearNum) {
                p.faculty.forEach((f: any) => existingFacultyIdsInPanels.add(f._id || f));
            }
        });

        // Calculate workload for unassigned faculties
        const availableFaculties = faculty.filter(f => !existingFacultyIdsInPanels.has(f._id));
        
        const batchGroups = groups.filter((g: any) => {
            return g.members?.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
        });

        const facultiesWithWorkload = availableFaculties.map(f => {
            let count = 0;
            batchGroups.forEach(g => {
                if (g.project && (g.project.faculty === f._id || g.project.faculty?._id === f._id)) {
                    count++;
                }
            });
            return { _id: f._id, name: f.name, email: f.email, groupCount: count };
        });

        if (facultiesWithWorkload.length === 0) {
            alert("All available faculties are already assigned to a panel for this batch, or there are no faculties to assign.");
            return;
        }

        setAutoCreateFaculties(facultiesWithWorkload);
        setShowAutoCreateModal(true);
    };

    const confirmAutoCreatePanels = async (newPanels: any[]) => {
        try {
            // newPanels = [{ batchYear, faculties: [id1, id2, id3] }, ...]
            for (const p of newPanels) {
                await api.post('/panels', p);
            }
            setShowAutoCreateModal(false);
            const res = await api.get(\`/panels?batchYear=\${filterBatch}\`);
            setPanels(Array.isArray(res.data) ? res.data : []);
        } catch (e: any) {
            throw e;
        }
    };
`;

if (!content.includes('handleAutoCreateClick = () => {')) {
    content = content.replace(
        "const refreshGroups = async () => {",
        handleAutoCreateCode + "\n    const refreshGroups = async () => {"
    );
}

// 4. Add Auto Create Button
const buttonCode = `                                        <div className="flex justify-end gap-3">
                                            <button onClick={handleAutoCreateClick} className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 transition">
                                                Auto Create Panels
                                            </button>
                                            <button onClick={() => setShowCreatePanel(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
                                                Create New Panel
                                            </button>
                                        </div>`;

if (!content.includes('Auto Create Panels')) {
    content = content.replace(
        `<div className="flex justify-end">\n                                            <button onClick={() => setShowCreatePanel(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">\n                                                Create New Panel\n                                            </button>\n                                        </div>`,
        buttonCode
    );
}

// 5. Render Modal
const modalRenderCode = `
                {showAutoCreateModal && (
                    <AutoCreatePanelsModal
                        faculties={autoCreateFaculties}
                        batchYear={parseInt(filterBatch)}
                        onClose={() => setShowAutoCreateModal(false)}
                        onConfirm={confirmAutoCreatePanels}
                    />
                )}
`;

if (!content.includes('<AutoCreatePanelsModal')) {
    content = content.replace(
        "            </div>\n        </div>\n    );\n};\n\nexport default AdminDashboard;",
        modalRenderCode + "\n            </div>\n        </div>\n    );\n};\n\nexport default AdminDashboard;"
    );
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully patched AdminDashboard.tsx for auto create panels');
