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

# EXPOSE: Documents the primary network port (3000) that the Next.js application is configured to listen on 
# inside the isolated container environment. 
# IMPORTANT: This instruction is for documentation only and does not automatically map the port to the host system.
# Port mapping must be handled externally (e.g., via 'docker run -p' or the cloud deployment platform's settings).
EXPOSE 3000

# ENV: Sets critical environment variables necessary for the application's runtime.
# NODE_ENV=production: Triggers performance optimizations, minimizes output, and enables production caching 
# within the Next.js framework.
# HOSTNAME="0.0.0.0": Instructs the Node.js server to bind to all available network interfaces within the 
# container. This is crucial for accessibility, as containers don't use 'localhost' (127.0.0.1) reliably.
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# CMD: Specifies the command that executes when the container starts.
# We use the shell form (CMD ["sh", "-c", "..."]) to guarantee shell-level variable substitution.
# This enables dynamic port assignment: the server uses the $PORT environment variable provided by the 
# hosting platform (e.g., Railway, Render) and falls back to port 3000 if $PORT is undefined (${PORT:-3000}).
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
