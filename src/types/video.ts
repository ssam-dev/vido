/**
 * Media Download Types
 * 
 * These TypeScript interfaces define the structure for video and photo download requests
 * and responses. Copilot should use these types for type-safe API interactions.
 */

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * MediaFetchRequest - Request body for the /api/fetch-video endpoint
 * 
 * @property url - The media URL from any supported website
 * @property quality - The desired quality: 'sd' for ≤480p, 'hd' for 1080p priority (for videos)
 * @property mediaType - Type of media to download: 'video' or 'photo'
 * 
 * Copilot: Use this interface when validating incoming API requests
 */
export interface VideoFetchRequest {
  url: string;
  quality: 'sd' | 'hd';
  mediaType?: 'video' | 'photo' | 'auto'; // auto will detect automatically
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * VideoFormat - Represents a single video format/quality option
 * 
 * @property formatId - yt-dlp format identifier
 * @property ext - File extension (mp4, webm, etc.)
 * @property resolution - Video resolution (e.g., "1920x1080")
 * @property filesize - Approximate file size in bytes
 * @property quality - Human-readable quality label
 * 
 * Copilot: Map yt-dlp JSON output to this structure
 */
export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  quality: string;
}

/**
 * VideoInfo - Metadata about the requested media (video or photo)
 * 
 * @property title - Media title
 * @property thumbnail - URL to thumbnail/preview
 * @property duration - Video duration in seconds (0 for photos)
 * @property uploader - Channel/page name
 * @property platform - Detected platform
 * @property mediaType - Type of media: 'video' or 'photo'
 * 
 * Copilot: Extract this from yt-dlp --dump-json output
 */
export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  platform: 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'vimeo' | 'other' | 'unknown';
  mediaType: 'video' | 'photo';
}

/**
 * VideoFetchResponse - Successful response from /api/fetch-video
 * 
 * @property success - Always true for successful responses
 * @property info - Video metadata
 * @property downloadUrl - Direct download URL for the selected quality
 * @property selectedFormat - Details about the chosen format
 * 
 * Copilot: Return this structure on successful video fetch
 */
export interface VideoFetchResponse {
  success: true;
  info: VideoInfo;
  downloadUrl: string;
  selectedFormat: VideoFormat;
}

/**
 * VideoFetchError - Error response from /api/fetch-video
 * 
 * @property success - Always false for error responses
 * @property error - Human-readable error message
 * @property code - Machine-readable error code for client handling
 * 
 * Copilot: Return this structure when video fetch fails
 */
export interface VideoFetchError {
  success: false;
  error: string;
  code: 'INVALID_URL' | 'UNSUPPORTED_PLATFORM' | 'VIDEO_UNAVAILABLE' | 'QUALITY_NOT_FOUND' | 'YTDLP_ERROR' | 'UNKNOWN_ERROR';
}

/**
 * Union type for all possible API responses
 * Copilot: Use this for API response typing
 */
export type VideoFetchResult = VideoFetchResponse | VideoFetchError;

// ============================================================================
// YT-DLP INTERNAL TYPES
// ============================================================================

/**
 * YtDlpFormat - Raw format object from yt-dlp JSON output
 * 
 * Copilot: This represents the structure yt-dlp returns for each format.
 * Use this to parse and filter formats based on quality requirements.
 */
export interface YtDlpFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  width?: number;
  height?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  vcodec?: string;
  acodec?: string;
  url?: string;
}

/**
 * YtDlpVideoInfo - Parsed video info from yt-dlp --dump-json
 * 
 * Copilot: Parse yt-dlp JSON output into this structure before
 * converting to our VideoInfo type
 */
export interface YtDlpVideoInfo {
  title: string;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
  duration?: number;
  uploader?: string;
  channel?: string;
  extractor_key?: string;
  webpage_url?: string;
  formats?: YtDlpFormat[];
  url?: string;
}
