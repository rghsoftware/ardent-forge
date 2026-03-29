# ---------------------------------------------------------------------------
# Migration Runner -- applies SQL migrations to PostgreSQL
#
# Lightweight init container that runs once, applies all pending migrations,
# then exits with code 0 so dependent containers can start.
# ---------------------------------------------------------------------------
FROM postgres:15-alpine

RUN apk add --no-cache bash

WORKDIR /migrations

# Copy migration SQL files from the repo
COPY supabase/migrations/ ./

# Copy and prepare the runner script
COPY docker/migrations/run-migrations.sh /run-migrations.sh
RUN chmod +x /run-migrations.sh

ENTRYPOINT ["/run-migrations.sh"]
