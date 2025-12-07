/**
 * Video Result Card Component
 * 
 * Displays video/photo information and download button
 */

import type { VideoFetchResponse } from '@/types/video';
import { formatDuration, formatFileSize } from '@/utils/formatters';

interface VideoResultCardProps {
  data: VideoFetchResponse;
  onDownload: () => void;
}

export default function VideoResultCard({ data, onDownload }: VideoResultCardProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/20">
        {/* Thumbnail */}
        {data.info.thumbnail && (
          <div className="relative aspect-video bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.info.thumbnail}
              alt={data.info.title}
              className="w-full h-full object-contain"
            />
            {/* Duration overlay - only show for videos */}
            {data.info.mediaType !== 'photo' && data.info.duration > 0 && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-sm px-2 py-1 rounded">
                {formatDuration(data.info.duration)}
              </span>
            )}
            {/* Photo badge - only show for photos */}
            {data.info.mediaType === 'photo' && (
              <span className="absolute bottom-2 right-2 bg-green-600/80 text-white text-sm px-2 py-1 rounded flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Photo
              </span>
            )}
          </div>
        )}

        {/* Video information */}
        <div className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 line-clamp-2">
            {data.info.title}
          </h2>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
            {/* Uploader/Channel name */}
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {data.info.uploader}
            </span>
            
            {/* Platform badge */}
            <span className="flex items-center gap-1 capitalize">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {data.info.platform}
            </span>

            {/* Selected quality and format info */}
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {data.selectedFormat.quality} • {data.selectedFormat.ext.toUpperCase()}
            </span>

            {/* File size if available */}
            {data.selectedFormat.filesize && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {formatFileSize(data.selectedFormat.filesize)}
              </span>
            )}
          </div>

          {/* Download button */}
          <button
            onClick={onDownload}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white
                       bg-gradient-to-r from-green-500 to-emerald-600 
                       hover:from-green-600 hover:to-emerald-700
                       transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download {data.info.mediaType === 'photo' ? 'Photo' : data.selectedFormat.quality}
          </button>
        </div>
      </div>
    </div>
  );
}
