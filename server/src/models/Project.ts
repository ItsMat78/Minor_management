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
    createdAt: Date;
    isArchived?: boolean;
    archivedMentorName?: string;
    updates: {
        title?: string;
        content: string;
        date: Date;
        attachments?: string[];
        links?: string[];
    }[];
    hasNewUpdate: boolean;
    submissions?: {
        midTermReport?: string;
        midTermPPT?: string;
        endTermReport?: string;
        endTermPPT?: string;
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
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    semester: { type: Number },
    status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
    attachments: [{ type: String }],
    feedback: { type: String },
    updates: [{
        title: { type: String },
        content: { type: String, required: true },
        date: { type: Date, default: Date.now },
        attachments: [{ type: String }],
        links: [{ type: String }]
    }],
    hasNewUpdate: { type: Boolean, default: false }, // Flag for faculty notification
    submissions: {
        midTermReport: { type: String },
        midTermPPT: { type: String },
        endTermReport: { type: String },
        endTermPPT: { type: String },
        finalReport: { type: String },
        finalPPT: { type: String },
        plagiarismReport: { type: String }
    },
    midTermEvaluation: { type: Schema.Types.Mixed },
    endTermEvaluation: { type: Schema.Types.Mixed },
    finalReportEvaluation: { type: Schema.Types.Mixed },
    isArchived: { type: Boolean, default: false },
    archivedMentorName: { type: String }
}, {
    timestamps: true
});

export default mongoose.model<IProject>('Project', ProjectSchema);
