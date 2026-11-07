FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && pip3 install --break-system-packages --no-cache-dir -U yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DOWNLOAD_TMP_DIR=/tmp/unidown \
    TRUST_PROXY=loopback

RUN mkdir -p /tmp/unidown && chown -R node:node /app /tmp/unidown
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
