FROM ghcr.io/puppeteer/puppeteer:24.10.1

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

USER root
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /data/wwebjs_auth && chown -R pptruser:pptruser /data /app

USER pptruser

ENV SESSION_PATH=/data/wwebjs_auth

CMD ["node", "index.js"]
