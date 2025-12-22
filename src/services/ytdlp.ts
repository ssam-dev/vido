/**
 * Video Download Service (Vercel-compatible)
 * 
 * Uses reverse-engineered internal APIs and direct stream extraction.
 * Techniques used:
 * 1. Internal API endpoints (youtubei/v1/player, Instagram GraphQL, etc.)
 * 2. HLS/DASH manifest parsing (.m3u8, .mpd)
 * 3. Direct stream URL extraction
 */

import type {
  VideoInfo,
  VideoFormat,
  YtDlpVideoInfo,
  YtDlpFormat,
} from '@/types/video';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// YouTube Internal API Client (Android client has less restrictions)
const YOUTUBE_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '19.09.37',
  androidSdkVersion: 30,
  userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
};

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
// MAIN FETCH FUNCTION - Routes to platform-specific handlers
// ============================================================================

export async function fetchVideoInfo(url: string): Promise<YtDlpVideoInfo> {
  const validation = validateVideoUrl(url);
  const platform = validation.platform;
  
  const errors: string[] = [];

  // Platform-specific handlers using internal APIs
  if (platform === 'YouTube') {
    try {
      const result = await fetchYouTubeInternal(url);
      if (result) return result;
    } catch (e) {
      errors.push(`YouTube: ${e instanceof Error ? e.message : 'Failed'}`);
    }
  }

  if (platform === 'TikTok') {
    try {
      const result = await fetchTikTokInternal(url);
      if (result) return result;
    } catch (e) {
      errors.push(`TikTok: ${e instanceof Error ? e.message : 'Failed'}`);
    }
  }

  if (platform === 'Instagram') {
    try {
      const result = await fetchInstagramInternal(url);
      if (result) return result;
    } catch (e) {
      errors.push(`Instagram: ${e instanceof Error ? e.message : 'Failed'}`);
    }
  }

  if (platform === 'Twitter') {
    try {
      const result = await fetchTwitterInternal(url);
      if (result) return result;
    } catch (e) {
      errors.push(`Twitter: ${e instanceof Error ? e.message : 'Failed'}`);
    }
  }

  if (platform === 'Facebook') {
    try {
      const result = await fetchFacebookInternal(url);
      if (result) return result;
    } catch (e) {
      errors.push(`Facebook: ${e instanceof Error ? e.message : 'Failed'}`);
    }
  }

  // Fallback: Try TikWM API (works for TikTok)
  if (platform === 'TikTok') {
    try {
      const result = await fetchFromTikWM(url);
      if (result) return result;
    } catch (e) {
      errors.push(`TikWM: ${e instanceof Error ? e.message : 'Failed'}`);
    }
  }

  throw new Error(
    `Unable to download from ${platform}. ` +
    (errors.length > 0 ? `Errors: ${errors.join('; ')}. ` : '') +
    `The video may be private, age-restricted, or the platform is blocking requests.`
  );
}

// ============================================================================
// YOUTUBE - Using Internal /youtubei/v1/player API (Android Client)
// ============================================================================

async function fetchYouTubeInternal(url: string): Promise<YtDlpVideoInfo | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  // Use the internal YouTube API with Android client (less restrictions)
  const apiUrl = 'https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
  
  const payload = {
    videoId: videoId,
    context: {
      client: {
        clientName: YOUTUBE_CLIENT.clientName,
        clientVersion: YOUTUBE_CLIENT.clientVersion,
        androidSdkVersion: YOUTUBE_CLIENT.androidSdkVersion,
        userAgent: YOUTUBE_CLIENT.userAgent,
        hl: 'en',
        gl: 'US',
      },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': YOUTUBE_CLIENT.userAgent,
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': YOUTUBE_CLIENT.clientVersion,
      'Origin': 'https://www.youtube.com',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`YouTube API returned ${response.status}`);
  }

  const data = await response.json();

  // Check for playability errors
  if (data.playabilityStatus?.status !== 'OK') {
    const reason = data.playabilityStatus?.reason || 'Video unavailable';
    throw new Error(reason);
  }

  const videoDetails = data.videoDetails || {};
  const streamingData = data.streamingData || {};

  // Extract formats from adaptiveFormats and formats
  const formats: YtDlpFormat[] = [];
  
  // Combined formats (video + audio)
  if (streamingData.formats) {
    for (const fmt of streamingData.formats) {
      if (fmt.url) {
        formats.push({
          format_id: fmt.itag?.toString() || 'combined',
          ext: 'mp4',
          url: fmt.url,
          width: fmt.width || 0,
          height: fmt.height || 0,
          format_note: fmt.qualityLabel || 'SD',
          vcodec: fmt.mimeType?.includes('video') ? 'avc1' : 'none',
          acodec: fmt.mimeType?.includes('audio') ? 'mp4a' : 'none',
          filesize: parseInt(fmt.contentLength) || undefined,
        });
      }
    }
  }

  // Adaptive formats (higher quality, separate video/audio)
  if (streamingData.adaptiveFormats) {
    for (const fmt of streamingData.adaptiveFormats) {
      if (fmt.url && fmt.mimeType?.includes('video')) {
        formats.push({
          format_id: fmt.itag?.toString() || 'adaptive',
          ext: fmt.mimeType?.includes('webm') ? 'webm' : 'mp4',
          url: fmt.url,
          width: fmt.width || 0,
          height: fmt.height || 0,
          format_note: fmt.qualityLabel || `${fmt.height}p`,
          vcodec: 'avc1',
          acodec: 'none', // Adaptive video-only
          filesize: parseInt(fmt.contentLength) || undefined,
        });
      }
    }
  }

  // If no direct URLs, try HLS manifest
  if (formats.length === 0 && streamingData.hlsManifestUrl) {
    formats.push({
      format_id: 'hls',
      ext: 'mp4',
      url: streamingData.hlsManifestUrl,
      width: 1920,
      height: 1080,
      format_note: 'HLS Stream',
    });
  }

  if (formats.length === 0) {
    throw new Error('No playable formats found');
  }

  // Sort by height (highest first)
  formats.sort((a, b) => (b.height || 0) - (a.height || 0));

  return {
    id: videoId,
    title: videoDetails.title || 'YouTube Video',
    description: videoDetails.shortDescription || '',
    thumbnail: videoDetails.thumbnail?.thumbnails?.pop()?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: parseInt(videoDetails.lengthSeconds) || 0,
    uploader: videoDetails.author || 'YouTube',
    uploader_id: videoDetails.channelId || '',
    view_count: parseInt(videoDetails.viewCount) || 0,
    like_count: 0,
    upload_date: '',
    extractor: 'youtube',
    webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
    ext: 'mp4',
    url: formats[0].url,
    formats,
    _type: 'video',
  };
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ============================================================================
// TIKTOK - Using Internal API + Web Scraping
// ============================================================================

async function fetchTikTokInternal(url: string): Promise<YtDlpVideoInfo | null> {
  // First, resolve short URLs
  let finalUrl = url;
  if (url.includes('vm.tiktok.com') || url.includes('/t/')) {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });
    finalUrl = response.url;
  }

  // Extract video ID
  const videoIdMatch = finalUrl.match(/video\/(\d+)/);
  if (!videoIdMatch) {
    throw new Error('Could not extract TikTok video ID');
  }
  const videoId = videoIdMatch[1];

  // Use TikTok's internal API
  const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok API returned ${response.status}`);
  }

  const data = await response.json();
  const aweme = data.aweme_list?.[0];

  if (!aweme) {
    throw new Error('Video not found in TikTok response');
  }

  const video = aweme.video || {};
  const author = aweme.author || {};

  // Get download URL (no watermark)
  const downloadUrl = video.play_addr?.url_list?.[0] || 
                      video.download_addr?.url_list?.[0] ||
                      video.play_addr_h264?.url_list?.[0];

  if (!downloadUrl) {
    throw new Error('No download URL found');
  }

  return {
    id: videoId,
    title: aweme.desc || 'TikTok Video',
    description: aweme.desc || '',
    thumbnail: video.cover?.url_list?.[0] || video.origin_cover?.url_list?.[0] || '',
    duration: video.duration || 0,
    uploader: author.nickname || 'TikTok User',
    uploader_id: author.unique_id || '',
    view_count: aweme.statistics?.play_count || 0,
    like_count: aweme.statistics?.digg_count || 0,
    upload_date: '',
    extractor: 'tiktok',
    webpage_url: finalUrl,
    ext: 'mp4',
    url: downloadUrl,
    formats: [
      {
        format_id: 'hd',
        ext: 'mp4',
        url: downloadUrl,
        width: video.width || 1080,
        height: video.height || 1920,
        format_note: 'HD (No Watermark)',
      },
    ],
    _type: 'video',
  };
}

// TikWM API fallback
async function fetchFromTikWM(url: string): Promise<YtDlpVideoInfo | null> {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });
  
  if (!response.ok) throw new Error('TikWM API failed');
  
  const data = await response.json();
  
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || 'TikTok fetch failed');
  }

  const video = data.data;
  const downloadUrl = video.play || video.hdplay || video.wmplay;
  
  if (!downloadUrl) throw new Error('No download URL found');

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
}

// ============================================================================
// INSTAGRAM - Using GraphQL API
// ============================================================================

async function fetchInstagramInternal(url: string): Promise<YtDlpVideoInfo | null> {
  // Extract shortcode from URL
  const shortcodeMatch = url.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) {
    throw new Error('Invalid Instagram URL');
  }
  const shortcode = shortcodeMatch[2];

  // Use Instagram's GraphQL API
  const graphqlUrl = `https://www.instagram.com/api/v1/media/${shortcode}/info/`;
  
  const response = await fetch(graphqlUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'X-IG-App-ID': '936619743392459',
      'X-ASBD-ID': '129477',
      'X-IG-WWW-Claim': '0',
      'Accept': '*/*',
    },
  });

  if (!response.ok) {
    // Try alternative: embed endpoint
    return await fetchInstagramEmbed(shortcode, url);
  }

  const data = await response.json();
  const item = data.items?.[0];

  if (!item) {
    throw new Error('Instagram post not found');
  }

  // Get video URL
  let downloadUrl = '';
  let isPhoto = false;

  if (item.video_versions?.length > 0) {
    downloadUrl = item.video_versions[0].url;
  } else if (item.image_versions2?.candidates?.length > 0) {
    downloadUrl = item.image_versions2.candidates[0].url;
    isPhoto = true;
  }

  if (!downloadUrl) {
    throw new Error('No media URL found');
  }

  return {
    id: shortcode,
    title: item.caption?.text?.substring(0, 100) || 'Instagram Post',
    description: item.caption?.text || '',
    thumbnail: item.image_versions2?.candidates?.[0]?.url || '',
    duration: item.video_duration || 0,
    uploader: item.user?.username || 'Instagram',
    uploader_id: item.user?.pk || '',
    view_count: item.view_count || item.play_count || 0,
    like_count: item.like_count || 0,
    upload_date: '',
    extractor: 'instagram',
    webpage_url: url,
    ext: isPhoto ? 'jpg' : 'mp4',
    url: downloadUrl,
    formats: [
      {
        format_id: 'best',
        ext: isPhoto ? 'jpg' : 'mp4',
        url: downloadUrl,
        width: item.original_width || 1080,
        height: item.original_height || 1920,
        format_note: isPhoto ? 'Original' : 'HD',
      },
    ],
    _type: isPhoto ? 'photo' : 'video',
  };
}

async function fetchInstagramEmbed(shortcode: string, originalUrl: string): Promise<YtDlpVideoInfo | null> {
  // Try the embed page which sometimes works without auth
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
  
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error('Instagram embed failed');
  }

  const html = await response.text();

  // Extract video URL from embed HTML
  const videoMatch = html.match(/"video_url":"([^"]+)"/);
  if (videoMatch) {
    const videoUrl = videoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
    return createVideoInfo(originalUrl, videoUrl, 'Instagram Video', 'Instagram', false);
  }

  // Try to find image
  const imageMatch = html.match(/"display_url":"([^"]+)"/);
  if (imageMatch) {
    const imageUrl = imageMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
    return createVideoInfo(originalUrl, imageUrl, 'Instagram Photo', 'Instagram', true);
  }

  throw new Error('Could not extract media from Instagram');
}

// ============================================================================
// TWITTER/X - Using API
// ============================================================================

async function fetchTwitterInternal(url: string): Promise<YtDlpVideoInfo | null> {
  // Extract tweet ID
  const tweetIdMatch = url.match(/status\/(\d+)/);
  if (!tweetIdMatch) {
    throw new Error('Invalid Twitter URL');
  }
  const tweetId = tweetIdMatch[1];

  // Use Twitter's syndication API (no auth required)
  const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Twitter API returned ${response.status}`);
  }

  const data = await response.json();

  // Check for video
  const video = data.video;
  if (video?.variants?.length > 0) {
    // Get highest quality mp4
    const mp4Variants = video.variants
      .filter((v: { type: string }) => v.type === 'video/mp4')
      .sort((a: { src: string }, b: { src: string }) => {
        const bitrateA = parseInt(a.src.match(/\/(\d+)x/)?.[1] || '0');
        const bitrateB = parseInt(b.src.match(/\/(\d+)x/)?.[1] || '0');
        return bitrateB - bitrateA;
      });

    if (mp4Variants.length > 0) {
      const formats: YtDlpFormat[] = mp4Variants.map((v: { src: string }, i: number) => {
        const resolution = v.src.match(/\/(\d+)x(\d+)\//);
        return {
          format_id: `mp4-${i}`,
          ext: 'mp4',
          url: v.src,
          width: resolution ? parseInt(resolution[1]) : 1280,
          height: resolution ? parseInt(resolution[2]) : 720,
          format_note: resolution ? `${resolution[2]}p` : 'HD',
        };
      });

      return {
        id: tweetId,
        title: data.text?.substring(0, 100) || 'Twitter Video',
        description: data.text || '',
        thumbnail: video.poster || data.user?.profile_image_url_https || '',
        duration: video.durationMs ? video.durationMs / 1000 : 0,
        uploader: data.user?.name || 'Twitter User',
        uploader_id: data.user?.screen_name || '',
        view_count: data.views || 0,
        like_count: data.favorite_count || 0,
        upload_date: '',
        extractor: 'twitter',
        webpage_url: url,
        ext: 'mp4',
        url: formats[0].url,
        formats,
        _type: 'video',
      };
    }
  }

  // Check for photos
  const photos = data.photos;
  if (photos?.length > 0) {
    const photoUrl = photos[0].url;
    return createVideoInfo(url, photoUrl, 'Twitter Photo', 'Twitter', true);
  }

  throw new Error('No media found in tweet');
}

// ============================================================================
// FACEBOOK - Using Multiple Methods
// ============================================================================

async function fetchFacebookInternal(url: string): Promise<YtDlpVideoInfo | null> {
  // Normalize URL
  let videoUrl = url;
  
  // Handle fb.watch short URLs
  if (url.includes('fb.watch')) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': MOBILE_USER_AGENT },
      });
      videoUrl = response.url;
    } catch {
      // Continue with original URL
    }
  }

  // Try Method 1: Third-party API (most reliable for Facebook)
  try {
    const result = await fetchFacebookFromAPI(videoUrl);
    if (result) return result;
  } catch {
    // Continue to next method
  }

  // Try Method 2: Facebook's oEmbed API (works for public videos)
  try {
    const result = await fetchFacebookOEmbed(videoUrl);
    if (result) return result;
  } catch {
    // Continue to next method
  }

  // Try Method 3: Mobile site scraping
  try {
    const result = await fetchFacebookMobile(videoUrl);
    if (result) return result;
  } catch {
    // Continue to next method
  }

  // Try Method 4: Direct page scraping with different patterns
  try {
    const result = await fetchFacebookDirect(videoUrl);
    if (result) return result;
  } catch {
    // Continue
  }

  throw new Error('Facebook fetch failed');
}

// Third-party API for Facebook (similar to TikWM for TikTok)
async function fetchFacebookFromAPI(url: string): Promise<YtDlpVideoInfo | null> {
  // Use getfvid.com API (free, no auth)
  const apiUrl = `https://www.getfvid.com/downloader`;
  
  const formData = new URLSearchParams();
  formData.append('url', url);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
      'Origin': 'https://www.getfvid.com',
      'Referer': 'https://www.getfvid.com/',
    },
    body: formData.toString(),
  });

  if (!response.ok) return null;

  const html = await response.text();

  // Extract HD download link
  const hdMatch = html.match(/href="([^"]+)"[^>]*>.*?Download.*?HD/i) ||
                  html.match(/class="btn[^"]*"[^>]*href="([^"]+)"[^>]*>.*?HD/i);
  
  // Extract SD download link
  const sdMatch = html.match(/href="([^"]+)"[^>]*>.*?Download.*?SD/i) ||
                  html.match(/class="btn[^"]*"[^>]*href="([^"]+)"[^>]*>.*?Normal/i);

  // Extract any video download link
  const anyMatch = html.match(/href="(https:\/\/[^"]*fbcdn[^"]*\.mp4[^"]*)"/i) ||
                   html.match(/href="(https:\/\/video[^"]*\.mp4[^"]*)"/i);

  const downloadUrl = hdMatch?.[1] || sdMatch?.[1] || anyMatch?.[1];

  if (downloadUrl && downloadUrl.startsWith('http')) {
    // Extract title
    const titleMatch = html.match(/<h5[^>]*>([^<]+)<\/h5>/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(/Download.*?-/i, '').trim() : 'Facebook Video';
    
    return createVideoInfo(url, downloadUrl, title, 'Facebook', false);
  }

  // Try alternative: fdown.net
  return await fetchFacebookFromFDown(url);
}

async function fetchFacebookFromFDown(url: string): Promise<YtDlpVideoInfo | null> {
  const apiUrl = 'https://www.fdown.net/download.php';
  
  const formData = new URLSearchParams();
  formData.append('URLz', url);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'Origin': 'https://www.fdown.net',
      'Referer': 'https://www.fdown.net/',
    },
    body: formData.toString(),
  });

  if (!response.ok) return null;

  const html = await response.text();

  // Look for download links
  const hdMatch = html.match(/id="hdlink"[^>]*href="([^"]+)"/i) ||
                  html.match(/quality.*?HD.*?href="([^"]+)"/i);
  const sdMatch = html.match(/id="sdlink"[^>]*href="([^"]+)"/i) ||
                  html.match(/quality.*?SD.*?href="([^"]+)"/i);
  
  const downloadUrl = hdMatch?.[1] || sdMatch?.[1];

  if (downloadUrl && downloadUrl.startsWith('http')) {
    return createVideoInfo(url, downloadUrl, 'Facebook Video', 'Facebook', false);
  }

  return null;
}

async function fetchFacebookOEmbed(url: string): Promise<YtDlpVideoInfo | null> {
  // Facebook oEmbed endpoint (works for public videos)
  const oembedUrl = `https://www.facebook.com/plugins/video/oembed.json/?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(oembedUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  
  // oEmbed doesn't give direct video URL, but we can extract from HTML
  if (data.html) {
    const srcMatch = data.html.match(/src="([^"]+)"/);
    if (srcMatch) {
      // This is an iframe URL, need to fetch that page
      const iframeUrl = srcMatch[1].replace(/&amp;/g, '&');
      return await fetchFacebookFromEmbed(iframeUrl, url, data.title || 'Facebook Video');
    }
  }

  return null;
}

async function fetchFacebookFromEmbed(embedUrl: string, originalUrl: string, title: string): Promise<YtDlpVideoInfo | null> {
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  
  // Look for video URLs in the embed page
  const patterns = [
    /"hd_src":"([^"]+)"/,
    /"sd_src":"([^"]+)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /data-video-url="([^"]+)"/,
    /videoURL\\?":\\?"([^"\\]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      let videoUrl = match[1]
        .replace(/\\/g, '')
        .replace(/\\u0025/g, '%')
        .replace(/\\u0026/g, '&');
      videoUrl = decodeURIComponent(videoUrl);
      
      if (videoUrl.startsWith('http')) {
        return createVideoInfo(originalUrl, videoUrl, title, 'Facebook', false);
      }
    }
  }

  return null;
}

async function fetchFacebookMobile(url: string): Promise<YtDlpVideoInfo | null> {
  // Use mobile site (mbasic for even simpler HTML)
  const mobileUrl = url
    .replace('www.facebook.com', 'mbasic.facebook.com')
    .replace('m.facebook.com', 'mbasic.facebook.com')
    .replace('web.facebook.com', 'mbasic.facebook.com');
  
  const response = await fetch(mobileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 5 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  
  // mbasic Facebook has simpler HTML structure
  // Look for video redirect URL
  const videoRedirectMatch = html.match(/href="(\/video_redirect\/\?src=[^"]+)"/);
  if (videoRedirectMatch) {
    let videoPath = videoRedirectMatch[1].replace(/&amp;/g, '&');
    // Extract the actual video URL from the redirect
    const srcMatch = videoPath.match(/src=([^&]+)/);
    if (srcMatch) {
      const videoUrl = decodeURIComponent(srcMatch[1]);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' | Facebook', '') : 'Facebook Video';
      return createVideoInfo(url, videoUrl, title, 'Facebook', false);
    }
  }

  // Try to find direct video URL
  const patterns = [
    /href="([^"]*\.mp4[^"]*)"/,
    /src="([^"]*\.mp4[^"]*)"/,
    /"video_url":"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      let videoUrl = match[1].replace(/&amp;/g, '&');
      if (!videoUrl.startsWith('http')) {
        videoUrl = 'https://www.facebook.com' + videoUrl;
      }
      videoUrl = decodeURIComponent(videoUrl);
      
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' | Facebook', '') : 'Facebook Video';
      return createVideoInfo(url, videoUrl, title, 'Facebook', false);
    }
  }

  return null;
}

async function fetchFacebookDirect(url: string): Promise<YtDlpVideoInfo | null> {
  // Try regular Facebook page with desktop user agent
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
    },
  });

  if (!response.ok) return null;

  const html = await response.text();

  // Facebook embeds video data in JSON within the HTML
  // Try various patterns
  const patterns = [
    /"playable_url_quality_hd":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /"hd_src":"([^"]+)"/,
    /"sd_src":"([^"]+)"/,
    /"browser_native_hd_url":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /\["hd_src"\]="([^"]+)"/,
    /\["sd_src"\]="([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      let videoUrl = match[1]
        .replace(/\\/g, '')
        .replace(/\\u0025/g, '%')
        .replace(/\\u0026/g, '&')
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>');
      
      videoUrl = decodeURIComponent(videoUrl);
      
      if (videoUrl.startsWith('http') && (videoUrl.includes('.mp4') || videoUrl.includes('video'))) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(' | Facebook', '').replace(' - Facebook', '') : 'Facebook Video';
        return createVideoInfo(url, videoUrl, title, 'Facebook', false);
      }
    }
  }

  // Try og:video meta tag
  const ogMatch = html.match(/<meta property="og:video(?::url)?" content="([^"]+)"/);
  if (ogMatch) {
    let videoUrl = ogMatch[1].replace(/&amp;/g, '&');
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : 'Facebook Video';
    return createVideoInfo(url, videoUrl, title, 'Facebook', false);
  }

  return null;
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
    thumbnail: isPhoto ? downloadUrl : '',
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
