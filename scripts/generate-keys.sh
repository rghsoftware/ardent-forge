#!/bin/bash
# ---------------------------------------------------------------------------
# generate-keys.sh -- Generate secrets for Ardent Forge Docker deployment
#
# Creates a random JWT secret, derives Supabase anon and service_role JWTs,
# generates a strong Postgres password, and writes everything to .env.
#
# Requirements: openssl, envsubst (part of gettext; brew install gettext on macOS)
# Usage:        ./scripts/generate-keys.sh
# ---------------------------------------------------------------------------
set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Base64url-encode stdin (no padding, URL-safe alphabet)
b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# Create an HS256-signed JWT from a JSON payload and a secret string.
# Args: $1 = JSON payload, $2 = signing secret
sign_jwt() {
  local payload="$1"
  local secret="$2"

  local header='{"alg":"HS256","typ":"JWT"}'
  local header_b64
  header_b64=$(printf '%s' "$header" | b64url)
  local payload_b64
  payload_b64=$(printf '%s' "$payload" | b64url)

  local signing_input="${header_b64}.${payload_b64}"
  local sig
  sig=$(printf '%s' "$signing_input" \
    | openssl dgst -sha256 -hmac "$secret" -binary \
    | b64url)

  printf '%s.%s\n' "$signing_input" "$sig"
}

# ---------------------------------------------------------------------------
# Generate values
# ---------------------------------------------------------------------------

echo "Generating Ardent Forge deployment secrets..."
echo ""

# 32-byte random Postgres password (base64, no special shell characters)
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# 48-byte random JWT secret (64 base64 characters)
JWT_SECRET=$(openssl rand -base64 48)

# Timestamps: issued now, expires in ~10 years (315 360 000 seconds)
IAT=$(date +%s)
EXP=$((IAT + 315360000))

# Supabase anon key -- minimal permissions, safe for client-side use
ANON_KEY=$(sign_jwt "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":${IAT},\"exp\":${EXP}}" "$JWT_SECRET")

# Supabase service_role key -- full database access, server-side only
SERVICE_ROLE_KEY=$(sign_jwt "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":${IAT},\"exp\":${EXP}}" "$JWT_SECRET")

# Realtime enc key -- 32 random bytes (hex), used for internal data encryption
REALTIME_DB_ENC_KEY=$(openssl rand -hex 32)

# Realtime secret key base -- 64 random bytes (hex), Phoenix session signing
REALTIME_SECRET_KEY_BASE=$(openssl rand -hex 64)

# ---------------------------------------------------------------------------
# Write to .env (preserve non-secret lines from .env.example if .env exists)
# ---------------------------------------------------------------------------

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

# If .env already exists, back it up
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak"
  echo "Backed up existing .env to .env.bak"
fi

# Start from .env.example if .env does not exist yet
EXAMPLE_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.example"
if [ ! -f "$ENV_FILE" ] && [ -f "$EXAMPLE_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi

# If we still have no .env (no .env.example either), create a minimal one
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVEOF'
SITE_URL=http://localhost:8080
HTTP_PORT=8080
HTTPS_PORT=8443
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
REALTIME_DB_ENC_KEY=placeholder
REALTIME_SECRET_KEY_BASE=placeholder
ENVEOF
fi

# Replace placeholder values with generated secrets using sed
# Works with both GNU and BSD sed by using a temp file
replace_var() {
  local var="$1"
  local val="$2"
  local file="$3"
  # Match the variable assignment regardless of current value
  if grep -q "^${var}=" "$file" 2>/dev/null; then
    # Use awk to avoid sed delimiter issues with base64 strings
    awk -v var="$var" -v val="$val" '
      BEGIN { FS=OFS="=" }
      $1 == var { print var "=" val; next }
      { print }
    ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
  else
    echo "${var}=${val}" >> "$file"
  fi
}

replace_var "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD" "$ENV_FILE"
replace_var "JWT_SECRET" "$JWT_SECRET" "$ENV_FILE"
replace_var "ANON_KEY" "$ANON_KEY" "$ENV_FILE"
replace_var "SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY" "$ENV_FILE"
replace_var "REALTIME_DB_ENC_KEY" "$REALTIME_DB_ENC_KEY" "$ENV_FILE"
replace_var "REALTIME_SECRET_KEY_BASE" "$REALTIME_SECRET_KEY_BASE" "$ENV_FILE"

# ---------------------------------------------------------------------------
# Generate docker/kong/kong.yml from template (substitutes ${ANON_KEY} etc.)
# Kong's declarative config does not expand env vars at runtime, so we
# produce a concrete file with the real key values embedded.
# ---------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KONG_TEMPLATE="${REPO_ROOT}/docker/kong/kong.yml.template"
KONG_CONFIG="${REPO_ROOT}/docker/kong/kong.yml"

if [ -f "$KONG_TEMPLATE" ]; then
  ANON_KEY="$ANON_KEY" SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
    envsubst '${ANON_KEY} ${SERVICE_ROLE_KEY}' < "$KONG_TEMPLATE" > "$KONG_CONFIG"
  echo "Kong config written to $KONG_CONFIG"
else
  echo "Warning: Kong template not found at $KONG_TEMPLATE" >&2
fi

# ---------------------------------------------------------------------------
# Print summary
# ---------------------------------------------------------------------------

echo "Secrets written to $ENV_FILE"
echo ""
echo "--- Generated Values ---"
echo ""
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo ""
echo "JWT_SECRET=${JWT_SECRET}"
echo ""
echo "ANON_KEY=${ANON_KEY}"
echo ""
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""
echo "--- Next Steps ---"
echo "1. Review and edit $ENV_FILE (set SITE_URL, SMTP, OAuth, etc.)"
echo "2. Run: docker compose up -d"
