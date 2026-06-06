# Multi-stage build for the kalshi Next.js dashboard (standalone output).
# Runs the dashboard only — the analysis pipeline (lib/pipeline.ts) shells out to the
# Claude Max CLI and is NOT run in-cluster; reports are synced into /app/results.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Standalone server + static assets + seed data (data/*.json is read at runtime via fs,
# so it must be copied explicitly — Next's tracer won't include plain data files).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/data ./data
# results/ is a mounted PVC at runtime; create the mount point.
RUN mkdir -p /app/results
EXPOSE 3000
CMD ["node", "server.js"]
