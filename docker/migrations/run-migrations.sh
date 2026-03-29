#!/bin/bash
# ---------------------------------------------------------------------------
# run-migrations.sh -- Apply SQL migrations idempotently
#
# Tracks applied migrations in a schema_migrations table. On subsequent runs,
# already-applied migrations are skipped. Exits 0 on success so downstream
# containers (web app) can start.
# ---------------------------------------------------------------------------
set -e

PGHOST="${POSTGRES_HOST:-db}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-postgres}"

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; do
  echo "PostgreSQL is not ready yet, waiting..."
  sleep 2
done

echo "PostgreSQL is ready. Running migrations..."

# Create the migration tracking table if it does not exist
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDB" \
  -c "CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );"

MIGRATION_DIR="/migrations"
APPLIED=0
SKIPPED=0

for migration_file in $(ls "${MIGRATION_DIR}"/*.sql 2>/dev/null | sort); do
  version=$(basename "$migration_file" .sql)

  already_applied=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$PGHOST" \
    -p "$PGPORT" \
    -U "$PGUSER" \
    -d "$PGDB" \
    -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '${version}';" | tr -d ' ')

  if [ "$already_applied" = "0" ]; then
    echo "Applying migration: ${version}"
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
      -h "$PGHOST" \
      -p "$PGPORT" \
      -U "$PGUSER" \
      -d "$PGDB" \
      -f "$migration_file"

    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
      -h "$PGHOST" \
      -p "$PGPORT" \
      -U "$PGUSER" \
      -d "$PGDB" \
      -c "INSERT INTO schema_migrations (version) VALUES ('${version}');"

    echo "Migration ${version} applied successfully."
    APPLIED=$((APPLIED + 1))
  else
    echo "Migration ${version} already applied, skipping."
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "All migrations complete. Applied: ${APPLIED}, Skipped: ${SKIPPED}."
exit 0
