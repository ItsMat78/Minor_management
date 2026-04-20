import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
    title: string;
    description: string;
    tags: string[];
    faculty: mongoose.Types.ObjectId; // User ID
    group: mongoose.Types.ObjectId; // Group ID
    semester?: number;
    status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
    attachments?: string[]; // URLs
    feedback?: string;
    studentFeedback?: {
        student: mongoose.Types.ObjectId;
        comment: string;
        updatedAt: Date;
    }[];
    studentEvaluations?: {
        student: mongoose.Types.ObjectId;
        stars: number;
        attendance: 'present' | 'absent';
        evalType: 'mid-term' | 'end-term';
        guide?: Record<string, number>;
        panel?: Record<string, number>;   // legacy
        panel1?: Record<string, number>;
        panel2?: Record<string, number>;
        marks?: number;
        updatedAt: Date;
    }[];
    createdAt: Date;
    isArchived?: boolean;
    archivedMentorName?: string;
    archivedGroupName?: string;
    archivedBatch?: string;
    archivedMembers?: { name: string; email?: string; rollNumber?: string; branch?: string }[];
    updates: {
        content: string;
        date: Date;
        attachments?: string[];
        links?: string[];
        createdBy?: mongoose.Types.ObjectId;
    }[];
    hasNewUpdate: boolean;
    submissions?: {
        midTermReport?: string;
        midTermPPT?: string;
        midTermPlagiarism?: string;
        endTermReport?: string;
        endTermPPT?: string;
        endTermPlagiarism?: string;
        // Legacy fields — kept for backward compatibility with existing data, no longer written
        finalReport?: string;
        finalPPT?: string;
        plagiarismReport?: string;
    };
    midTermEvaluation?: {
        marks: number;
        remarks: string;
        gradedBy: mongoose.Types.ObjectId;
        date: Date;
        guide: {
            dataElicitation: number;
            problemDefinition: number;
            planning: number;
        };
        panel: {
            literatureSurvey: number;
            presentationSkills: number;
            technicalUnderstanding: number;
        };
    };
    endTermEvaluation?: {
        marks: number;
        remarks: string;
        gradedBy: mongoose.Types.ObjectId;
        date: Date;
        guide: {
            requirementSpecification: number;
            systemDesign: number;
            implementation: number;
            projectManagement: number;
            planningVsExecution: number;
        };
        panel: {
            testingAndResults: number;
            innovationAndRelevance: number;
            presentationAndViva: number;
            conceptualDepth: number;
        };
    };
    finalReportEvaluation?: {
        marks: number;
        remarks: string;
        gradedBy: mongoose.Types.ObjectId;
        date: Date;
        guide: {
            reportWriting: number;
        };
        panel: {
            finalReport: number;
        };
    };
}

const ProjectSchema: Schema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [{ type: String }],
    faculty: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional now
    group: { type: Schema.Types.ObjectId, ref: 'Group' }, // Optional — archived imports may lack a live group
    semester: { type: Number },
    status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
    attachments: [{ type: String }],
    feedback: { type: String },
    studentFeedback: [{
        student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        comment: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now }
    }],
    studentEvaluations: [{
        student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        stars: { type: Number, min: 0, max: 5, default: 0 },
        attendance: { type: String, enum: ['present', 'absent'], default: 'present' },
        evalType: { type: String, enum: ['mid-term', 'end-term'] },
        guide: { type: Schema.Types.Mixed },
        panel: { type: Schema.Types.Mixed },   // legacy — treated as panel1 on read
        panel1: { type: Schema.Types.Mixed },  // E1 panel evaluator scores
        panel2: { type: Schema.Types.Mixed },  // E2 panel evaluator scores
        marks: { type: Number },
        updatedAt: { type: Date, default: Date.now }
    }],
    updates: [{
        content: { type: String, required: true },
        date: { type: Date, default: Date.now },
        attachments: [{ type: String }],
        links: [{ type: String }],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }],
    hasNewUpdate: { type: Boolean, default: false }, // Flag for faculty notification
    submissions: {
        midTermReport: { type: String },
        midTermPPT: { type: String },
        midTermPlagiarism: { type: String },
        endTermReport: { type: String },
        endTermPPT: { type: String },
        endTermPlagiarism: { type: String },
        // Legacy fields — read-only
        finalReport: { type: String },
        finalPPT: { type: String },
        plagiarismReport: { type: String }
    },
    midTermEvaluation: { type: Schema.Types.Mixed },
    endTermEvaluation: { type: Schema.Types.Mixed },
    finalReportEvaluation: { type: Schema.Types.Mixed },
    isArchived: { type: Boolean, default: false },
    archivedMentorName: { type: String },
    archivedGroupName: { type: String },
    archivedBatch: { type: String },
    archivedMembers: [{
        name: { type: String, required: true },
        email: { type: String },
        rollNumber: { type: String },
        branch: { type: String },
        _id: false
    }]
}, {
    timestamps: true
});

export default mongoose.model<IProject>('Project', ProjectSchema);
