# Multi-stage Dockerfile for MyApp Backend (NestJS + Bun)

# Stage 1: Builder
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package management files
COPY package.json bun.lock ./

# Install dependencies (frozen lockfile)
RUN bun install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Build application
RUN bun run build

# Stage 2: Runner
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application and required production assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules

# Ensure entrypoint is executable and set correct permissions
RUN chown -R bun:bun /app

# Run as non-root user
USER bun

# Expose backend port
EXPOSE 2001

CMD ["bun", "run", "src/main.ts"]
