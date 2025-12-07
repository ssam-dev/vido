# Use a minimal Node.js image
FROM node:20-slim

# ============================================
# 🔧 Setup System Dependencies (Python, yt-dlp, ffmpeg)
# ============================================

# Install Python and yt-dlp dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp and gallery-dl globally
# Using --break-system-packages is necessary in Debian/Ubuntu images like node:slim
RUN pip3 install --break-system-packages yt-dlp gallery-dl

# Verify installation
RUN yt-dlp --version && gallery-dl --version

# ============================================
# 🏗️ Next.js Application Setup and Build
# ============================================

# Set working directory
WORKDIR /app

# Copy package files (for dependency installation)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# ============================================
# 🚀 Runtime Configuration
# ============================================

# Expose the application's standard port for documentation.
# This does not publish the port, but indicates the port the container is listening on.
EXPOSE 3000

# Set environment variables required by Next.js and the container environment.
# NODE_ENV=production optimizes the Next.js runtime.
# HOSTNAME="0.0.0.0" ensures the Next.js server binds to all available network interfaces.
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Start the Next.js application in production mode.
# The 'sh -c' (shell form) is crucial for dynamic cloud deployments (e.g., Railway, Render).
# It allows for variable substitution: ${PORT} is used if set by the host, otherwise it defaults to 3000.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
