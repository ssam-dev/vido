/**
 * Video Download Service (Vercel-compatible)
 * 
 * Uses multiple free APIs for video downloading - works on serverless platforms.
 * Supports YouTube, Instagram, TikTok, Twitter, Facebook, and more.
 */

import type {
  VideoInfo,
  VideoFormat,
  YtDlpVideoInfo,
  YtDlpFormat,
} from '@/types/video';

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

  // Allow any URL
  return { isValid: true, platform: 'Other' };
}

// ============================================================================
// VIDEO FETCH APIs
// ============================================================================

/**
 * Try multiple free APIs to fetch video info
 */
export async function fetchVideoInfo(url: string): Promise<YtDlpVideoInfo> {
  const validation = validateVideoUrl(url);
  const platform = validation.platform;
  
  // Try different APIs based on platform
  const errors: string[] = [];
  
  // Try AllTube API (supports many platforms)
  try {
    const result = await fetchFromAllTube(url, platform);
    if (result) return result;
  } catch (e) {
    errors.push(`AllTube: ${e instanceof Error ? e.message : 'failed'}`);
  }

  // Try SaveFrom-style API
  try {
    const result = await fetchFromSaveFrom(url, platform);
    if (result) return result;
  } catch (e) {
    errors.push(`SaveFrom: ${e instanceof Error ? e.message : 'failed'}`);
  }

  // If all APIs fail, throw error
  throw new Error(
    `Could not fetch video. This may be due to:\n` +
    `• The video is private or age-restricted\n` +
    `• The platform is blocking requests\n` +
    `• The URL is invalid\n\n` +
    `Please try a different video or check if the video is publicly accessible.`
  );
}

/**
 * Fetch using AllTube-style API
 */
async function fetchFromAllTube(url: string, platform: string): Promise<YtDlpVideoInfo | null> {
  // Use a public extractors API
  const apiUrl = `https://api.vevioz.com/api/button/mp4?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const html = await response.text();
  
  // Parse download links from response
  const downloadMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  
  if (!downloadMatch) {
    return null;
  }

  const downloadUrl = downloadMatch[1];
  const title = titleMatch ? titleMatch[1].replace(' - vevioz', '').trim() : `${platform} Video`;

  return createVideoInfo(url, downloadUrl, title, platform, false);
}

/**
 * Fetch using SaveFrom-style approach  
 */
async function fetchFromSaveFrom(url: string, platform: string): Promise<YtDlpVideoInfo | null> {
  // Try ssyoutube API for YouTube
  if (platform === 'YouTube') {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      // Use YouTube's oEmbed for metadata
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      
      try {
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          
          // For YouTube, we'll return the embed info and let user know
          // direct downloads require external tools
          return {
            id: videoId,
            title: oembed.title || 'YouTube Video',
            description: '',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: 0,
            uploader: oembed.author_name || 'YouTube',
            uploader_id: '',
            view_count: 0,
            like_count: 0,
            upload_date: '',
            extractor: 'youtube',
            webpage_url: url,
            ext: 'mp4',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            formats: [
              {
                format_id: 'watch',
                ext: 'mp4',
                url: `https://www.youtube.com/watch?v=${videoId}`,
                width: 1920,
                height: 1080,
                format_note: 'YouTube Video (use external downloader)',
              },
            ],
            _type: 'video',
          };
        }
      } catch {
        // Continue to next method
      }
    }
  }

  return null;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Create a standardized video info object
 */
function createVideoInfo(
  originalUrl: string,
  downloadUrl: string,
  title: string,
  platform: string,
  isPhoto: boolean
): YtDlpVideoInfo {
  return {
    id: Buffer.from(originalUrl).toString('base64').substring(0, 11),
    title: title || `${platform} ${isPhoto ? 'Photo' : 'Video'}`,
    description: '',
    thumbnail: '',
    duration: 0,
    uploader: platform,
    uploader_id: '',
    view_count: 0,
    like_count: 0,
    upload_date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    webpage_url: originalUrl,
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
        format_note: isPhoto ? 'Original' : 'HD',
        vcodec: isPhoto ? 'none' : 'h264',
        acodec: isPhoto ? 'none' : 'aac',
      },
    ],
    _type: isPhoto ? 'photo' : 'video',
  };
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
