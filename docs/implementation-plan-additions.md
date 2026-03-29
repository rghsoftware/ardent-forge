# Implementation Plan Additions: Runtime Configuration & Self-Hosting

These additions go into `implementation-plan.md`. Step 19 and Step 20 are appended after Step 18. The dependency graph, timeline, design decisions table, and Supabase considerations section are also updated.

---

## Dependency Graph Addition

```
                                   ┌───────────┐
                                   │ STEP 18:  │
                                   │ Coach     │
                                   │ Write     │
                                   │ Access    │
                                   └─────┬─────┘
                                         │
        ═════════════════════════════════╪═════════════════════
         Phase 3-4 Complete              │   Social + Analytics
        ═════════════════════════════════╪═════════════════════
                                         │
                                ┌────────┼────────┐
                                ▼                 ▼
                         ┌───────────┐     ┌───────────┐
                         │ STEP 19:  │     │ STEP 20:  │
                         │ Runtime   │     │ Docker &  │
                         │ Backend   │     │ Self-Host │
                         │ Config    │     │           │
                         └─────┬─────┘     └───────────┘
                               │
        ═══════════════════════╪═══════════════════════════════
         Phase 5 Complete       │   Ready for Play Store release
        ═══════════════════════╪═══════════════════════════════
```

**Note on ordering:** Step 19 and Step 20 are shown after Phase 3-4 for dependency graph clarity, but Step 19 can be executed at any point after Phase 1 (Step 9). It modifies the Supabase client initialization and adds a settings screen — both of which exist by Step 9. Step 20 (Docker) can be done at any point after Step 3 (Supabase schema exists). Neither step depends on Steps 10-18. The only hard requirement is that Step 19 must be complete before any Play Store or public distribution.

---

## STEP 19: Runtime Backend Configuration

**Dependencies:** Step 4 (Supabase adapter + auth), Step 8 (Tauri shell + SQLite). Can be done in parallel with Steps 10-18.
**Priority:** P0 (required before Play Store release)
**Docs:** `03-prd-hosting.md`, `07-architecture.md` §Configuration Layer, `06-invariants.md` §Configuration Invariants

### What to build

Runtime configuration system allowing users to point the app at any Supabase instance. Replaces the current eager Supabase client initialization with a lazy, config-store-driven approach.

### 19a. Config store interface + implementations

Define a `ConfigStore` interface with methods: `getConfig`, `setConfig`, `clearConfig`, `hasConfig`. Two implementations follow the existing adapter pattern.

| Implementation | Storage | Read Timing |
|----------------|---------|-------------|
| Browser | `localStorage` key `ardentforge:config` | Synchronous |
| Tauri | SQLite `app_config` table (key-value, local-only) | Async via `invoke('get_app_config')` |

The `app_config` table is created in the existing SQLite migration set but is excluded from the sync engine's table list. It has two columns: `key` (TEXT PRIMARY KEY) and `value` (TEXT, JSON string).

New Tauri commands for Step 8's Rust backend:

| Command | Purpose |
|---------|---------|
| `get_app_config` | Read a config key from `app_config` |
| `set_app_config` | Write a config key to `app_config` |
| `clear_app_config` | Delete a config key |
| `wipe_synced_data` | Drop and recreate all synced tables (for backend change) |

### 19b. Supabase client lazy initialization

Refactor `src/lib/supabase.ts` from eager module-level initialization to a lazy factory.

Current behavior: `createClient(import.meta.env.VITE_SUPABASE_URL, ...)` runs at import time.

New behavior: A `getSupabaseClient()` function reads from the config store on first call, constructs the client, and caches it. Returns `null` if no config exists. On config change, the cached client is discarded.

The Supabase adapter and all TanStack Query hooks that reference the client are updated to use the factory. The sync engine (Rust) also reads the config store for its Supabase connection.

### 19c. Connection validator

A validation function that takes a URL and publishable key, attempts a lightweight request against the target Supabase instance, and returns a result indicating success, connection failure, or missing schema.

Validation steps: first, hit the REST API root to confirm the instance is reachable and the key is accepted. Second, attempt a simple query against a known table (e.g., `SELECT 1 FROM exercises LIMIT 1`) to confirm the schema is present. The second step distinguishes between "valid Supabase but no Ardent Forge schema" and "fully configured."

### 19d. Backend setup screen

A new route at `/setup` with the Iron & Ember design system. This screen is shown only when no valid configuration exists (first launch with failed defaults, or after config is cleared).

| Element | Design |
|---------|--------|
| Heading | "CONFIGURE BACKEND" in `text-industrial` |
| URL field | Underline input, placeholder "Supabase URL" |
| Key field | Underline input, placeholder "Publishable Key" |
| Validate button | `forge` CTA: "CONNECT" |
| Status | Inline feedback: connecting spinner, success checkmark, error message |
| Help link | "Self-hosting? See the setup guide" → links to GitHub docs |

### 19e. Settings UI: Backend section

Add a "Backend" section to the existing Settings route. Shows current Supabase URL (truncated, with copy button). "CHANGE BACKEND" button opens an edit form identical to the setup screen, but with a confirmation dialog warning about data reset (Tauri only, per CF-3).

| Platform | Change Behavior |
|----------|----------------|
| Browser | Clear auth session → re-validate → persist → redirect to sign-in |
| Tauri | Confirm dialog → wipe synced SQLite tables → clear auth → re-validate → persist → redirect to sign-in |

### 19f. Root route guard

Add a config check to the TanStack Router root layout. Before the existing auth guard runs, check `configStore.hasConfig()`. If false, redirect to `/setup`. This ensures no part of the app attempts to use a Supabase client before one can be constructed.

### Done when

- [ ] Config store reads and writes correctly (browser: localStorage, Tauri: SQLite)
- [ ] Supabase client initializes lazily from config store
- [ ] App with no env vars and no stored config shows setup screen on launch
- [ ] App with valid bundled defaults skips setup screen (smart default flow)
- [ ] Connection validator distinguishes: reachable + schema present, reachable + no schema, unreachable
- [ ] Setup screen validates and persists config, then proceeds to auth
- [ ] Settings page shows current backend URL
- [ ] Changing backend in browser mode: clears auth, re-validates, persists, redirects to sign-in
- [ ] Changing backend in Tauri mode: shows confirmation, wipes synced tables, clears auth, persists
- [ ] `app_config` table is never included in sync operations
- [ ] Existing workout logging flow works identically after refactor
- [ ] All existing tests pass (client initialization change is transparent to consumers)

---

## STEP 20: Docker & Self-Hosting

**Dependencies:** Step 3 (Supabase migrations exist), Step 19 (runtime config for mobile users connecting to self-hosted instances). Can be done in parallel with Steps 10-18.
**Priority:** P1
**Docs:** `03-prd-hosting.md` §Docker Composition

### What to build

Docker Compose configuration for one-command self-hosted deployment, plus self-hosting documentation.

### 20a. Docker Compose file

A `docker-compose.yml` at the repository root that provisions the full stack. Based on Supabase's official self-hosted Compose file with two additions: a migration init container and a web app container.

| Container | Source | Notes |
|-----------|--------|-------|
| Supabase stack | Official `supabase/docker` | Postgres, Kong, GoTrue, PostgREST, Realtime, Studio |
| Migration runner | `supabase/cli` | Runs `supabase db push` against local Postgres using `service_role` key, then exits |
| Web app | Multi-stage Dockerfile (Bun build → nginx) | Serves Vite production build, build-time env vars from Compose `.env` |
| Caddy | `caddy:alpine` | Reverse proxy, automatic TLS via Let's Encrypt |

### 20b. Environment configuration

Create `.env.example` with all required variables, default values where safe, and comments explaining each. Include a shell script (`scripts/generate-keys.sh`) that generates the JWT secret and derives the anon and service_role keys using the Supabase key generation algorithm.

### 20c. Web app Dockerfile

Multi-stage build:

| Stage | Base | Purpose |
|-------|------|---------|
| Build | `oven/bun:latest` | `bun install` + `bun run build` with env vars |
| Serve | `nginx:alpine` | Copy build output to nginx html dir, custom nginx.conf for SPA routing |

The nginx config handles SPA fallback (all routes → `index.html`) and sets appropriate cache headers (hashed assets: immutable, `index.html`: no-cache).

### 20d. Migration init container

A lightweight container that waits for Postgres to be healthy (via `pg_isready`), then applies all migrations from `supabase/migrations/`. Uses the `service_role` key from the Compose `.env`. Exits with code 0 on success, allowing dependent containers to start.

On subsequent runs, already-applied migrations are skipped (Supabase CLI tracks applied migrations in a `schema_migrations` table).

### 20e. Caddy configuration

A `Caddyfile` that routes traffic:

| Path | Target |
|------|--------|
| `/` and static assets | Web app container (nginx) |
| `/rest/v1/*`, `/auth/v1/*`, `/realtime/v1/*` | Kong (Supabase API gateway) |
| `/studio/*` (optional) | Supabase Studio |

Caddy handles TLS automatically via Let's Encrypt using the `SITE_URL` from `.env`.

### 20f. Self-hosting documentation

A `docs/self-hosting.md` file (or a section in the main README) covering both deployment paths.

**Docker path:** Prerequisites, clone, configure `.env`, generate keys, `docker compose up -d`, verify. Includes a troubleshooting section for common issues (port conflicts, DNS, TLS).

**Supabase Cloud path:** Prerequisites, create project, link, push schema, deploy web app, configure mobile app. Shorter since Supabase handles infrastructure.

Both paths end with: "To connect the Play Store app, open Settings → Backend and enter your instance URL and publishable key."

### 20g. Health check and monitoring

Add health check endpoints to the Docker containers so `docker compose ps` shows meaningful status. The web app container health check is a simple HTTP GET to `/`. The migration runner has no health check (it exits).

### Done when

- [ ] `docker compose up -d` starts all containers from a clean state
- [ ] Migration runner applies schema and exits cleanly
- [ ] Web app loads at `SITE_URL` with Iron & Ember design
- [ ] User can register, sign in, and log a workout via the web interface
- [ ] Play Store app connects to Docker-hosted instance after configuring URL in Settings
- [ ] Supabase Studio accessible at `SITE_URL/studio` (when enabled)
- [ ] `docker compose down && docker compose up -d` is idempotent (data persists, migrations don't re-run)
- [ ] `.env.example` documents all variables with comments
- [ ] `scripts/generate-keys.sh` produces valid JWT secret and derived keys
- [ ] Self-hosting docs cover both Docker and Supabase Cloud paths
- [ ] Caddy handles TLS automatically

---

## Timeline Mapping Additions

| Step | Priority | Est. Effort | Can Parallel With |
|------|----------|-------------|-------------------|
| 19. Runtime Backend Config | P0 | 2 days | Steps 10-18 |
| 20. Docker & Self-Hosting | P1 | 2 days | Steps 10-18 (after Step 19 for mobile config) |
| **Phase 5 subtotal** | | **~4 days** | |

**Updated total:** ~44 days (was ~40 days)

**Critical path to Play Store release:** All phases + Step 19 = minimum viable for distribution.

---

## Design Decisions Additions

| # | Decision | Rationale |
|---|----------|-----------|
| 17 | Runtime config over build-time config | Single APK works against any Supabase instance; self-hosters don't need to build from source |
| 18 | Config in localStorage / SQLite, not Supabase | Config must be readable before Supabase client exists; chicken-and-egg |
| 19 | Backend change wipes local SQLite | Cross-instance data in one SQLite database corrupts sync invariants |
| 20 | Docker uses Supabase official self-hosted stack | Maintained upstream, well-documented, matches the Supabase Cloud API surface |
| 21 | Migration runner as init container | `service_role` key stays inside Docker network; client app never has DDL permissions |
| 22 | Caddy over nginx for reverse proxy | Automatic TLS with zero config; simpler for self-hosters who aren't sysadmins |
| 23 | Multi-stage web app build | No Node/Bun runtime in production; smaller image; nginx is battle-tested for static serving |

---

## Supabase-Specific Considerations Addition

### Self-Hosted Supabase

Self-hosted Supabase uses the same API surface as Supabase Cloud. The Ardent Forge app does not distinguish between them — both are accessed via the same Supabase JS client with the same URL and publishable key pattern.

The main operational difference is that self-hosted Supabase uses a locally-derived JWT secret and key pair rather than Supabase Cloud's managed keys. The migration runner and key generation script handle this automatically.

### Key Generation

Supabase derives the `anon` (publishable) and `service_role` keys from a JWT secret. The `scripts/generate-keys.sh` helper generates a random JWT secret and produces both keys using the standard Supabase algorithm (HS256-signed JWTs with role claims). This matches what Supabase Cloud does internally when you create a project.
