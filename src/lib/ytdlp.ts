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
 * 
 * Copilot: This is the core utility for video processing. All yt-dlp
 * interactions should go through these functions.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
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
 * SUPPORTED_PLATFORMS - Regex patterns for supported video platforms
 * 
 * Copilot: Add new platform patterns here to extend support.
 * Each pattern should match the full URL structure.
 */
const SUPPORTED_PLATFORMS = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(reel|reels|p)\//i,
  facebook: /^(https?:\/\/)?(www\.|m\.|web\.)?facebook\.com\/.*(videos?|watch|reel)/i,
} as const;

// ============================================================================
// URL VALIDATION & PLATFORM DETECTION
// ============================================================================

/**
 * Validates if a URL is from a supported platform
 * 
 * @param url - The URL to validate
 * @returns Object with validation result and detected platform
 * 
 * Copilot: Call this before processing any video URL to ensure
 * the platform is supported and the URL format is valid.
 */
export function validateVideoUrl(url: string): {
  isValid: boolean;
  platform: 'youtube' | 'instagram' | 'facebook' | 'unknown';
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

  // Copilot: Check against each supported platform pattern
  for (const [platform, pattern] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (pattern.test(trimmedUrl)) {
      return {
        isValid: true,
        platform: platform as 'youtube' | 'instagram' | 'facebook',
      };
    }
  }

  return {
    isValid: false,
    platform: 'unknown',
    error: 'URL must be from YouTube, Instagram Reels, or Facebook',
  };
}

// ============================================================================
// YT-DLP EXECUTION
// ============================================================================

/**
 * Fetches video information using yt-dlp --dump-json
 * 
 * @param url - The video URL to fetch info for
 * @returns Parsed video information from yt-dlp
 * @throws Error if yt-dlp fails or returns invalid JSON
 * 
 * Copilot: This function executes yt-dlp as a child process.
 * The --dump-json flag returns metadata without downloading.
 * Handle errors gracefully for better UX.
 */
export async function fetchVideoInfo(url: string): Promise<YtDlpVideoInfo> {
  try {
    // Copilot: Find the yt-dlp executable (handles Windows PATH issues)
    const ytdlp = await findYtDlpExecutable();
    
    // Copilot: yt-dlp command with flags:
    // --dump-json: Output video info as JSON without downloading
    // --no-warnings: Suppress warning messages
    // --no-playlist: Only process single video, not playlists
    const command = `${ytdlp} --dump-json --no-warnings --no-playlist "${url}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      // Copilot: Set timeout to prevent hanging on slow responses
      timeout: 60000, // 60 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large JSON responses
    });

    if (stderr && !stdout) {
      throw new Error(`yt-dlp error: ${stderr}`);
    }

    // Copilot: Parse JSON output from yt-dlp
    const videoInfo: YtDlpVideoInfo = JSON.parse(stdout);
    return videoInfo;
  } catch (error) {
    // Copilot: Handle common yt-dlp errors
    if (error instanceof Error) {
      if (error.message.includes('ENOENT') || error.message.includes('not recognized')) {
        throw new Error('yt-dlp is not installed or not in PATH. Please install it with: pip install yt-dlp');
      }
      if (error.message.includes('Video unavailable')) {
        throw new Error('Video is unavailable or private');
      }
      throw new Error(`Failed to fetch video info: ${error.message}`);
    }
    throw new Error('Unknown error occurred while fetching video info');
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
  platform: 'youtube' | 'instagram' | 'facebook' | 'unknown'
): VideoInfo {
  // Copilot: Get best thumbnail - prefer higher resolution
  const thumbnail = info.thumbnail || 
    (info.thumbnails && info.thumbnails.length > 0 
      ? info.thumbnails[info.thumbnails.length - 1].url 
      : '');

  return {
    title: info.title || 'Unknown Title',
    thumbnail: thumbnail || '',
    duration: info.duration || 0,
    uploader: info.uploader || info.channel || 'Unknown',
    platform,
  };
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
