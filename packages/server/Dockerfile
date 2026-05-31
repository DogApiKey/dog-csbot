FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace root and server package configs
COPY package.json bun.lockb ./
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy server source
COPY packages/server/ ./packages/server/

# Build
RUN cd packages/server && bun build src/index.ts --outdir dist --target bun

# ─── Runtime ──────────────────────────────────────────────────────────────

FROM oven/bun:1-slim
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "packages/server/dist/index.js"]
