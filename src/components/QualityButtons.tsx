/**
 * Quality Buttons Component
 * 
 * SD, HD, and Photo download buttons
 */

import LoadingSpinner from './LoadingSpinner';

interface QualityButtonsProps {
  fetchingQuality: 'sd' | 'hd' | 'photo' | null;
  isLoading: boolean;
  onFetch: (quality: 'sd' | 'hd' | 'photo') => void;
}

export default function QualityButtons({ fetchingQuality, isLoading, onFetch }: QualityButtonsProps) {
  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {/* SD Download Button */}
        <button
          type="button"
          onClick={() => onFetch('sd')}
          disabled={isLoading}
          className="px-6 py-3 sm:py-4 rounded-xl font-semibold text-white
                     bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 
                     disabled:cursor-not-allowed transition-all duration-200
                     flex items-center justify-center gap-2 min-w-[160px]"
        >
          {fetchingQuality === 'sd' ? (
            <>
              <LoadingSpinner />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <span>SD (480p)</span>
            </>
          )}
        </button>

        {/* HD Download Button */}
        <button
          type="button"
          onClick={() => onFetch('hd')}
          disabled={isLoading}
          className="px-6 py-3 sm:py-4 rounded-xl font-semibold text-white
                     bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 
                     disabled:cursor-not-allowed transition-all duration-200
                     flex items-center justify-center gap-2 min-w-[160px]"
        >
          {fetchingQuality === 'hd' ? (
            <>
              <LoadingSpinner />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>HD (1080p)</span>
            </>
          )}
        </button>

        {/* Photo Download Button */}
        <button
          type="button"
          onClick={() => onFetch('photo')}
          disabled={isLoading}
          className="px-6 py-3 sm:py-4 rounded-xl font-semibold text-white
                     bg-green-600 hover:bg-green-700 disabled:bg-green-800 
                     disabled:cursor-not-allowed transition-all duration-200
                     flex items-center justify-center gap-2 min-w-[160px]"
        >
          {fetchingQuality === 'photo' ? (
            <>
              <LoadingSpinner />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Photo</span>
            </>
          )}
        </button>
      </div>

      {/* Quality description */}
      <p className="text-center text-gray-400 text-sm mt-4">
        SD: Standard Definition (up to 480p) • HD: High Definition (1080p) • Photo: Images & Thumbnails
      </p>
    </div>
  );
}
