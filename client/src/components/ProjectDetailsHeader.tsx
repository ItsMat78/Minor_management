import React, { useState } from 'react';
import { Pencil, Check, X, Loader2, Paperclip, Trash2 } from 'lucide-react';
import api from '../utils/api';
import { errorMessage } from '../utils/apiError';

interface ProjectDetailsHeaderProps {
    project: any;
    /** True for the project's assigned mentor and for admins; the server checks this again. */
    canEdit: boolean;
    /** Called with ONLY the fields this component owns — see the note in `save`. */
    onSaved: (details: { title: string; description: string; tags: string[]; attachments: string[] }) => void;
    /** Tag chip classes — the two hosts style these differently, so neither is changed. */
    tagClassName?: string;
}

/** The name at the end of an uploaded file's URL, for listing it in the editor. */
const fileLabel = (url: string) => {
    try {
        return decodeURIComponent(url.split('/').pop() || url);
    } catch {
        return url.split('/').pop() || url;
    }
};

/**
 * The project's title, description, tags and attachments, editable in place by the mentor or
 * the admin.
 *
 * The group owns this content, but it used to be unwritable by anyone else — a wrong title stayed
 * wrong, and after mid-term evaluation froze the group out, nobody could fix it at all. Writes go
 * to PUT /projects/:id/details, which accepts only these fields, so nothing here can reassign the
 * project or move its status.
 *
 * Read-only rendering is byte-for-byte the previous markup at both call sites (MenteeGroupPage
 * and MenteeGroupDetails) so the pages look unchanged for anyone who cannot edit. Attachments
 * keep their own existing rendering in the hosts; only the editor is added here.
 */
const ProjectDetailsHeader: React.FC<ProjectDetailsHeaderProps> = ({
    project,
    canEdit,
    onSaved,
    tagClassName = 'px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold border border-gray-100',
}) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState({ title: '', description: '', tags: '' });
    // Attachments the edit will keep. Removing one here only takes effect on save.
    const [keptAttachments, setKeptAttachments] = useState<string[]>([]);
    const [newFiles, setNewFiles] = useState<File[]>([]);

    const open = () => {
        setDraft({
            title: project?.title || '',
            description: project?.description || '',
            tags: (project?.tags || []).join(', '),
        });
        setKeptAttachments(project?.attachments || []);
        setNewFiles([]);
        setError('');
        setEditing(true);
    };

    const removedCount = (project?.attachments || []).length - keptAttachments.length;

    const save = async () => {
        if (!draft.title.trim()) {
            setError('A project needs a title.');
            return;
        }
        if (removedCount > 0) {
            const ok = window.confirm(
                `${removedCount} attachment${removedCount === 1 ? '' : 's'} will be permanently deleted from the server. Continue?`
            );
            if (!ok) return;
        }

        setSaving(true);
        setError('');
        try {
            // Multipart because new files ride along. Same wire shape the student editor uses:
            // existingAttachments is the surviving list, files[] are the additions.
            const fd = new FormData();
            fd.append('title', draft.title);
            fd.append('description', draft.description);
            fd.append('tags', draft.tags);
            fd.append('existingAttachments', JSON.stringify(keptAttachments));
            newFiles.forEach(f => fd.append('files', f));

            const res = await api.put(`/projects/${project._id}/details`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // Hand back only the fields this component owns, never the whole response. The hosts
            // hold a POPULATED project — faculty is an object with a name — while the endpoint
            // returns the raw document, where faculty is a bare id. Merging the response wholesale
            // would silently replace the mentor object with a string and blank the mentor card.
            onSaved({
                title: res.data.title,
                description: res.data.description,
                tags: res.data.tags || [],
                attachments: res.data.attachments || [],
            });
            setEditing(false);
        } catch (err) {
            setError(errorMessage(err, 'Could not save those changes.'));
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <div className="mb-6 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Title</label>
                <input
                    value={draft.title}
                    onChange={e => setDraft({ ...draft, title: e.target.value })}
                    className="w-full text-xl font-bold text-gray-900 rounded-lg border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Project title"
                />

                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Description</label>
                <textarea
                    value={draft.description}
                    onChange={e => setDraft({ ...draft, description: e.target.value })}
                    rows={4}
                    className="w-full text-sm text-gray-700 rounded-lg border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="What the project is about"
                />

                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Tags</label>
                <input
                    value={draft.tags}
                    onChange={e => setDraft({ ...draft, tags: e.target.value })}
                    className="w-full text-sm text-gray-700 rounded-lg border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Comma separated, e.g. machine learning, vision"
                />

                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Attachments</label>

                {keptAttachments.length === 0 && newFiles.length === 0 ? (
                    <p className="text-xs text-gray-400 mb-2">No attachments.</p>
                ) : (
                    <ul className="mb-2 space-y-1.5">
                        {keptAttachments.map(url => (
                            <li key={url} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                                <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="text-xs text-gray-700 truncate flex-1" title={fileLabel(url)}>{fileLabel(url)}</span>
                                <button
                                    onClick={() => setKeptAttachments(prev => prev.filter(u => u !== url))}
                                    title="Remove this attachment"
                                    className="shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </li>
                        ))}
                        {newFiles.map((f, i) => (
                            <li key={`new-${i}`} className="flex items-center gap-2 bg-emerald-50 rounded-lg border border-emerald-200 px-3 py-2">
                                <Paperclip className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-xs text-emerald-800 truncate flex-1" title={f.name}>{f.name}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 shrink-0">New</span>
                                <button
                                    onClick={() => setNewFiles(prev => prev.filter((_, idx) => idx !== i))}
                                    title="Don't upload this file"
                                    className="shrink-0 p-1 rounded text-emerald-500 hover:text-red-600 hover:bg-red-50"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 cursor-pointer hover:text-indigo-800">
                    <Paperclip className="w-3.5 h-3.5" /> Add files
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={e => {
                            const picked = Array.from(e.target.files || []);
                            // Server caps one request at 5 files, so stop here rather than
                            // letting the upload fail after they have chosen.
                            setNewFiles(prev => [...prev, ...picked].slice(0, 5));
                            e.target.value = '';
                        }}
                    />
                </label>

                <p className="mt-3 text-xs text-gray-500">
                    The group is emailed when you save. Their submissions and marks are untouched.
                    {removedCount > 0 && (
                        <span className="block mt-1 text-red-600 font-medium">
                            {removedCount} attachment{removedCount === 1 ? '' : 's'} will be deleted from the server on save.
                        </span>
                    )}
                </p>

                {error && (
                    <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                        {error}
                    </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save changes
                    </button>
                    <button
                        onClick={() => setEditing(false)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                    >
                        <X className="w-4 h-4" /> Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-start gap-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-900 capitalize leading-tight">
                    {project?.title || 'Untitled Project'}
                </h1>
                {canEdit && (
                    <button
                        onClick={open}
                        title="Edit title, description and tags"
                        className="shrink-0 mt-1.5 p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                )}
            </div>
            <p className="text-gray-500 leading-relaxed text-sm mb-6">
                {project?.description || 'No description provided.'}
            </p>

            {project?.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map((tag: string, i: number) => (
                        <span key={i} className={tagClassName}>{tag}</span>
                    ))}
                </div>
            )}
        </>
    );
};

export default ProjectDetailsHeader;
