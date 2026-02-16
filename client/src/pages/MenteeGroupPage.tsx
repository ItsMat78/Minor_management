
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

import {
    ChevronLeft, Clock, Users, FileText, Link as LinkIcon
} from 'lucide-react';

const MenteeGroupPage: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    const fetchGroupDetails = async () => {
        try {
            // Re-using the getMyMentees endpoint and filtering, or we should make a specific endpoint
            // Ideally we should have a `getGroupById` endpoint that includes project details
            // For now, let's assume we can fetch all mentees and filter, or use a new endpoint.
            // Let's use the existing /groups/:id endpoint but we need to ensure it populates project updates.
            // Wait, /groups/:id might be restricted to members.
            // As a faculty, I should likely be able to view any group I mentor.

            // Let's rely on the `fetchMentees` logic but filter on client side if we don't have a direct endpoint yet, 
            // OR use the `api.get('/groups/mentees')` and find the one.
            // A better approach for specific page is a direct API call.

            // Let's try to get mentees list and find the group for now to avoid backend changes if possible, 
            // but for a dedicated page, a direct fetch is better.
            // Let's assume we can use the `getGroup` controller but we need to ensure faculty has access.
            // The `getGroup` logic in backend usually checks membership.

            // Actually, let's use the `/groups/mentees` endpoint and filter for now as it's safe.
            const res = await api.get('/groups/mentees');
            const foundGroup = res.data.find((g: any) => g._id === groupId);

            if (foundGroup) {
                setGroup(foundGroup);
                // Mark updates as read if viewing the page
                if (foundGroup.project?.hasNewUpdate) {
                    await api.put(`/projects/${foundGroup.project._id}/updates/read`);
                }
            } else {
                console.error("Group not found or not authorized");
                // navigate('/dashboard'); 
            }
        } catch (error) {
            console.error("Failed to fetch group details", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!group) return <div className="p-8 text-center">Group not found.</div>;

    return (
        <div className="min-h-screen bg-neutral-50 p-6 md:p-10 font-jakarta">
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-neutral-600 hover:text-indigo-600 mb-6 transition-colors"
            >
                <ChevronLeft className="w-5 h-5 mr-1" /> Back to Dashboard
            </button>

            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                            <p className="text-gray-500 mt-1">Project: <span className="font-semibold text-gray-800">{group.project?.title || 'No Project'}</span></p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${group.project?.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            group.project?.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                            {group.project?.status || 'Active'}
                        </span>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-6">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="w-4 h-4" />
                            <span>{group.members.length} Members</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="w-4 h-4" />
                            <span>{group.project?.updates?.length || 0} Usage Updates</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Members Column */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Team Members</h3>
                            <div className="space-y-4">
                                {group.members.map((member: any) => (
                                    <div key={member._id} className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 shrink-0">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                                            <p className="text-xs text-gray-500">{member.rollNumber}</p>
                                            <p className="text-xs text-gray-400">{member.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Project Description */}
                        {group.project && (
                            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">About Project</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {group.project.description}
                                </p>
                                {group.project.tags && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {group.project.tags.map((tag: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Updates & Timeline Column */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 bg-gradient-to-b from-white to-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" /> Project Timeline
                            </h3>

                            {group.project?.updates && group.project.updates.length > 0 ? (
                                <div className="relative border-l-2 border-indigo-100 ml-3 space-y-8 pl-8 pb-4">
                                    {group.project.updates.slice().reverse().map((update: any, i: number) => (
                                        <div key={i} className="relative">
                                            {/* Dot */}
                                            <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full border-4 border-white bg-indigo-600 shadow-sm"></div>

                                            <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        {update.title && <h4 className="font-bold text-gray-900">{update.title}</h4>}
                                                        <span className="text-xs font-medium text-gray-500 block mb-2">
                                                            {new Date(update.date).toLocaleDateString()} at {new Date(update.date).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                                                    {update.content}
                                                </div>

                                                {/* Attachments & Links */}
                                                {(update.links?.length > 0 || update.attachments?.length > 0) && (
                                                    <div className="pt-3 border-t border-gray-50 flex flex-wrap gap-3">
                                                        {update.links?.map((link: string, li: number) => (
                                                            <a
                                                                key={li}
                                                                href={link.startsWith('http') ? link : `https://${link}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                                                            >
                                                                <LinkIcon className="w-3 h-3" /> Link {li + 1}
                                                            </a>
                                                        ))}
                                                        {/* Placeholder for attachments if we had files */}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-200">
                                    <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500">No updates posted yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MenteeGroupPage;
