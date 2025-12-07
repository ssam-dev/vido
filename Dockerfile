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

# EXPOSE: Documents the port the application runs on inside the container (default for Next.js).
# Note: This instruction does not actually publish the port; 'docker run -p' or a deployment service handles mapping the port.
EXPOSE 3000

# ENV: Set required environment variables for the Next.js production runtime.
# NODE_ENV=production: Enables production optimizations (e.g., smaller bundle size, caching).
# HOSTNAME="0.0.0.0": Instructs the Node.js server to listen on all available network interfaces, 
# which is essential for containerized environments.
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# CMD: Defines the command to run when the container starts.
# We use the 'sh -c' (shell form) to enable shell-level variable substitution.
# This ensures dynamic port assignment (${PORT:-3000}) works: 
# It uses the host's assigned $PORT variable (e.g., from Railway/Render) or defaults to 3000.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
