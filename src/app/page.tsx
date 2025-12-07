/**
 * Media Downloader - Main Page Component
 * 
 * This is the main UI for the media downloader application. It provides:
 * - A responsive single URL input form
 * - SD (≤480p) and HD (1080p) download options for videos
 * - Photo download support for images
 * - Media preview with metadata display
 * - Error handling and loading states
 */

'use client';

import { useState, FormEvent } from 'react';
import type { VideoFetchResponse, VideoFetchError } from '@/types/video';
import {
  Header,
  Footer,
  UrlInputForm,
  QualityButtons,
  VideoResultCard,
  ErrorDisplay,
} from '@/components';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface VideoState {
  status: FetchStatus;
  data: VideoFetchResponse | null;
  error: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [url, setUrl] = useState<string>('');
  const [videoState, setVideoState] = useState<VideoState>({
    status: 'idle',
    data: null,
    error: null,
  });
  const [fetchingQuality, setFetchingQuality] = useState<'sd' | 'hd' | 'photo' | null>(null);

  // ========================================================================
  // API HANDLERS
  // ========================================================================

  const fetchVideo = async (quality: 'sd' | 'hd' | 'photo') => {
    if (!url.trim()) {
      setVideoState({
        status: 'error',
        data: null,
        error: 'Please enter a URL',
      });
      return;
    }

    setFetchingQuality(quality);
    setVideoState({
      status: 'loading',
      data: null,
      error: null,
    });

    try {
      const response = await fetch('/api/fetch-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(), 
          quality: quality === 'photo' ? 'hd' : quality,
          mediaType: quality === 'photo' ? 'photo' : 'video'
        }),
      });

      const data: VideoFetchResponse | VideoFetchError = await response.json();

      if (data.success) {
        setVideoState({
          status: 'success',
          data: data,
          error: null,
        });
      } else {
        setVideoState({
          status: 'error',
          data: null,
          error: data.error || 'Failed to fetch video',
        });
      }
    } catch (err) {
      setVideoState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'An error occurred',
      });
    } finally {
      setFetchingQuality(null);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchVideo('hd');
  };

  const handleDownload = () => {
    if (videoState.data?.downloadUrl) {
      window.open(videoState.data.downloadUrl, '_blank');
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-8 sm:py-16">
        
        <Header />

        <UrlInputForm
          url={url}
          setUrl={setUrl}
          onSubmit={handleSubmit}
          isLoading={videoState.status === 'loading'}
        />

        <QualityButtons
          fetchingQuality={fetchingQuality}
          isLoading={videoState.status === 'loading'}
          onFetch={fetchVideo}
        />

        {videoState.status === 'error' && videoState.error && (
          <ErrorDisplay error={videoState.error} />
        )}

        {videoState.status === 'success' && videoState.data && (
          <VideoResultCard
            data={videoState.data}
            onDownload={handleDownload}
          />
        )}

        <Footer />
      </div>
    </div>
  );
}
