# Use Node.js with Debian for yt-dlp compatibility
FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp and gallery-dl
RUN pip3 install --break-system-packages yt-dlp gallery-dl

# Verify installations
RUN yt-dlp --version && gallery-dl --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command - simple and direct
CMD node node_modules/next/dist/bin/next start -H 0.0.0.0 -p $PORT
