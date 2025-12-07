/**
 * yt-dlp Utility Module
 * 
 * This module provides functions to interact with yt-dlp for video downloading.
 * It handles URL validation, platform detection, and quality selection for
 * SD (≤480p) and HD (1080p priority) downloads.
 * 
 * REQUIREMENTS:
 * - yt-dlp must be installed locally and available in PATH
 * - Install via: pip install yt-dlp (or download binary from GitHub)
 * - gallery-dl (optional) for Instagram fallback: pip install gallery-dl
 * 
 * AUTHENTICATION:
 * - For Instagram, Twitter, and other login-required sites, cookies are
 *   automatically extracted from your default browser (Chrome, Firefox, Edge)
 * 
 * Copilot: This is the core utility for video processing. All yt-dlp
 * interactions should go through these functions.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type {
  VideoInfo,
  VideoFormat,
  YtDlpVideoInfo,
  YtDlpFormat,
} from '@/types/video';

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// ============================================================================
// YT-DLP EXECUTABLE PATH
// ============================================================================

/**
 * Copilot: Get the yt-dlp command based on the operating system.
 * On Windows, we check common installation paths if 'yt-dlp' is not in PATH.
 * This ensures the utility works even when the script location isn't in PATH.
 */
function getYtDlpCommand(): string {
  // Check if running on Windows
  if (process.platform === 'win32') {
    // Common Windows installation paths for yt-dlp via pip
    const possiblePaths = [
      'yt-dlp', // Try PATH first
      `${process.env.APPDATA}\\Python\\Python313\\Scripts\\yt-dlp.exe`,
      `${process.env.APPDATA}\\Python\\Python312\\Scripts\\yt-dlp.exe`,
      `${process.env.APPDATA}\\Python\\Python311\\Scripts\\yt-dlp.exe`,
      `${process.env.APPDATA}\\Python\\Python310\\Scripts\\yt-dlp.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\Scripts\\yt-dlp.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python311\\Scripts\\yt-dlp.exe`,
      `${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe`,
      `${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python312\\Scripts\\yt-dlp.exe`,
      `${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python311\\Scripts\\yt-dlp.exe`,
    ];
    
    // Return the first path that might work - we'll try in order
    // The actual existence check happens when we execute the command
    return possiblePaths[0];
  }
  
  // On Unix-like systems, just use 'yt-dlp' from PATH
  return 'yt-dlp';
}

/**
 * Get yt-dlp executable with fallback paths for Windows
 */
async function findYtDlpExecutable(): Promise<string> {
  if (process.platform !== 'win32') {
    return 'yt-dlp';
  }

  // Windows paths to check in order
  const paths = [
    'yt-dlp',
    `"${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe"`,
    `"${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python312\\Scripts\\yt-dlp.exe"`,
    `"${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python311\\Scripts\\yt-dlp.exe"`,
    `"${process.env.APPDATA}\\Python\\Python313\\Scripts\\yt-dlp.exe"`,
    `"${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\Scripts\\yt-dlp.exe"`,
  ];

  for (const ytdlpPath of paths) {
    try {
      await execAsync(`${ytdlpPath} --version`, { timeout: 5000 });
      return ytdlpPath;
    } catch {
      // Try next path
      continue;
    }
  }

  // Default to yt-dlp and let the error propagate with helpful message
  return 'yt-dlp';
}

// ============================================================================
// GALLERY-DL EXECUTABLE PATH (Instagram fallback)
// ============================================================================

/**
 * Find gallery-dl executable for Instagram fallback
 */
async function findGalleryDlExecutable(): Promise<string | null> {
  const paths = process.platform === 'win32' ? [
    'gallery-dl',
    `"${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python313\\Scripts\\gallery-dl.exe"`,
    `"${process.env.USERPROFILE}\\AppData\\Roaming\\Python\\Python312\\Scripts\\gallery-dl.exe"`,
    `"${process.env.APPDATA}\\Python\\Python313\\Scripts\\gallery-dl.exe"`,
    `"${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\Scripts\\gallery-dl.exe"`,
  ] : ['gallery-dl'];

  for (const gdlPath of paths) {
    try {
      await execAsync(`${gdlPath} --version`, { timeout: 5000 });
      return gdlPath;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fetch Instagram content using gallery-dl as fallback
 * gallery-dl often works when yt-dlp is blocked by Instagram
 */
async function fetchInstagramWithGalleryDl(url: string): Promise<YtDlpVideoInfo | null> {
  const galleryDl = await findGalleryDlExecutable();
  if (!galleryDl) {
    return null;
  }

  try {
    const cookiesPath = getCookiesFilePath();
    const cookiesArg = hasCookiesFile() ? `--cookies "${cookiesPath}"` : '';
    
    // gallery-dl command to get JSON metadata
    const command = `${galleryDl} --dump-json ${cookiesArg} "${url}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!stdout || stdout.trim() === '') {
      return null;
    }

    // Parse gallery-dl JSON output (may be multiple lines for carousels)
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return null;
    }

    // Parse first item
    const firstItem = JSON.parse(lines[0]);
    
    // Convert gallery-dl format to yt-dlp compatible format
    const isVideo = firstItem.extension === 'mp4' || firstItem.video_url;
    const mediaUrl = firstItem.video_url || firstItem.display_url || firstItem.url;
    
    // Create a yt-dlp compatible response
    const videoInfo: YtDlpVideoInfo = {
      title: firstItem.description?.substring(0, 100) || firstItem.username || 'Instagram Media',
      thumbnail: firstItem.display_url || firstItem.thumbnail || '',
      duration: firstItem.video_duration || 0,
      uploader: firstItem.username || firstItem.owner_username || 'Unknown',
      channel: firstItem.username || firstItem.owner_username || 'Unknown',
      extractor_key: 'Instagram',
      webpage_url: url,
      formats: [{
        format_id: isVideo ? 'video' : 'photo',
        ext: firstItem.extension || (isVideo ? 'mp4' : 'jpg'),
        url: mediaUrl,
        width: firstItem.width || 1080,
        height: firstItem.height || 1080,
        vcodec: isVideo ? 'h264' : 'none',
        acodec: isVideo ? 'aac' : 'none',
      }],
    };

    return videoInfo;
  } catch (error) {
    console.error('gallery-dl fallback failed:', error);
    return null;
  }
}

// ============================================================================
// BROWSER COOKIE DETECTION
// ============================================================================

/**
 * Get the path to a cookies.txt file in the app directory
 */
function getCookiesFilePath(): string {
  // Look for cookies.txt in the project root
  return path.join(process.cwd(), 'cookies.txt');
}

/**
 * Check if a manual cookies.txt file exists
 */
function hasCookiesFile(): boolean {
  const cookiesPath = getCookiesFilePath();
  return fs.existsSync(cookiesPath);
}

/**
 * Detects which browsers are available on the system for cookie extraction
 * yt-dlp supports: chrome, firefox, edge, opera, brave, vivaldi, safari
 * Note: Firefox is preferred as it doesn't lock its cookies database
 */
async function getAvailableBrowser(): Promise<string | null> {
  // Firefox is preferred because it doesn't lock its cookie database
  // Other browsers (Chrome, Edge) lock their databases when running
  const browsers = ['firefox', 'chrome', 'edge', 'brave', 'opera', 'vivaldi'];
  
  // On Windows, check common browser paths
  if (process.platform === 'win32') {
    const browserPaths: Record<string, string[]> = {
      firefox: [
        `${process.env.APPDATA}\\Mozilla\\Firefox\\Profiles`,
      ],
      chrome: [
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`,
      ],
      edge: [
        `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\User Data`,
      ],
      brave: [
        `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\User Data`,
      ],
    };

    for (const browser of browsers) {
      const paths = browserPaths[browser];
      if (paths) {
        for (const browserPath of paths) {
          if (browserPath && fs.existsSync(browserPath)) {
            return browser;
          }
        }
      }
    }
  }
  
  // Default to firefox as it's most reliable for cookie extraction
  return 'firefox';
}

/**
 * Gets the cookies argument for yt-dlp based on the URL
 * Priority: 1) Manual cookies.txt file, 2) Browser cookies (Firefox preferred)
 * For Instagram, Twitter, etc. we'll try to use cookies for auth
 */
async function getCookiesArg(url: string): Promise<string> {
  // Sites that typically require authentication
  const authRequiredSites = [
    'instagram.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'fb.watch',
  ];
  
  const needsAuth = authRequiredSites.some(site => url.includes(site));
  
  if (needsAuth) {
    // First, check if a manual cookies.txt file exists
    if (hasCookiesFile()) {
      const cookiesPath = getCookiesFilePath();
      return `--cookies "${cookiesPath}"`;
    }
    
    // Otherwise, try browser cookies (Firefox preferred as it doesn't lock)
    const browser = await getAvailableBrowser();
    if (browser) {
      return `--cookies-from-browser ${browser}`;
    }
  }
  
  return '';
}

// ============================================================================
// CONSTANTS - Quality Mapping Configuration
// ============================================================================

/**
 * SD_MAX_HEIGHT - Maximum height for Standard Definition
 * Videos at or below this height qualify as SD
 * 
 * Copilot: Use this constant when filtering formats for SD quality
 */
const SD_MAX_HEIGHT = 480;

/**
 * HD_TARGET_HEIGHT - Target height for High Definition
 * Prioritize 1080p, fallback to closest available
 * 
 * Copilot: Use this constant when selecting HD format
 */
const HD_TARGET_HEIGHT = 1080;

/**
 * SUPPORTED_PLATFORMS - Regex patterns for known video platforms
 * 
 * Copilot: These patterns help identify the platform for display purposes.
 * yt-dlp supports 1000+ websites, so we allow any valid URL.
 * Known platforms get specific icons/labels in the UI.
 */
const KNOWN_PLATFORMS = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(reel|reels|p)\//i,
  facebook: /^(https?:\/\/)?(www\.|m\.|web\.)?facebook\.com\/.*(videos?|watch|reel)/i,
  twitter: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.*\/status\//i,
  tiktok: /^(https?:\/\/)?(www\.|vm\.)?tiktok\.com\//i,
  vimeo: /^(https?:\/\/)?(www\.)?vimeo\.com\//i,
} as const;

// ============================================================================
// URL VALIDATION & PLATFORM DETECTION
// ============================================================================

/**
 * Detects the platform from a URL
 * 
 * @param url - The URL to check
 * @returns The detected platform name
 * 
 * Copilot: Returns 'other' for valid URLs from unknown platforms.
 * yt-dlp will attempt to process any URL.
 */
export function detectPlatform(url: string): 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'vimeo' | 'other' | 'unknown' {
  if (!url || typeof url !== 'string') {
    return 'unknown';
  }

  const trimmedUrl = url.trim();

  // Check against known platform patterns
  for (const [platform, pattern] of Object.entries(KNOWN_PLATFORMS)) {
    if (pattern.test(trimmedUrl)) {
      return platform as 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'vimeo';
    }
  }

  // If it's a valid URL but unknown platform, return 'other'
  if (trimmedUrl.match(/^https?:\/\//i)) {
    return 'other';
  }

  return 'unknown';
}

/**
 * Validates if a URL can be processed
 * 
 * @param url - The URL to validate
 * @returns Object with validation result and detected platform
 * 
 * Copilot: Now accepts ANY valid http/https URL.
 * yt-dlp supports 1000+ websites including:
 * - YouTube, Instagram, Facebook, Twitter/X, TikTok, Vimeo
 * - Reddit, Twitch, Dailymotion, Bilibili
 * - News sites, adult sites, and many more
 */
export function validateVideoUrl(url: string): {
  isValid: boolean;
  platform: 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'vimeo' | 'other' | 'unknown';
  error?: string;
} {
  // Copilot: Basic URL format validation
  if (!url || typeof url !== 'string') {
    return { isValid: false, platform: 'unknown', error: 'URL is required' };
  }

  const trimmedUrl = url.trim();

  // Check if URL has valid protocol
  if (!trimmedUrl.match(/^https?:\/\//i)) {
    return { isValid: false, platform: 'unknown', error: 'URL must start with http:// or https://' };
  }

  // Copilot: Detect the platform for display purposes
  const platform = detectPlatform(trimmedUrl);

  // Accept any valid URL - yt-dlp will try to process it
  return {
    isValid: true,
    platform,
  };
}

// ============================================================================
// YT-DLP EXECUTION
// ============================================================================

/**
 * Fetches video information using yt-dlp --dump-json
 * Falls back to gallery-dl for Instagram if yt-dlp fails
 * 
 * @param url - The video URL to fetch info for
 * @returns Parsed video information from yt-dlp
 * @throws Error if both yt-dlp and gallery-dl fail
 * 
 * Copilot: This function executes yt-dlp as a child process.
 * The --dump-json flag returns metadata without downloading.
 * For Instagram, we try gallery-dl as fallback since Instagram actively
 * blocks yt-dlp requests (known issue as of late 2024).
 */
export async function fetchVideoInfo(url: string): Promise<YtDlpVideoInfo> {
  // Copilot: Check if this is an Instagram URL for fallback handling
  const isInstagram = url.includes('instagram.com') || url.includes('instagr.am');
  
  let ytdlpError: Error | null = null;
  
  // Try yt-dlp first
  try {
    // Copilot: Find the yt-dlp executable (handles Windows PATH issues)
    const ytdlp = await findYtDlpExecutable();
    console.log(`[fetchVideoInfo] Using yt-dlp: ${ytdlp}`);
    
    // Copilot: Get browser cookies argument for auth-required sites
    const cookiesArg = await getCookiesArg(url);
    
    // Copilot: yt-dlp command with flags:
    // --dump-json: Output video info as JSON without downloading
    // --no-warnings: Suppress warning messages
    // --no-playlist: Only process single video, not playlists
    // --socket-timeout: Increase socket timeout for slow sites
    // --retries: Retry on connection failures
    // --cookies-from-browser: Extract cookies from browser for auth (if needed)
    const command = `${ytdlp} --dump-json --no-warnings --no-playlist --socket-timeout 60 --retries 3 ${cookiesArg} "${url}"`;
    console.log(`[fetchVideoInfo] Running command: ${command.substring(0, 100)}...`);
    
    const { stdout, stderr } = await execAsync(command, {
      // Copilot: Set timeout to prevent hanging on slow responses (2 minutes for slow sites)
      timeout: 120000, // 120 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large JSON responses
    });
    console.log(`[fetchVideoInfo] yt-dlp completed, stdout length: ${stdout?.length || 0}, stderr: ${stderr?.substring(0, 100) || 'none'}`);

    // Copilot: Check if stdout is empty (no JSON output)
    if (!stdout || stdout.trim() === '') {
      if (stderr && stderr.includes('empty media response')) {
        throw new Error('INSTAGRAM_BLOCKED');
      }
      throw new Error(`yt-dlp returned empty output. ${stderr || 'Unknown error'}`);
    }

    if (stderr && !stdout) {
      throw new Error(`yt-dlp error: ${stderr}`);
    }

    // Copilot: Parse JSON output from yt-dlp
    let videoInfo: YtDlpVideoInfo;
    try {
      videoInfo = JSON.parse(stdout);
    } catch (parseError) {
      // JSON parsing failed - check if there's an error in the output
      if (stdout.includes('empty media response')) {
        throw new Error('INSTAGRAM_BLOCKED');
      }
      throw new Error(`Failed to parse yt-dlp output: ${stdout.substring(0, 200)}`);
    }
    return videoInfo;
  } catch (error) {
    ytdlpError = error instanceof Error ? error : new Error(String(error));
    console.error(`[fetchVideoInfo] yt-dlp error: ${ytdlpError.message}`);
    
    // Copilot: For Instagram, try gallery-dl as fallback before giving up
    // Instagram actively blocks yt-dlp, but gallery-dl often works
    if (isInstagram) {
      console.log('[fetchVideoInfo] yt-dlp failed for Instagram, trying gallery-dl fallback...');
      try {
        const galleryDlResult = await fetchInstagramWithGalleryDl(url);
        if (galleryDlResult) {
          console.log('[fetchVideoInfo] gallery-dl fallback succeeded!');
          return galleryDlResult;
        }
        throw new Error('gallery-dl returned no results');
      } catch (galleryDlError) {
        console.log('[fetchVideoInfo] gallery-dl fallback also failed:', galleryDlError);
        // Both failed - throw a comprehensive error message
        throw new Error(
          'Instagram is blocking download requests. This is a known issue with Instagram\'s anti-bot measures (not a problem with your setup). ' +
          'Both yt-dlp and gallery-dl failed to fetch the content. Options: ' +
          '1) Try again later - Instagram\'s blocking is intermittent, ' +
          '2) Try a different post, ' +
          '3) Make sure your cookies.txt is fresh (re-export from browser), ' +
          '4) Check if you can view the post while logged in.'
        );
      }
    }
    
    // Non-Instagram error handling
    if (ytdlpError.message.includes('ENOENT') || ytdlpError.message.includes('not recognized')) {
      throw new Error('yt-dlp is not installed or not in PATH. Please install it with: pip install yt-dlp');
    }
    if (ytdlpError.message.includes('Video unavailable')) {
      throw new Error('Video is unavailable or private');
    }
    // For non-Instagram timeout errors
    if (ytdlpError.message.includes('timed out') || ytdlpError.message.includes('timeout')) {
      throw new Error('Connection timed out. The site may be slow or blocking requests. Try: 1) Check your internet connection, 2) Try again in a few minutes, 3) Use a VPN.');
    }
    if (ytdlpError.message.includes('Unable to download webpage')) {
      throw new Error('Could not connect to the website. Check your internet connection or try using a VPN.');
    }
    // Cookie database locked (browser is running)
    if (ytdlpError.message.includes('Could not copy') && ytdlpError.message.includes('cookie database')) {
      throw new Error('Cannot access browser cookies while browser is running. Please either: 1) Close Firefox completely and try again, or 2) Export your cookies to cookies.txt file (see cookies.txt in app folder for instructions).');
    }
    // Cookie extraction failed
    if (ytdlpError.message.includes('could not find') && ytdlpError.message.includes('cookies')) {
      throw new Error('Could not extract browser cookies. Please export your cookies manually: 1) Install "Get cookies.txt LOCALLY" browser extension, 2) Log into the platform, 3) Export cookies to cookies.txt in the app folder.');
    }
    // Twitter/X login required
    if (ytdlpError.message.includes('Twitter') && ytdlpError.message.includes('login')) {
      throw new Error('Twitter/X requires login. Please close Firefox and try again, or export your cookies to cookies.txt file.');
    }
    // Age-restricted content
    if (ytdlpError.message.includes('age') || ytdlpError.message.includes('Sign in to confirm your age')) {
      throw new Error('This content is age-restricted. Please log into the platform in your browser and export cookies, or close Firefox and try again.');
    }
    // Private content
    if (ytdlpError.message.includes('private') || ytdlpError.message.includes('Private video')) {
      throw new Error('This content is private and cannot be accessed.');
    }
    // Geographic restriction
    if (ytdlpError.message.includes('not available in your country') || ytdlpError.message.includes('geo')) {
      throw new Error('This content is not available in your region. Try using a VPN.');
    }
    throw new Error(`Failed to fetch media info: ${ytdlpError.message}`);
  }
}

// ============================================================================
// QUALITY SELECTION LOGIC
// ============================================================================

/**
 * Selects the best format based on quality preference (SD or HD)
 * 
 * @param formats - Array of available formats from yt-dlp
 * @param quality - 'sd' for ≤480p, 'hd' for 1080p priority
 * @returns The selected format or null if no suitable format found
 * 
 * Copilot: This is the core quality mapping logic.
 * SD: Select best quality at or below 480p
 * HD: Prioritize 1080p, fallback to closest higher resolution
 */
export function selectFormat(
  formats: YtDlpFormat[],
  quality: 'sd' | 'hd'
): YtDlpFormat | null {
  // Copilot: Filter formats that have video (not audio-only)
  // and have a valid resolution/height
  const videoFormats = formats.filter((f) => {
    const hasVideo = f.vcodec && f.vcodec !== 'none';
    const hasHeight = f.height && f.height > 0;
    // Prefer mp4 for better compatibility
    const isCompatible = ['mp4', 'webm'].includes(f.ext || '');
    return hasVideo && hasHeight && isCompatible;
  });

  if (videoFormats.length === 0) {
    // Copilot: Fallback - try to find any format with height info
    const anyWithHeight = formats.filter((f) => f.height && f.height > 0);
    if (anyWithHeight.length === 0) return null;
    return selectFromFormats(anyWithHeight, quality);
  }

  return selectFromFormats(videoFormats, quality);
}

/**
 * Internal helper to select format from filtered list
 * 
 * Copilot: Implements the actual SD/HD selection algorithm
 */
function selectFromFormats(
  formats: YtDlpFormat[],
  quality: 'sd' | 'hd'
): YtDlpFormat | null {
  // Sort formats by height (resolution) in descending order
  const sorted = [...formats].sort((a, b) => (b.height || 0) - (a.height || 0));

  if (quality === 'sd') {
    // Copilot: SD Logic - Find best quality at or below 480p
    // Filter formats ≤480p, then pick the highest among them
    const sdFormats = sorted.filter((f) => (f.height || 0) <= SD_MAX_HEIGHT);
    
    if (sdFormats.length > 0) {
      // Return the highest quality SD format (first in sorted SD list)
      return sdFormats[0];
    }
    
    // Copilot: Fallback - if no SD formats, return lowest available
    return sorted[sorted.length - 1];
  }

  if (quality === 'hd') {
    // Copilot: HD Logic - Prioritize 1080p, fallback to closest
    
    // First, try to find exact 1080p
    const exact1080 = sorted.find((f) => f.height === HD_TARGET_HEIGHT);
    if (exact1080) return exact1080;

    // Copilot: No exact 1080p - find closest to 1080p
    // Prefer higher resolution over lower if equidistant
    const withDistance = sorted.map((f) => ({
      format: f,
      distance: Math.abs((f.height || 0) - HD_TARGET_HEIGHT),
    }));

    withDistance.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      // If same distance, prefer higher resolution
      return (b.format.height || 0) - (a.format.height || 0);
    });

    return withDistance[0]?.format || null;
  }

  return null;
}

/**
 * Selects the best photo/image format from available formats
 * 
 * @param formats - Array of available formats from yt-dlp
 * @returns The selected image format or null if no suitable format found
 * 
 * Copilot: Photos should prefer highest quality image format
 * Priority: jpg/jpeg > png > webp > gif
 */
export function selectPhotoFormat(formats: YtDlpFormat[]): YtDlpFormat | null {
  // Copilot: Filter to only image formats
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
  const imageFormats = formats.filter((f) => 
    imageExtensions.includes(f.ext?.toLowerCase() || '')
  );

  if (imageFormats.length === 0) {
    // No explicit image formats, try to find any format
    return formats[0] || null;
  }

  // Copilot: Sort by quality - prefer larger dimensions
  const sorted = [...imageFormats].sort((a, b) => {
    const aSize = (a.width || 0) * (a.height || 0);
    const bSize = (b.width || 0) * (b.height || 0);
    
    // If sizes are equal, prefer by extension priority
    if (aSize === bSize) {
      const extPriority: Record<string, number> = { jpg: 1, jpeg: 1, png: 2, webp: 3, gif: 4, bmp: 5 };
      return (extPriority[a.ext || ''] || 99) - (extPriority[b.ext || ''] || 99);
    }
    
    return bSize - aSize; // Larger first
  });

  return sorted[0] || null;
}

// ============================================================================
// FORMAT CONVERSION HELPERS
// ============================================================================

/**
 * Converts yt-dlp format to our VideoFormat type
 * 
 * @param format - Raw yt-dlp format object
 * @returns Standardized VideoFormat object
 * 
 * Copilot: Use this to transform yt-dlp output to our API response format
 */
export function toVideoFormat(format: YtDlpFormat): VideoFormat {
  return {
    formatId: format.format_id,
    ext: format.ext || 'mp4',
    resolution: format.resolution || `${format.width || 0}x${format.height || 0}`,
    filesize: format.filesize || format.filesize_approx || null,
    quality: getQualityLabel(format.height || 0),
  };
}

/**
 * Generates human-readable quality label from height
 * 
 * Copilot: Map pixel height to common quality labels
 */
function getQualityLabel(height: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  return `${height}p`;
}

/**
 * Converts yt-dlp video info to our VideoInfo type
 * 
 * @param info - Raw yt-dlp video info
 * @param platform - Detected platform
 * @returns Standardized VideoInfo object
 * 
 * Copilot: Extract relevant fields from yt-dlp JSON output
 */
export function toVideoInfo(
  info: YtDlpVideoInfo,
  platform: 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'vimeo' | 'other' | 'unknown'
): VideoInfo {
  // Copilot: Get best thumbnail - prefer higher resolution
  const thumbnail = info.thumbnail || 
    (info.thumbnails && info.thumbnails.length > 0 
      ? info.thumbnails[info.thumbnails.length - 1].url 
      : '');

  // Copilot: Detect if this is a photo or video based on formats/duration
  // Photos typically have no duration and image formats (jpg, png, webp)
  const isPhoto = detectIfPhoto(info);

  return {
    title: info.title || 'Unknown Title',
    thumbnail: thumbnail || '',
    duration: info.duration || 0,
    uploader: info.uploader || info.channel || 'Unknown',
    platform,
    mediaType: isPhoto ? 'photo' : 'video',
  };
}

/**
 * Detects if the media is a photo based on yt-dlp info
 * 
 * @param info - Raw yt-dlp video info
 * @returns true if the media appears to be a photo/image
 * 
 * Copilot: Photos have no duration and typically have image extensions
 */
function detectIfPhoto(info: YtDlpVideoInfo): boolean {
  // No duration usually means it's an image
  if (!info.duration || info.duration === 0) {
    // Check if formats contain image extensions
    if (info.formats && info.formats.length > 0) {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
      const hasImageFormat = info.formats.some(f => 
        imageExtensions.includes(f.ext?.toLowerCase() || '')
      );
      if (hasImageFormat) return true;
    }
    
    // Check if URL contains image indicators
    if (info.url) {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      if (imageExtensions.some(ext => info.url?.toLowerCase().includes(ext))) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================================================
// DOWNLOAD URL GENERATION
// ============================================================================

/**
 * Gets the direct download URL for a specific format
 * 
 * @param url - Original video URL
 * @param formatId - The format ID to download
 * @returns Direct download URL
 * 
 * Copilot: Uses yt-dlp -g flag to get direct URL without downloading.
 * This URL can be used for direct browser downloads.
 */
export async function getDownloadUrl(
  url: string,
  formatId: string
): Promise<string> {
  try {
    // Copilot: Find the yt-dlp executable (handles Windows PATH issues)
    const ytdlp = await findYtDlpExecutable();
    
    // Copilot: yt-dlp command to get direct URL:
    // -f: Specify format by ID
    // -g: Print URL only (no download)
    // --no-warnings: Suppress warnings
    const command = `${ytdlp} -f "${formatId}" -g --no-warnings "${url}"`;
    
    const { stdout } = await execAsync(command, {
      timeout: 30000,
    });

    const downloadUrl = stdout.trim();
    
    if (!downloadUrl) {
      throw new Error('No download URL returned');
    }

    return downloadUrl;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get download URL: ${error.message}`);
    }
    throw new Error('Unknown error getting download URL');
  }
}

/**
 * Gets download URL with best audio+video merge for a format
 * 
 * @param url - Original video URL
 * @param quality - 'sd' or 'hd'
 * @returns Direct download URL with audio
 * 
 * Copilot: Some formats are video-only. This ensures we get
 * a format with both audio and video merged.
 */
export async function getDownloadUrlWithAudio(
  url: string,
  quality: 'sd' | 'hd'
): Promise<{ downloadUrl: string; format: YtDlpFormat }> {
  // Copilot: Fetch full video info to get all available formats
  const videoInfo = await fetchVideoInfo(url);
  
  if (!videoInfo.formats || videoInfo.formats.length === 0) {
    throw new Error('No formats available for this video');
  }

  // Copilot: Select appropriate format based on quality
  const selectedFormat = selectFormat(videoInfo.formats, quality);
  
  if (!selectedFormat) {
    throw new Error(`No ${quality.toUpperCase()} format available`);
  }

  // Copilot: If selected format has audio, use its URL directly
  if (selectedFormat.acodec && selectedFormat.acodec !== 'none' && selectedFormat.url) {
    return { downloadUrl: selectedFormat.url, format: selectedFormat };
  }

  // Copilot: Format is video-only, use yt-dlp to get merged URL
  // Format string: video+bestaudio selects video format + best audio
  const formatString = quality === 'sd'
    ? `bestvideo[height<=${SD_MAX_HEIGHT}]+bestaudio/best[height<=${SD_MAX_HEIGHT}]`
    : `bestvideo[height<=${HD_TARGET_HEIGHT}]+bestaudio/bestvideo+bestaudio/best`;

  try {
    // Copilot: Find the yt-dlp executable (handles Windows PATH issues)
    const ytdlp = await findYtDlpExecutable();
    const command = `${ytdlp} -f "${formatString}" -g --no-warnings "${url}"`;
    const { stdout } = await execAsync(command, { timeout: 30000 });
    
    // Copilot: yt-dlp may return multiple URLs (video + audio) when merging
    // In that case, return just the video URL and let frontend handle it
    const urls = stdout.trim().split('\n');
    
    return { 
      downloadUrl: urls[0], 
      format: selectedFormat 
    };
  } catch {
    // Copilot: Fallback - try getting direct URL from selected format
    if (selectedFormat.url) {
      return { downloadUrl: selectedFormat.url, format: selectedFormat };
    }
    
    // Last resort - use format ID
    const downloadUrl = await getDownloadUrl(url, selectedFormat.format_id);
    return { downloadUrl, format: selectedFormat };
  }
}
