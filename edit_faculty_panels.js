const fs = require('fs');

const path = 'e:/Projects/Minor_management/client/src/pages/FacultyDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('const [panelGroups, setPanelGroups]')) {
    content = content.replace(
        `const [loadingMentees, setLoadingMentees] = useState(false);`,
        `const [loadingMentees, setLoadingMentees] = useState(false);\n    const [panelGroups, setPanelGroups] = useState<any[]>([]);\n    const [manualMarksMode, setManualMarksMode] = useState(false);`
    );
}

if (!content.includes('const fetchPanelGroups = async')) {
    content = content.replace(
        `const fetchMentees = async () => {`,
        `const fetchPanelGroups = async () => {
        try {
            const res = await api.get('/panels/my-panels');
            setPanelGroups(res.data);
        } catch (error) {
            console.error("Failed to fetch panel groups", error);
        }
    };

    const fetchMentees = async () => {`
    );
}

// Ensure fetchPanelGroups is called
if (!content.includes('fetchPanelGroups();')) {
    content = content.replace(
        `} else if (['mentees', 'mid-term', 'end-term', 'final-report'].includes(activeTab)) {
            fetchMentees();`,
        `} else if (['mentees', 'mid-term', 'end-term', 'final-report'].includes(activeTab)) {
            fetchMentees();
            fetchPanelGroups();`
    );

    content = content.replace(
        `// Refresh Data\n            await fetchMentees();`,
        `// Refresh Data\n            await fetchMentees();\n            await fetchPanelGroups();`
    );
}

// Modify auto-calculate hook
content = content.replace(
    `setEvaluationMarks(total);\n        }\n    }, [evaluationDetails, evaluationType]);`,
    `if (!manualMarksMode) setEvaluationMarks(total);\n        }\n    }, [evaluationDetails, evaluationType, manualMarksMode]);`
);

if (!content.includes('setManualMarksMode(false);')) {
    content = content.replace(
        `setEvaluatingProject(item);\n        setEvaluationType(type);`,
        `setEvaluatingProject(item);\n        setEvaluationType(type);\n        setManualMarksMode(false);`
    );
}

// Insert renderEvalCard
if (!content.includes('const renderEvalCard =')) {
    const cardFunc = `
const renderEvalCard = (item: any, activeTab: string, handleOpenEvaluation: any, isPanel: boolean = false) => {
    const projectData = item.project || item;
    const evalData = activeTab === 'mid-term' ? projectData?.midTermEvaluation :
        activeTab === 'end-term' ? projectData?.endTermEvaluation :
        projectData?.finalReportEvaluation;
    const isEvaluated = !!evalData;
    const RUBRIC_CONFIG = {
        'mid-term': { maxMarks: 30 },
        'end-term': { maxMarks: 50 },
        'final-report': { maxMarks: 20 }
    } as any;
    
    return (
        <div key={item._id} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col h-full">
            {isEvaluated && (
                <div className="absolute top-0 right-0 p-3 bg-green-50 rounded-bl-2xl border-l border-b border-green-100 text-green-700 flex items-center gap-1.5 font-bold text-xs z-10">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>
                    Evaluated
                </div>
            )}
            {isPanel && (
                <div className="absolute top-0 left-0 p-2 bg-amber-50 rounded-br-2xl border-r border-b border-amber-100 text-amber-700 font-bold text-[10px] z-10">
                    Panel Eval
                </div>
            )}
            <div className="mb-4 mt-2">
                <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1 pr-8" title={projectData?.title}>{projectData?.title || 'Untitled Project'}</h3>
                <p className="text-sm text-neutral-500 font-medium flex items-center gap-1.5 align-middle">
                     {item.name || item.group?.name}
                </p>
            </div>
             {projectData?.attachments && projectData.attachments.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {projectData.attachments.slice(0, 2).map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-50 text-indigo-600 rounded-lg text-xs font-bold border border-neutral-200 hover:bg-neutral-100" onClick={(e) => e.stopPropagation()}>
                            File {idx+1}
                        </a>
                    ))}
                </div>
            )}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex flex-col gap-3 group-hover:border-indigo-100 transition-colors mt-auto">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Score</span>
                    <span className={\`text-xl font-bold \${isEvaluated ? 'text-indigo-600' : 'text-neutral-300'}\`}>
                        {isEvaluated ? evalData.marks : '--'} <span className="text-sm text-neutral-400 font-medium">/ {RUBRIC_CONFIG[activeTab]?.maxMarks || 100}</span>
                    </span>
                </div>
                <button
                    onClick={() => handleOpenEvaluation(item, activeTab as 'mid-term' | 'end-term' | 'final-report')}
                    className={\`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all \${isEvaluated
                        ? 'bg-white border text-neutral-600 hover:text-indigo-600 hover:bg-neutral-50 hover:border-indigo-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }\`}
                >
                    {isEvaluated ? 'Edit Evaluation' : 'Evaluate Now'}
                </button>
            </div>
        </div>
    );
};
`;
    content = content.replace('const FacultyDashboard: React.FC = () => {', cardFunc + '\nconst FacultyDashboard: React.FC = () => {');
}

// Rewrite Evaluation View to show panel groups too
const evalViewStartIndex = content.indexOf('{Array.from({ length: 10 }, (_, i) => 2020 + i).reverse().map(batchYear => {');
const evalViewEndStr = '{filteredMentees.length === 0 && (';
const evalViewEndIndex = content.indexOf(evalViewEndStr, evalViewStartIndex);

if (evalViewStartIndex !== -1 && evalViewEndIndex !== -1 && !content.includes('const panelGroupsInBatch = panelGroups.filter')) {
    const replacement = `
                                            {Array.from({ length: 10 }, (_, i) => 2020 + i).reverse().map(batchYear => {
                                                const batchSuffix = batchYear.toString().slice(2);
                                                
                                                // My Mentees in this batch
                                                const batchProjects = filteredMentees.filter((item: any) => {
                                                    const members = item.members || item.group?.members || [];
                                                    return members.some((m: any) => m.rollNumber && m.rollNumber.startsWith(batchSuffix));
                                                });
                                                
                                                // Panel Groups in this batch
                                                const panelGroupsInBatch = panelGroups.filter((p: any) => p.panel.batchYear === batchYear);
                                                
                                                if (batchProjects.length === 0 && panelGroupsInBatch.length === 0) return null;

                                                return (
                                                    <div key={batchYear} className="space-y-4">
                                                        <div
                                                            className={\`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer transition-all group select-none relative overflow-hidden \${isBatchExpanded(batchYear.toString()) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50'}\`}
                                                            onClick={() => toggleBatch(batchYear.toString())}
                                                        >
                                                            {isBatchExpanded(batchYear.toString()) && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>}
                                                            <div className="flex items-center gap-4 pl-2">
                                                                <div className={\`p-2 rounded-xl transition-colors \${isBatchExpanded(batchYear.toString()) ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}\`}>
                                                                    <ChevronDown className={\`w-5 h-5 transition-transform duration-300 \${!isBatchExpanded(batchYear.toString()) ? '-rotate-90' : ''}\`} />
                                                                </div>
                                                                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-3">
                                                                    <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-base font-bold border border-indigo-100/50 shadow-sm">
                                                                        {batchSuffix}
                                                                    </span>
                                                                    Batch {batchYear}
                                                                </h3>
                                                            </div>
                                                            <span className="text-sm font-bold text-neutral-600 bg-white px-4 py-2 rounded-xl border border-neutral-200 mr-2 shadow-sm">
                                                                {batchProjects.length + panelGroupsInBatch.reduce((sum: number, p: any) => sum + p.groups.length, 0)} Projects
                                                            </span>
                                                        </div>

                                                        {isBatchExpanded(batchYear.toString()) && (
                                                            <div className="space-y-8 pl-4 border-l-2 border-indigo-100 ml-4 pb-4 mt-4">
                                                                {/* My Mentees */}
                                                                {batchProjects.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-lg font-bold text-neutral-700 mb-4 bg-white inline-block px-4 py-1.5 rounded-lg border border-neutral-200 shadow-sm">My Mentee Groups</h4>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                            {batchProjects.map((item: any) => renderEvalCard(item, activeTab, handleOpenEvaluation, false))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Panel Groups */}
                                                                {panelGroupsInBatch.map((pData: any, idx: number) => {
                                                                    if (pData.groups.length === 0) return null;
                                                                    // Group by faculty
                                                                    const facultyGroups: Record<string, any[]> = {};
                                                                    pData.groups.forEach((g: any) => {
                                                                        const facId = typeof g.project.faculty === 'string' ? g.project.faculty : g.project.faculty?._id;
                                                                        const facName = typeof g.project.faculty === 'string' ? 'Unknown' : g.project.faculty?.name;
                                                                        if (!facultyGroups[facId]) facultyGroups[facId] = { name: facName, groups: [] };
                                                                        facultyGroups[facId].groups.push(g);
                                                                    });

                                                                    return (
                                                                        <div key={idx} className="mt-8 border border-indigo-100 rounded-2xl p-6 bg-white outline outline-1 outline-indigo-50 shadow-sm relative overflow-hidden">
                                                                             <div className="absolute top-0 right-0 py-1 px-4 bg-indigo-50 rounded-bl-xl text-indigo-700 font-bold text-xs border-b border-l border-indigo-100 shadow-sm">
                                                                                Evaluation Panel
                                                                             </div>
                                                                             <h4 className="text-xl font-bold text-indigo-900 mb-6 flex items-center gap-2">
                                                                                <Users className="w-5 h-5 text-indigo-500" />
                                                                                {pData.panel.name}
                                                                             </h4>
                                                                             {Object.values(facultyGroups).map((facInfo: any, fIdx: number) => (
                                                                                <div key={fIdx} className="mb-6 last:mb-0">
                                                                                    <h5 className="text-sm font-bold tracking-wider uppercase text-neutral-500 mb-4 flex items-center gap-2">
                                                                                        Guide: {facInfo.name}
                                                                                    </h5>
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                                        {facInfo.groups.map((item: any) => renderEvalCard(item, activeTab, handleOpenEvaluation, true))}
                                                                                    </div>
                                                                                </div>
                                                                             ))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            
                                            `;
    content = content.substring(0, evalViewStartIndex) + replacement + content.substring(evalViewEndIndex);
}

const toggleUI = `
                                            <div className="flex items-center justify-between mb-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                                <span className="text-sm font-bold text-indigo-900">Evaluation Mode</span>
                                                <div className="flex bg-white rounded-lg border border-indigo-100 p-1 shadow-sm">
                                                    <button 
                                                        onClick={() => setManualMarksMode(false)}
                                                        className={\`px-3 py-1.5 text-xs font-bold rounded-md transition \${!manualMarksMode ? 'bg-indigo-600 text-white shadow' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}\`}
                                                    >
                                                        Auto Sum
                                                    </button>
                                                    <button 
                                                        onClick={() => setManualMarksMode(true)}
                                                        className={\`px-3 py-1.5 text-xs font-bold rounded-md transition \${manualMarksMode ? 'bg-indigo-600 text-white shadow' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}\`}
                                                    >
                                                        Manual Entry
                                                    </button>
                                                </div>
                                            </div>
`;

if (!content.includes('Evaluation Mode')) {
    const rubricsCodeToReplace = "{RUBRIC_CONFIG[evaluationType].sections.map((section: any, idx: number) => (";
    content = content.replace(
        rubricsCodeToReplace,
        toggleUI + "\\n                                    " + rubricsCodeToReplace
    );
}

// Ensure the evaluation fields are handling disabled correctly
const replaceSmallInput = 'onChange={(e) => handleDetailChange(section.key, field.key, e.target.value)}\\n                                                                        disabled={manualMarksMode}';

if (!content.includes('disabled={manualMarksMode}')) {
    content = content.split('onChange={(e) => handleDetailChange(section.key, field.key, e.target.value)}').join(replaceSmallInput);

    // Total marks input manually entry
    content = content.replace(
        'value={evaluationMarks}\n                                                    readOnly',
        'value={evaluationMarks}\n                                                    onChange={(e) => setEvaluationMarks(Number(e.target.value))}\n                                                    disabled={!manualMarksMode}'
    );

    content = content.replace(
        'className="w-24 text-center px-4 py-3 bg-neutral-100 border border-transparent rounded-xl font-bold text-indigo-700 text-xl focus:outline-none"',
        "className={`w-24 text-center px-4 py-3 ${!manualMarksMode ? 'bg-neutral-100 border-transparent' : 'bg-white border-neutral-300'} border rounded-xl font-bold text-indigo-700 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}"
    );
}

fs.writeFileSync(path, content, 'utf8');
console.log('FacultyDashboard.tsx patched successfully.');
