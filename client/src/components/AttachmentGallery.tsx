import React from 'react';
import { ExternalLink } from 'lucide-react';
import FilePreview from './FilePreview';

interface AttachmentGalleryProps {
    urls: string[];
    className?: string;
}

// A proposal's `attachments` array holds two different things: files the group uploaded, and bare
// URLs they typed into the links field (createProject and updateProject both fold `links` into the
// same array). Uploads get a real preview — image thumbnail, PDF card, inline player — while a link
// has no file behind it to preview, so it stays a labelled row.
const isExternalLink = (url: string) => url.startsWith('http') && !url.includes('/uploads/');

// Host + path, e.g. "github.com/team/repo" — far more use than the raw URL in a narrow column.
const linkLabel = (url: string): string => {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        return parsed.hostname.replace(/^www\./, '') + path;
    } catch {
        return url;
    }
};

const AttachmentGallery: React.FC<AttachmentGalleryProps> = ({ urls, className = '' }) => (
    <div className={`flex flex-wrap gap-3 ${className}`}>
        {urls.map((url, i) => (
            isExternalLink(url) ? (
                <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={url}
                    className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-xl hover:border-indigo-500 hover:shadow-sm group transition-all max-w-full"
                >
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                        <ExternalLink className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate max-w-[200px]">{linkLabel(url)}</p>
                        <p className="text-[9px] text-neutral-400 font-black uppercase tracking-widest leading-none mt-0.5">
                            External link
                        </p>
                    </div>
                </a>
            ) : (
                <FilePreview key={i} url={url} description={`Attachment ${i + 1}`} />
            )
        ))}
    </div>
);

export default AttachmentGallery;
