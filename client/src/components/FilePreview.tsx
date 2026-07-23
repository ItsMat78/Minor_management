import React, { useState } from 'react';
import { FileText, Film, Download, ExternalLink } from 'lucide-react';
import { resolveUploadUrl } from '../utils/uploadUrl';

interface FilePreviewProps {
    url: string;
    description?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({ url: rawUrl, description }) => {
    // Stored attachment URLs carry whatever host they were uploaded through — re-point
    // them at this client's API origin. See utils/uploadUrl.ts.
    const url = resolveUploadUrl(rawUrl) || rawUrl;
    const fileName = url.split('/').pop() || 'File';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(extension);
    const isPdf = ['pdf'].includes(extension);
    const [isHovered, setIsHovered] = useState(false);

    if (isImage) {
        return (
            <div
                className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0"
                style={{ width: '200px', height: '140px' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <img
                    src={url}
                    alt={description || fileName}
                    className="w-full h-full object-cover group-hover:opacity-75 transition-opacity cursor-pointer"
                    onClick={() => window.open(url, '_blank')}
                    title={fileName}
                />
                {isHovered && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                        <ExternalLink className="text-white w-6 h-6 drop-shadow-md" />
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 px-2 truncate">
                    {description || fileName}
                </div>
            </div>
        );
    }

    if (isVideo) {
        return (
            <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-black flex-shrink-0" style={{ width: '320px', height: '180px' }}>
                <video
                    src={url}
                    controls
                    className="w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2 bg-black/50 p-1 rounded">
                    <Film className="text-white w-4 h-4" />
                </div>
            </div>
        );
    }

    if (isPdf) {
        return (
            <div className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 w-64">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={fileName}>{description || fileName}</p>
                    <p className="text-xs text-gray-500 uppercase">PDF Document</p>
                </div>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                    title="Open PDF"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        );
    }

    // Default Fallback
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
        >
            <Download className="w-4 h-4" />
            <span className="truncate max-w-[150px]" title={fileName}>{description || fileName}</span>
        </a>
    );
};

export default FilePreview;
