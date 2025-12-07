# Use Node.js with Python for yt-dlp
FROM node:20-slim

# Install Python and yt-dlp dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp and gallery-dl globally
RUN pip3 install --break-system-packages yt-dlp gallery-dl

# Verify yt-dlp installation
RUN yt-dlp --version && gallery-dl --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Expose port (Render uses PORT env variable, typically 10000)
EXPOSE 10000

# Set environment variables
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=10000

# Start the app - use node directly to run next from node_modules
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p $PORT"]
