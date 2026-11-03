FROM node:22-bookworm-slim

# Install Chromium (for Puppeteer/Cloudflare refresh) and FFmpeg (for on-demand trailer muxing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=7860
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV HOME=/tmp

WORKDIR /app

# 1. Install root dependencies
COPY package.json package-lock.json* ./
RUN npm install

# 2. Install anivexa-api sub-package dependencies (downloads Linux native wreq-js binding)
COPY anivexa-api/package.json ./anivexa-api/
RUN npm --prefix anivexa-api install

# 3. Copy project source files
COPY . .

# 4. Build Vite frontend into /app/dist
RUN npm run build

# 5. Ensure writable directories for Hugging Face's non-root container user (uid=1000)
RUN mkdir -p /app/server/data/trailers /app/anivexa-api/core/.cache \
    && chmod -R 777 /app/server/data /app/anivexa-api/core/.cache /app

EXPOSE 7860

CMD ["node", "server/index.js"]
