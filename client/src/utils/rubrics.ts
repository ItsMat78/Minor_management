// Default evaluation rubric, used whenever an evaluation event was created without a custom
// rubric (event.rubricParams). Shared by the faculty marking screens and the student view.
export const DEFAULT_RUBRIC_CONFIG: any = {
    'mid-term': {
        maxMarks: 30,
        sections: [
            {
                title: 'Guide Evaluation',
                maxMarks: 15,
                fields: [
                    { key: 'dataElicitation', label: 'Data Elicitation', max: 5, description: 'Identifies topic, explores basic trends' },
                    { key: 'problemDefinition', label: 'Problem Definition', max: 5, description: 'Simple and well-scoped' },
                    { key: 'planning', label: 'Planning', max: 5, description: 'Basic timeline, effort distribution' },
                ],
                key: 'guide'
            },
            {
                title: 'Panel Evaluation',
                maxMarks: 15,
                fields: [
                    { key: 'literatureSurvey', label: 'Literature Survey', max: 5, description: '4-6 generic online sources' },
                    { key: 'presentationSkills', label: 'Presentation Skills', max: 5, description: 'Basic slide design, clarity in speech' },
                    { key: 'technicalUnderstanding', label: 'Technical Understanding', max: 5, description: 'Working knowledge of tools' },
                ],
                key: 'panel'
            }
        ]
    },
    'end-term': {
        maxMarks: 70,
        sections: [
            {
                title: 'Guide Evaluation',
                maxMarks: 35,
                fields: [
                    { key: 'requirementSpecification', label: 'Requirement Specification', max: 7, description: 'Functional needs outlined' },
                    { key: 'systemDesign', label: 'System Design', max: 7, description: 'Block diagram or flowchart' },
                    { key: 'implementation', label: 'Implementation', max: 7, description: 'Working model with basic coding' },
                    { key: 'projectManagement', label: 'Project Management', max: 7, description: 'Manual task tracking, logbook' },
                    { key: 'planningVsExecution', label: 'Planning vs Execution', max: 7, description: 'Deviations noted casually' },
                ],
                key: 'guide'
            },
            {
                title: 'Panel Evaluation',
                maxMarks: 35,
                fields: [
                    { key: 'testingAndResults', label: 'Testing & Results', max: 10, description: 'Functional testing with screenshots' },
                    { key: 'innovationAndRelevance', label: 'Innovation & Relevance', max: 5, description: 'Minor creative aspect' },
                    { key: 'presentationAndViva', label: 'Presentation & Viva', max: 10, description: 'Clear explanation, guided answers' },
                    { key: 'conceptualDepth', label: 'Conceptual Depth', max: 10, description: 'Understanding basic tools and outcomes' },
                ],
                key: 'panel'
            }
        ]
    }
};
