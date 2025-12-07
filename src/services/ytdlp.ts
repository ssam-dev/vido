/**
 * Video Download Service (Vercel-compatible)
 * 
 * Uses Cobalt API for video downloading - works on serverless platforms.
 * Supports YouTube, Instagram, TikTok, Twitter, Facebook, and more.
 */

import type {
  VideoInfo,
  VideoFormat,
  YtDlpVideoInfo,
  YtDlpFormat,
} from '@/types/video';

// Cobalt API endpoint (public instance)
const COBALT_API = 'https://api.cobalt.tools';

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Supported platforms
 */
const SUPPORTED_PLATFORMS = [
  { name: 'YouTube', patterns: [/youtube\.com/, /youtu\.be/] },
  { name: 'Instagram', patterns: [/instagram\.com/, /instagr\.am/] },
  { name: 'TikTok', patterns: [/tiktok\.com/, /vm\.tiktok\.com/] },
  { name: 'Twitter', patterns: [/twitter\.com/, /x\.com/] },
  { name: 'Facebook', patterns: [/facebook\.com/, /fb\.watch/] },
  { name: 'Reddit', patterns: [/reddit\.com/, /redd\.it/] },
  { name: 'Vimeo', patterns: [/vimeo\.com/] },
  { name: 'Twitch', patterns: [/twitch\.tv/, /clips\.twitch\.tv/] },
  { name: 'SoundCloud', patterns: [/soundcloud\.com/] },
  { name: 'Pinterest', patterns: [/pinterest\.com/, /pin\.it/] },
  { name: 'Tumblr', patterns: [/tumblr\.com/] },
  { name: 'Dailymotion', patterns: [/dailymotion\.com/] },
];

/**
 * Validates a video URL and detects the platform
 */
export function validateVideoUrl(url: string): { isValid: boolean; platform: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, platform: 'Unknown', error: 'URL is required' };
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return { isValid: false, platform: 'Unknown', error: 'Invalid URL format' };
  }

  // Detect platform
  for (const platform of SUPPORTED_PLATFORMS) {
    for (const pattern of platform.patterns) {
      if (pattern.test(url)) {
        return { isValid: true, platform: platform.name };
      }
    }
  }

  // Allow any URL - Cobalt will handle unsupported ones
  return { isValid: true, platform: 'Other' };
}

// ============================================================================
// COBALT API INTEGRATION
// ============================================================================

interface CobaltResponse {
  status: 'error' | 'redirect' | 'stream' | 'success' | 'rate-limit' | 'picker';
  text?: string;
  url?: string;
  pickerType?: 'various' | 'images';
  picker?: Array<{
    type: 'video' | 'photo';
    url: string;
    thumb?: string;
  }>;
  audio?: string;
}

/**
 * Fetch video info using Cobalt API
 */
export async function fetchVideoInfo(url: string): Promise<YtDlpVideoInfo> {
  try {
    const response = await fetch(`${COBALT_API}/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        downloadMode: 'auto',
        filenameStyle: 'pretty',
        videoQuality: '1080',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cobalt API error: ${response.status} - ${errorText}`);
    }

    const data: CobaltResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(data.text || 'Failed to process video');
    }

    if (data.status === 'rate-limit') {
      throw new Error('Rate limited. Please try again in a few seconds.');
    }

    // Handle different response types
    let downloadUrl = '';
    let thumbnail = '';
    let isPhoto = false;

    if (data.status === 'redirect' || data.status === 'stream') {
      downloadUrl = data.url || '';
    } else if (data.status === 'picker' && data.picker && data.picker.length > 0) {
      // Multiple items (e.g., Instagram carousel)
      const firstItem = data.picker[0];
      downloadUrl = firstItem.url;
      thumbnail = firstItem.thumb || '';
      isPhoto = firstItem.type === 'photo';
    }

    if (!downloadUrl) {
      throw new Error('No download URL available');
    }

    // Detect platform for title
    const validation = validateVideoUrl(url);
    const platform = validation.platform;

    // Build response in YtDlpVideoInfo format for compatibility
    const videoInfo: YtDlpVideoInfo = {
      id: Buffer.from(url).toString('base64').substring(0, 11),
      title: `${platform} Video`,
      description: '',
      thumbnail: thumbnail || '',
      duration: 0,
      uploader: platform,
      uploader_id: '',
      view_count: 0,
      like_count: 0,
      upload_date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
      webpage_url: url,
      extractor: platform.toLowerCase(),
      ext: isPhoto ? 'jpg' : 'mp4',
      url: downloadUrl,
      formats: [
        {
          format_id: 'best',
          ext: isPhoto ? 'jpg' : 'mp4',
          url: downloadUrl,
          width: isPhoto ? 1080 : 1920,
          height: isPhoto ? 1080 : 1080,
          filesize: undefined,
          format_note: isPhoto ? 'Original' : 'HD',
          vcodec: isPhoto ? 'none' : 'h264',
          acodec: isPhoto ? 'none' : 'aac',
        },
      ],
      _type: isPhoto ? 'photo' : 'video',
    };

    return videoInfo;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide helpful error messages
    if (message.includes('fetch')) {
      throw new Error('Could not connect to video service. Please try again.');
    }
    if (message.includes('rate')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    
    throw new Error(`Failed to fetch video: ${message}`);
  }
}

// ============================================================================
// FORMAT SELECTION
// ============================================================================

/**
 * Select format based on quality preference
 */
export function selectFormat(formats: YtDlpFormat[], quality: 'sd' | 'hd'): YtDlpFormat | null {
  if (!formats || formats.length === 0) return null;
  
  // For Cobalt, we typically get one best format
  // Return the first available format
  return formats[0];
}

/**
 * Select photo format
 */
export function selectPhotoFormat(formats: YtDlpFormat[]): YtDlpFormat | null {
  if (!formats || formats.length === 0) return null;
  return formats[0];
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Convert YtDlpVideoInfo to VideoInfo
 */
export function toVideoInfo(info: YtDlpVideoInfo, platform: string): VideoInfo {
  const isPhoto = info._type === 'photo' || 
                  info.ext === 'jpg' || 
                  info.ext === 'png' || 
                  info.ext === 'webp';

  return {
    id: info.id,
    title: info.title || `${platform} ${isPhoto ? 'Photo' : 'Video'}`,
    description: info.description || '',
    thumbnail: info.thumbnail || '',
    duration: info.duration || 0,
    uploader: info.uploader || info.uploader_id || platform,
    viewCount: info.view_count || 0,
    likeCount: info.like_count || 0,
    uploadDate: info.upload_date || '',
    platform,
    originalUrl: info.webpage_url || '',
    mediaType: isPhoto ? 'photo' : 'video',
  };
}

/**
 * Convert YtDlpFormat to VideoFormat
 */
export function toVideoFormat(format: YtDlpFormat): VideoFormat {
  const isPhoto = format.vcodec === 'none' && format.acodec === 'none';
  
  let resolution = 'Unknown';
  if (format.height) {
    resolution = `${format.height}p`;
  } else if (format.format_note) {
    resolution = format.format_note;
  }

  return {
    formatId: format.format_id,
    ext: format.ext || 'mp4',
    resolution,
    filesize: format.filesize || null,
    quality: format.format_note || resolution,
  };
}

/**
 * Get download URL from format
 */
export function getDownloadUrl(format: YtDlpFormat): string {
  return format.url || '';
}
