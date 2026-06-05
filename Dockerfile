# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN apk add --no-cache ffmpeg postgresql-client tini
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]

FROM base AS worker
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV ENABLE_WORKERS=true
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/jobs/worker.js"]
