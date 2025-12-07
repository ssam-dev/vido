/**
 * Video Downloader - Main Page Component
 * 
 * This is the main UI for the video downloader application. It provides:
 * - A responsive single URL input form
 * - SD (≤480p) and HD (1080p) download options
 * - Video preview with metadata display
 * - Error handling and loading states
 * 
 * Copilot: This component follows React best practices:
 * - Uses client-side rendering for interactivity
 * - Implements proper form handling
 * - Shows loading and error states
 * - Responsive design with Tailwind CSS
 */

'use client';

import { useState, FormEvent } from 'react';
import type { VideoFetchResponse, VideoFetchError } from '@/types/video';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Copilot: Define component state types for better type safety
 */
type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface VideoState {
  status: FetchStatus;
  data: VideoFetchResponse | null;
  error: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Home - Main page component for video downloader
 * 
 * Copilot: This component manages:
 * - URL input state
 * - Video fetch status (idle/loading/success/error)
 * - Quality selection (SD/HD)
 * - Download initiation
 */
export default function Home() {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  // Copilot: URL input state - stores the user-entered video URL
  const [url, setUrl] = useState<string>('');
  
  // Copilot: Video state - tracks fetch status, data, and errors
  const [videoState, setVideoState] = useState<VideoState>({
    status: 'idle',
    data: null,
    error: null,
  });

  // Copilot: Track which quality is currently being fetched
  const [fetchingQuality, setFetchingQuality] = useState<'sd' | 'hd' | null>(null);

  // ========================================================================
  // API HANDLERS
  // ========================================================================

  /**
   * Fetches video information and download URL from the API
   * 
   * @param quality - 'sd' for Standard Definition (≤480p), 'hd' for High Definition (1080p)
   * 
   * Copilot: This function:
   * 1. Validates URL is not empty
   * 2. Sets loading state
   * 3. Calls /api/fetch-video endpoint
   * 4. Handles success/error responses
   */
  const fetchVideo = async (quality: 'sd' | 'hd') => {
    // Copilot: Validate URL before making API request
    if (!url.trim()) {
      setVideoState({
        status: 'error',
        data: null,
        error: 'Please enter a video URL',
      });
      return;
    }

    // Copilot: Set loading state and track which quality is being fetched
    setFetchingQuality(quality);
    setVideoState({
      status: 'loading',
      data: null,
      error: null,
    });

    try {
      // Copilot: Make POST request to /api/fetch-video
      const response = await fetch('/api/fetch-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim(), quality }),
      });

      // Copilot: Parse JSON response
      const data: VideoFetchResponse | VideoFetchError = await response.json();

      if (data.success) {
        // Copilot: Success - update state with video data
        setVideoState({
          status: 'success',
          data: data,
          error: null,
        });
      } else {
        // Copilot: API returned error response
        setVideoState({
          status: 'error',
          data: null,
          error: data.error || 'Failed to fetch video',
        });
      }
    } catch (err) {
      // Copilot: Network or parsing error
      setVideoState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'An error occurred',
      });
    } finally {
      setFetchingQuality(null);
    }
  };

  /**
   * Handles form submission - prevents default and fetches HD by default
   * 
   * Copilot: Form submission handler for Enter key support
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Copilot: Default to HD quality on form submit
    fetchVideo('hd');
  };

  /**
   * Initiates download by opening the download URL
   * 
   * Copilot: Opens download URL in new tab. Browser will handle
   * the download based on Content-Disposition headers.
   */
  const handleDownload = () => {
    if (videoState.data?.downloadUrl) {
      window.open(videoState.data.downloadUrl, '_blank');
    }
  };

  /**
   * Formats duration from seconds to MM:SS or HH:MM:SS
   * 
   * Copilot: Helper function for displaying video duration
   */
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Formats file size from bytes to human-readable format
   * 
   * Copilot: Helper function for displaying file size
   */
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Copilot: Main container with responsive padding */}
      <div className="container mx-auto px-4 py-8 sm:py-16">
        
        {/* ================================================================ */}
        {/* HEADER SECTION */}
        {/* ================================================================ */}
        
        {/* Copilot: Header with app title and description */}
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Video Downloader
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
            Download videos from YouTube, Instagram Reels, and Facebook.
            Choose between SD (480p) and HD (1080p) quality.
          </p>
        </header>

        {/* ================================================================ */}
        {/* URL INPUT FORM */}
        {/* ================================================================ */}

        {/* 
          Copilot: Form section with single URL input
          - Responsive design: stacked on mobile, inline on desktop
          - Submit on Enter key or button click
        */}
        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Copilot: URL input field with placeholder */}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste video URL here (YouTube, Instagram Reels, or Facebook)"
              className="flex-1 px-4 py-3 sm:py-4 rounded-xl bg-white/10 border border-white/20 
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                         focus:ring-purple-500 focus:border-transparent text-sm sm:text-base
                         transition-all duration-200"
              disabled={videoState.status === 'loading'}
            />
          </div>
        </form>

        {/* ================================================================ */}
        {/* QUALITY SELECTION BUTTONS */}
        {/* ================================================================ */}

        {/* 
          Copilot: Download buttons for SD and HD quality
          - SD: Standard Definition ≤480p
          - HD: High Definition, prioritizing 1080p
          - Shows loading spinner when fetching
        */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Copilot: SD Download Button */}
            <button
              type="button"
              onClick={() => fetchVideo('sd')}
              disabled={videoState.status === 'loading'}
              className="px-6 py-3 sm:py-4 rounded-xl font-semibold text-white
                         bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 
                         disabled:cursor-not-allowed transition-all duration-200
                         flex items-center justify-center gap-2 min-w-[160px]"
            >
              {fetchingQuality === 'sd' ? (
                <>
                  {/* Copilot: Loading spinner SVG */}
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  {/* Copilot: SD icon */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                  <span>SD (480p)</span>
                </>
              )}
            </button>

            {/* Copilot: HD Download Button */}
            <button
              type="button"
              onClick={() => fetchVideo('hd')}
              disabled={videoState.status === 'loading'}
              className="px-6 py-3 sm:py-4 rounded-xl font-semibold text-white
                         bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 
                         disabled:cursor-not-allowed transition-all duration-200
                         flex items-center justify-center gap-2 min-w-[160px]"
            >
              {fetchingQuality === 'hd' ? (
                <>
                  {/* Copilot: Loading spinner SVG */}
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  {/* Copilot: HD icon */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>HD (1080p)</span>
                </>
              )}
            </button>
          </div>

          {/* Copilot: Quality description */}
          <p className="text-center text-gray-400 text-sm mt-4">
            SD: Standard Definition (up to 480p) • HD: High Definition (prioritizes 1080p)
          </p>
        </div>

        {/* ================================================================ */}
        {/* ERROR DISPLAY */}
        {/* ================================================================ */}

        {/* Copilot: Error message display */}
        {videoState.status === 'error' && videoState.error && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-center">
              <p className="text-red-300">{videoState.error}</p>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIDEO RESULT CARD */}
        {/* ================================================================ */}

        {/* 
          Copilot: Video result card displayed on successful fetch
          - Shows thumbnail, title, metadata
          - Download button for selected quality
        */}
        {videoState.status === 'success' && videoState.data && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/20">
              {/* Copilot: Video thumbnail */}
              {videoState.data.info.thumbnail && (
                <div className="relative aspect-video bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={videoState.data.info.thumbnail}
                    alt={videoState.data.info.title}
                    className="w-full h-full object-contain"
                  />
                  {/* Copilot: Duration overlay */}
                  {videoState.data.info.duration > 0 && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-sm px-2 py-1 rounded">
                      {formatDuration(videoState.data.info.duration)}
                    </span>
                  )}
                </div>
              )}

              {/* Copilot: Video information */}
              <div className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 line-clamp-2">
                  {videoState.data.info.title}
                </h2>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
                  {/* Copilot: Uploader/Channel name */}
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {videoState.data.info.uploader}
                  </span>
                  
                  {/* Copilot: Platform badge */}
                  <span className="flex items-center gap-1 capitalize">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    {videoState.data.info.platform}
                  </span>

                  {/* Copilot: Selected quality and format info */}
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {videoState.data.selectedFormat.quality} • {videoState.data.selectedFormat.ext.toUpperCase()}
                  </span>

                  {/* Copilot: File size if available */}
                  {videoState.data.selectedFormat.filesize && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {formatFileSize(videoState.data.selectedFormat.filesize)}
                    </span>
                  )}
                </div>

                {/* Copilot: Download button */}
                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white
                             bg-gradient-to-r from-green-500 to-emerald-600 
                             hover:from-green-600 hover:to-emerald-700
                             transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download {videoState.data.selectedFormat.quality}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SUPPORTED PLATFORMS INFO */}
        {/* ================================================================ */}

        {/* Copilot: Footer with supported platforms */}
        <footer className="mt-12 sm:mt-16 text-center">
          <p className="text-gray-400 text-sm mb-4">Supported Platforms</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
            {/* Copilot: YouTube */}
            <div className="flex items-center gap-2 text-gray-300">
              <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span>YouTube</span>
            </div>

            {/* Copilot: Instagram */}
            <div className="flex items-center gap-2 text-gray-300">
              <svg className="w-6 h-6 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>Instagram Reels</span>
            </div>

            {/* Copilot: Facebook */}
            <div className="flex items-center gap-2 text-gray-300">
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </div>
          </div>

          {/* Copilot: Disclaimer */}
          <p className="text-gray-500 text-xs mt-8 max-w-md mx-auto">
            This tool requires yt-dlp to be installed locally. 
            Please ensure you have the right to download the content.
          </p>
        </footer>
      </div>
    </div>
  );
}
