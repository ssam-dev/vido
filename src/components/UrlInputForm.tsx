/**
 * URL Input Form Component
 * 
 * A form with URL input field for entering media URLs
 */

import { FormEvent } from 'react';

interface UrlInputFormProps {
  url: string;
  setUrl: (url: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export default function UrlInputForm({ url, setUrl, onSubmit, isLoading }: UrlInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto mb-8">
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste any video URL here (YouTube, Twitter, TikTok, or any website)"
          className="flex-1 px-4 py-3 sm:py-4 rounded-xl bg-white/10 border border-white/20 
                     text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                     focus:ring-purple-500 focus:border-transparent text-sm sm:text-base
                     transition-all duration-200"
          disabled={isLoading}
        />
      </div>
    </form>
  );
}
