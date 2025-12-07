# Vido - Media Downloader

A powerful local media downloader built with Next.js that supports downloading videos and photos from YouTube, Instagram, Twitter, TikTok, and 1000+ other websites.

## Features

- 🎬 **Video Downloads** - SD (480p) and HD (1080p) quality options
- 📸 **Photo Downloads** - Download images from any supported platform
- 🌐 **1000+ Sites** - Supports YouTube, Instagram, Twitter, TikTok, Vimeo, and many more
- 🔐 **Authentication Support** - Automatically uses browser cookies for login-required sites
- 🎨 **Modern UI** - Beautiful dark theme with responsive design

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **yt-dlp** - Install with: `pip install yt-dlp`

## Getting Started

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Instagram, Twitter & Login-Required Sites

Some sites like Instagram and Twitter require authentication. The app supports two methods:

### Method 1: Automatic Browser Cookies (Recommended for Firefox)
1. Log into Instagram/Twitter in **Firefox**
2. Close Firefox completely
3. The app will automatically extract your cookies

### Method 2: Manual Cookie Export (If browsers are running)
1. Install "Get cookies.txt LOCALLY" browser extension:
   - [Chrome Extension](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
2. Log into Instagram/Twitter
3. Click the extension icon while on the site
4. Export and save as `cookies.txt` in the app folder

## Supported Platforms

| Platform | Videos | Photos | Auth Required |
|----------|--------|--------|---------------|
| YouTube | ✅ | ✅ | No |
| TikTok | ✅ | ✅ | No |
| Vimeo | ✅ | ❌ | No |
| Instagram | ✅ | ✅ | **Yes** |
| Twitter/X | ✅ | ✅ | Some content |
| Facebook | ✅ | ✅ | Some content |
| And 1000+ more... |

## Tech Stack

- **Next.js 16** - React framework
- **Tailwind CSS 4** - Styling
- **yt-dlp** - Media extraction
- **TypeScript** - Type safety

## License

MIT

