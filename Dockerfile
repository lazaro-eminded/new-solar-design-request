FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /data/session

ENV SESSION_PATH=/data/session

CMD ["node", "index.js"]
