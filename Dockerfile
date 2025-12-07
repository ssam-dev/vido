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

# EXPOSE: Declares the network port (3000) on which the Next.js application listens inside the container.
# Purpose: This acts purely as documentation and metadata.
# Configuration Note: This instruction DOES NOT publish the port. External port mapping (e.g., 'docker run -p' or
# cloud deployment settings) is required to make the application accessible from the host system.
EXPOSE 3000

# ENV: Defines critical environment variables for the application's operating environment.
# 1. NODE_ENV=production: Activates Next.js performance optimizations, production caching, and minimizes unnecessary logging.
# 2. HOSTNAME="0.0.0.0": Crucial for container accessibility. Instructs the Node.js process to bind to all available 
#    network interfaces within the container, ensuring it is reachable by the Docker engine and host system.
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# CMD: Specifies the primary process that executes when a container instance is launched.
# Execution Form: Uses the shell form (CMD ["sh", "-c", "..."]) to enable essential shell features.
# Functionality: Runs the Next.js production server and passes the dynamic port argument.
# Dynamic Port Logic: ${PORT:-3000} ensures the application listens on the host's assigned $PORT variable (common
# in PaaS environments like Railway/Render) or safely defaults to 3000 if $PORT is not defined.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
