/**
 * Video Download Service (Vercel-compatible)
 * 
 * Uses RapidAPI's video download APIs for reliable video downloading.
 * For free usage without API keys, we use public endpoints.
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

const SUPPORTED_PLATFORMS = [
  { name: 'YouTube', patterns: [/youtube\.com/, /youtu\.be/] },
  { name: 'Instagram', patterns: [/instagram\.com/, /instagr\.am/] },
  { name: 'TikTok', patterns: [/tiktok\.com/, /vm\.tiktok\.com/] },
  { name: 'Twitter', patterns: [/twitter\.com/, /x\.com/] },
  { name: 'Facebook', patterns: [/facebook\.com/, /fb\.watch/] },
  { name: 'Reddit', patterns: [/reddit\.com/, /redd\.it/] },
  { name: 'Vimeo', patterns: [/vimeo\.com/] },
  { name: 'Pinterest', patterns: [/pinterest\.com/, /pin\.it/] },
  { name: 'Dailymotion', patterns: [/dailymotion\.com/] },
];

export function validateVideoUrl(url: string): { isValid: boolean; platform: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, platform: 'Unknown', error: 'URL is required' };
  }

  try {
    new URL(url);
  } catch {
    return { isValid: false, platform: 'Unknown', error: 'Invalid URL format' };
  }

  for (const platform of SUPPORTED_PLATFORMS) {
    for (const pattern of platform.patterns) {
      if (pattern.test(url)) {
        return { isValid: true, platform: platform.name };
      }
    }
  }

  return { isValid: true, platform: 'Other' };
}

// ============================================================================
// VIDEO FETCH - Using cobalt.tools API with proper headers
// ============================================================================

export async function fetchVideoInfo(url: string): Promise<YtDlpVideoInfo> {
  const validation = validateVideoUrl(url);
  const platform = validation.platform;

  // Try Cobalt API first (most reliable)
  try {
    const result = await fetchFromCobalt(url, platform);
    if (result) return result;
  } catch (e) {
    console.error('Cobalt API failed:', e);
  }

  // Try alternative for YouTube
  if (platform === 'YouTube') {
    try {
      const result = await fetchYouTubeInfo(url);
      if (result) return result;
    } catch (e) {
      console.error('YouTube fetch failed:', e);
    }
  }

  // Try alternative for TikTok
  if (platform === 'TikTok') {
    try {
      const result = await fetchTikTokInfo(url);
      if (result) return result;
    } catch (e) {
      console.error('TikTok fetch failed:', e);
    }
  }

  throw new Error(
    `Unable to download from ${platform}. ` +
    `The video may be private, age-restricted, or the platform is blocking requests. ` +
    `Please try a different video.`
  );
}

// ============================================================================
// COBALT API (cobalt.tools)
// ============================================================================

async function fetchFromCobalt(url: string, platform: string): Promise<YtDlpVideoInfo | null> {
  // Cobalt API endpoint
  const apiUrl = 'https://api.cobalt.tools/';
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      url: url,
      vQuality: '1080',
      filenamePattern: 'basic',
      isAudioOnly: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    // Check if it's an auth error
    if (text.includes('jwt') || text.includes('auth')) {
      throw new Error('Cobalt API requires authentication');
    }
    throw new Error(`Cobalt API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status === 'error') {
    throw new Error(data.text || 'Cobalt API error');
  }

  let downloadUrl = '';
  let isPhoto = false;

  if (data.status === 'redirect' || data.status === 'stream') {
    downloadUrl = data.url;
  } else if (data.status === 'picker' && data.picker?.length > 0) {
    downloadUrl = data.picker[0].url;
    isPhoto = data.picker[0].type === 'photo';
  }

  if (!downloadUrl) {
    return null;
  }

  return createVideoInfo(url, downloadUrl, `${platform} Video`, platform, isPhoto);
}

// ============================================================================
// YOUTUBE - Using oEmbed + noembed for metadata
// ============================================================================

async function fetchYouTubeInfo(url: string): Promise<YtDlpVideoInfo | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  // Get video metadata from oEmbed
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  
  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) throw new Error('oEmbed failed');
    
    const data = await response.json();
    
    // Try to get download URL from a free YouTube download API
    const downloadUrl = await getYouTubeDownloadUrl(videoId);
    
    return {
      id: videoId,
      title: data.title || 'YouTube Video',
      description: '',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0,
      uploader: data.author_name || 'YouTube',
      uploader_id: '',
      view_count: 0,
      like_count: 0,
      upload_date: '',
      extractor: 'youtube',
      webpage_url: url,
      ext: 'mp4',
      url: downloadUrl || url,
      formats: downloadUrl ? [
        {
          format_id: 'hd',
          ext: 'mp4',
          url: downloadUrl,
          width: 1920,
          height: 1080,
          format_note: 'HD 1080p',
        },
      ] : [],
      _type: 'video',
    };
  } catch {
    return null;
  }
}

async function getYouTubeDownloadUrl(videoId: string): Promise<string | null> {
  // Try y2mate-style API
  try {
    const analyzeUrl = `https://www.y2mate.com/mates/analyzeV2/ajax`;
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `k_query=https://www.youtube.com/watch?v=${videoId}&k_page=home&hl=en&q_auto=1`,
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.links?.mp4) {
        // Get the highest quality mp4
        const qualities = Object.values(data.links.mp4) as Array<{k: string; size: string; q: string}>;
        if (qualities.length > 0) {
          // Return info - actual conversion requires another call
          // For now return null as y2mate requires 2-step process
        }
      }
    }
  } catch {
    // Continue to next method
  }
  
  return null;
}

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

// ============================================================================
// TIKTOK
// ============================================================================

async function fetchTikTokInfo(url: string): Promise<YtDlpVideoInfo | null> {
  // Use tikwm.com API (free, no auth required)
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) throw new Error('TikWM API failed');
    
    const data = await response.json();
    
    if (data.code !== 0 || !data.data) {
      throw new Error(data.msg || 'TikTok fetch failed');
    }

    const video = data.data;
    const downloadUrl = video.play || video.hdplay || video.wmplay;
    
    if (!downloadUrl) {
      throw new Error('No download URL found');
    }

    return {
      id: video.id || 'tiktok',
      title: video.title || 'TikTok Video',
      description: video.title || '',
      thumbnail: video.cover || video.origin_cover || '',
      duration: video.duration || 0,
      uploader: video.author?.nickname || 'TikTok',
      uploader_id: video.author?.unique_id || '',
      view_count: video.play_count || 0,
      like_count: video.digg_count || 0,
      upload_date: '',
      extractor: 'tiktok',
      webpage_url: url,
      ext: 'mp4',
      url: downloadUrl,
      formats: [
        {
          format_id: 'hd',
          ext: 'mp4',
          url: video.hdplay || downloadUrl,
          width: 1080,
          height: 1920,
          format_note: 'HD (No Watermark)',
        },
        {
          format_id: 'sd',
          ext: 'mp4',
          url: video.play || downloadUrl,
          width: 576,
          height: 1024,
          format_note: 'SD (No Watermark)',
        },
      ],
      _type: 'video',
    };
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createVideoInfo(
  originalUrl: string,
  downloadUrl: string,
  title: string,
  platform: string,
  isPhoto: boolean
): YtDlpVideoInfo {
  return {
    id: Buffer.from(originalUrl).toString('base64').substring(0, 11),
    title: title,
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

export function selectFormat(formats: YtDlpFormat[], quality: 'sd' | 'hd'): YtDlpFormat | null {
  if (!formats || formats.length === 0) return null;
  
  if (formats.length > 1) {
    const targetHeight = quality === 'hd' ? 1080 : 480;
    const sorted = [...formats].sort((a, b) => {
      const aHeight = a.height || 0;
      const bHeight = b.height || 0;
      return Math.abs(aHeight - targetHeight) - Math.abs(bHeight - targetHeight);
    });
    return sorted[0];
  }
  
  return formats[0];
}

export function selectPhotoFormat(formats: YtDlpFormat[]): YtDlpFormat | null {
  if (!formats || formats.length === 0) return null;
  return formats[0];
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

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

export function toVideoFormat(format: YtDlpFormat): VideoFormat {
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

export function getDownloadUrl(format: YtDlpFormat): string {
  return format.url || '';
}
