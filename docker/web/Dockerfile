# ---------------------------------------------------------------------------
# Ardent Forge Web App -- Multi-stage Docker Build
#
# Stage 1: Build the Vite SPA with Bun
# Stage 2: Serve static assets with nginx
# ---------------------------------------------------------------------------

# -- Build stage ------------------------------------------------------------
FROM oven/bun:latest AS builder

WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN bun run build

# -- Serve stage ------------------------------------------------------------
FROM nginx:alpine

# Copy build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing and caching
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf

# Install curl for health checks
RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

EXPOSE 80
