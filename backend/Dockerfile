FROM node:20-bookworm-slim

# Purpose-built VPS image: Node runtime plus the real yt-dlp + FFmpeg engine.
# Pin the yt-dlp version so image rebuilds are reproducible; bump deliberately.
ARG YT_DLP_VERSION=2026.10.26

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates tini \
  && pip3 install --break-system-packages --no-cache-dir "yt-dlp==${YT_DLP_VERSION}" \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /root/.cache

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DOWNLOAD_TMP_DIR=/tmp/unidown \
    TRUST_PROXY=loopback

RUN mkdir -p /tmp/unidown && chown -R node:node /app /tmp/unidown
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombie children (yt-dlp/ffmpeg) and forwards SIGTERM for a clean shutdown.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
