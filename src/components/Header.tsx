/**
 * Header Component
 * 
 * Displays the app title and description
 */

export default function Header() {
  return (
    <header className="text-center mb-8 sm:mb-12">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
        Media Downloader
      </h1>
      <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
        Download videos and photos from any website - YouTube, Instagram, Facebook, Twitter, TikTok, and 1000+ more sites.
        Choose SD (480p), HD (1080p) for videos, or download photos directly.
      </p>
    </header>
  );
}
