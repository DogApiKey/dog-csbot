FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace root and server package configs
COPY package.json bun.lock ./
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

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

EXPOSE 3000

CMD ["bun", "run", "packages/server/dist/index.js"]
