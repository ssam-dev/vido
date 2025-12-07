/**
 * /api/fetch-video API Route
 * 
 * This Next.js API route handles video and photo information fetching and download URL
 * generation using yt-dlp. It supports YouTube, Instagram, Facebook, Twitter, TikTok,
 * and 1000+ other websites with SD (≤480p) and HD (1080p priority) quality options.
 * 
 * Copilot: This is the main API endpoint for the media downloader.
 * It validates requests, processes media through yt-dlp, and returns
 * download URLs with metadata.
 * 
 * ENDPOINT: POST /api/fetch-video
 * BODY: { url: string, quality: 'sd' | 'hd', mediaType?: 'video' | 'photo' | 'auto' }
 * 
 * Best Practices:
 * - Validates input before processing
 * - Returns structured error responses
 * - Handles yt-dlp errors gracefully
 * - Uses TypeScript for type safety
 * - Supports both video and photo downloads
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  VideoFetchRequest,
  VideoFetchResponse,
  VideoFetchError,
} from '@/types/video';
import {
  validateVideoUrl,
  fetchVideoInfo,
  selectFormat,
  selectPhotoFormat,
  toVideoInfo,
  toVideoFormat,
  getDownloadUrl,
} from '@/services/ytdlp';

// ============================================================================
// API CONFIGURATION
// ============================================================================

/**
 * Copilot: Configure API route behavior
 * - dynamic: 'force-dynamic' ensures fresh data on each request
 * - This prevents caching of video URLs which may expire
 */
export const dynamic = 'force-dynamic';

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * POST Handler - Process video download requests
 * 
 * @param request - Next.js request object
 * @returns JSON response with video info and download URL
 * 
 * Copilot: This handler follows a clear flow:
 * 1. Parse and validate request body
 * 2. Validate URL format and platform
 * 3. Fetch video info via yt-dlp
 * 4. Select appropriate format (SD/HD)
 * 5. Get download URL
 * 6. Return structured response
 */
export async function POST(request: NextRequest): Promise<NextResponse<VideoFetchResponse | VideoFetchError>> {
  try {
    // ========================================================================
    // STEP 1: Parse Request Body
    // ========================================================================
    
    // Copilot: Parse JSON body, handle parsing errors
    let body: VideoFetchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_URL',
        } as VideoFetchError,
        { status: 400 }
      );
    }

    const { url, quality } = body;

    // ========================================================================
    // STEP 2: Validate Request Parameters
    // ========================================================================

    // Copilot: Validate URL is provided
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'URL is required',
          code: 'INVALID_URL',
        } as VideoFetchError,
        { status: 400 }
      );
    }

    // Copilot: Validate quality parameter
    if (!quality || !['sd', 'hd'].includes(quality)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Quality must be either "sd" or "hd"',
          code: 'INVALID_URL',
        } as VideoFetchError,
        { status: 400 }
      );
    }

    // ========================================================================
    // STEP 3: Validate URL and Detect Platform
    // ========================================================================

    // Copilot: Use utility function to validate URL format and detect platform
    const validation = validateVideoUrl(url);
    
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'Invalid URL',
          code: 'UNSUPPORTED_PLATFORM',
        } as VideoFetchError,
        { status: 400 }
      );
    }

    // ========================================================================
    // STEP 4: Fetch Video Information via yt-dlp
    // ========================================================================

    // Copilot: Call yt-dlp to get video metadata and available formats
    let videoInfo;
    try {
      videoInfo = await fetchVideoInfo(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch video';
      
      // Copilot: Determine appropriate error code based on error message
      let errorCode: VideoFetchError['code'] = 'YTDLP_ERROR';
      if (message.includes('unavailable') || message.includes('private')) {
        errorCode = 'VIDEO_UNAVAILABLE';
      } else if (message.includes('not installed')) {
        errorCode = 'YTDLP_ERROR';
      }

      return NextResponse.json(
        {
          success: false,
          error: message,
          code: errorCode,
        } as VideoFetchError,
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 5: Select Format Based on Quality Preference and Media Type
    // ========================================================================

    // Copilot: Use quality mapping logic to select SD (≤480p) or HD (1080p priority)
    // For photos, select the best image format available
    if (!videoInfo.formats || videoInfo.formats.length === 0) {
      // Copilot: If no formats but we have a direct URL (common for images), use it
      if (videoInfo.url) {
        const info = toVideoInfo(videoInfo, validation.platform);
        const response: VideoFetchResponse = {
          success: true,
          info,
          downloadUrl: videoInfo.url,
          selectedFormat: {
            formatId: 'direct',
            ext: info.mediaType === 'photo' ? 'jpg' : 'mp4',
            resolution: 'Original',
            filesize: null,
            quality: 'Original',
          },
        };
        return NextResponse.json(response);
      }

      return NextResponse.json(
        {
          success: false,
          error: 'No formats available for this media',
          code: 'QUALITY_NOT_FOUND',
        } as VideoFetchError,
        { status: 404 }
      );
    }

    // Copilot: Check if this is a photo based on available formats
    const info = toVideoInfo(videoInfo, validation.platform);
    const isPhoto = info.mediaType === 'photo';

    // Select format based on media type
    const selectedFormat = isPhoto 
      ? selectPhotoFormat(videoInfo.formats)
      : selectFormat(videoInfo.formats, quality);
    
    if (!selectedFormat) {
      return NextResponse.json(
        {
          success: false,
          error: isPhoto 
            ? 'No image format available for this photo'
            : `No ${quality.toUpperCase()} quality format available for this video`,
          code: 'QUALITY_NOT_FOUND',
        } as VideoFetchError,
        { status: 404 }
      );
    }

    // ========================================================================
    // STEP 6: Get Download URL
    // ========================================================================

    // Copilot: Get direct download URL for the selected format
    let downloadUrl: string;
    try {
      // First try to use the URL from the format if available
      if (selectedFormat.url) {
        downloadUrl = selectedFormat.url;
      } else {
        // Otherwise, use yt-dlp to get the download URL
        downloadUrl = await getDownloadUrl(url, selectedFormat.format_id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get download URL';
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: 'YTDLP_ERROR',
        } as VideoFetchError,
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 7: Return Success Response
    // ========================================================================

    // Copilot: Build and return structured success response
    const response: VideoFetchResponse = {
      success: true,
      info,
      downloadUrl,
      selectedFormat: toVideoFormat(selectedFormat),
    };

    return NextResponse.json(response);
  } catch (error) {
    // ========================================================================
    // GLOBAL ERROR HANDLER
    // ========================================================================
    
    // Copilot: Catch-all for unexpected errors
    console.error('Unexpected error in /api/fetch-video:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      } as VideoFetchError,
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER (CORS)
// ============================================================================

/**
 * OPTIONS Handler - Handle CORS preflight requests
 * 
 * Copilot: Required for cross-origin requests during development.
 * In production, configure CORS in next.config.ts or middleware.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
