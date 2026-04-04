# PRD: Runtime Configuration & Self-Hosting

## Overview

This document defines requirements for Ardent Forge's runtime backend configuration and self-hosting support. The app is MIT-licensed and publicly available on GitHub. There is no hosted service for the general public — the expectation is that anyone outside the maintainer's circle either self-hosts or receives an invite. A single Play Store APK must work against any Supabase instance without rebuilding.

---

## Goals

### Primary Goals (P0)

| Goal | Success Criteria |
|------|------------------|
| Runtime backend configuration | Users can point the app at any Supabase instance from Settings |
| Smart defaults | The maintainer's Supabase instance is bundled as the default; friends install and it just works |
| Graceful fallback | If bundled defaults fail on first launch, the app surfaces a tiered setup screen: server address (primary), QR scan (parallel), advanced manual entry (expandable) |
| QR code onboarding | Any authenticated user can generate a QR code or shareable link that pre-configures another device to connect to the same instance |
| Docker turnkey deployment | A single `docker compose up` provisions the full stack for self-hosters |

### Secondary Goals (P1)

| Goal | Success Criteria |
|------|------------------|
| Schema detection | App detects a misconfigured or empty database and directs the user to documentation |
| Connection validation | Config changes are validated before being saved |
| Self-hosting documentation | README section and setup guide sufficient for a competent developer to deploy in under an hour |
| Instance discovery endpoint | Self-hosted deployments serve `/.well-known/ardent-forge.json` so users can connect by entering a single URL instead of two Supabase fields |

### Non-Goals (Explicitly Out of Scope)

| Feature | Why Excluded |
|---------|-------------|
| Multi-tenant SaaS hosting | Not a product Ardent Forge will offer |
| In-app migration runner | Publishable key lacks DDL permissions; migrations are a deployment concern |
| Admin dashboard for instance operators | Out of scope — Supabase Dashboard serves this purpose |
| White-labeling or theming per instance | One design system, one app |
| Automatic Supabase project provisioning | Self-hosters bring their own Supabase |
| Email invites (Resend, SMTP-based) | Requires server-side component and API key management; disproportionate complexity for ~10 user deployments. P2 future enhancement. |

---

## Deployment Modes

Three deployment scenarios exist. The app must support all three with a single codebase and a single Play Store binary.

```mermaid
flowchart TB
    subgraph MaintainerHosted["Mode 1: Maintainer-Hosted"]
        M1["Maintainer runs Supabase Cloud"]
        M2["Invited users install from Play Store"]
        M3["Bundled defaults point to maintainer's instance"]
        M4["Users sign up via standard auth flow"]
    end

    subgraph SelfHostDocker["Mode 2: Self-Host (Docker)"]
        D1["Self-hoster clones repo"]
        D2["Runs docker compose up"]
        D3["Supabase + web app + reverse proxy start"]
        D4["Migrations run automatically via init container"]
        D5["Users configure app to point at self-hosted URL"]
    end

    subgraph SelfHostCloud["Mode 3: Self-Host (Supabase Cloud)"]
        C1["Self-hoster creates own Supabase project"]
        C2["Runs supabase db push from repo"]
        C3["Distributes URL + publishable key to their users"]
        C4["Users configure app to point at new project"]
    end
```

### Mode Details

| Mode | Supabase | Web App | Migrations | User Setup |
|------|----------|---------|------------|------------|
| Maintainer-hosted | Supabase Cloud (maintainer's project) | Deployed by maintainer | Already applied | Install APK → sign up (defaults just work) |
| Self-host Docker | Supabase self-hosted (Docker) | nginx container serving static build | Init container runs on `compose up` | Configure backend URL in Settings |
| Self-host Cloud | Supabase Cloud (self-hoster's project) | Self-hoster deploys or uses APK | `supabase link` + `supabase db push` | Configure backend URL in Settings |

---

## Runtime Configuration

### Configuration Fields

| Field | Type | Required | Default | Example |
|-------|------|----------|---------|---------|
| Supabase URL | URL | Yes | Bundled from build env | `https://xyzcompany.supabase.co` |
| Supabase Publishable Key | String | Yes | Bundled from build env | `sb_publishable_abc123...` |

These are the only two fields needed. Everything else — auth, RLS, schema — is determined by the Supabase instance the app connects to.

### Instance Discovery

Self-hosted deployments expose a discovery endpoint that allows the app to resolve a single server URL into the two Supabase configuration fields. This removes the need for end users to understand or handle Supabase-specific values.

#### Discovery Endpoint

| Attribute | Value |
|-----------|-------|
| Path | `/.well-known/ardent-forge.json` |
| Method | GET |
| Auth | None (publicly accessible) |
| Content-Type | `application/json` |

#### Response Schema

```json
{
  "version": 1,
  "supabase_url": "https://xyzcompany.supabase.co",
  "supabase_publishable_key": "sb_publishable_abc123..."
}
```

The `version` field is an integer that allows the schema to evolve without breaking older clients. Version 1 contains exactly the two fields the app already requires. Future versions may add optional metadata (instance name, branding, feature flags) but must remain backward-compatible: a v1 client ignores unknown fields and extracts the two it needs.

#### Who Serves It

| Deployment Mode | How the Endpoint Is Served |
|-----------------|---------------------------|
| Docker (Caddy) | Caddy responds directly with the JSON payload. Values are interpolated from the same `.env` file that configures the rest of the stack. No additional container required. |
| Supabase Cloud + static host | The self-hoster adds a static `/.well-known/ardent-forge.json` file to their web app deployment (Vercel, Netlify, etc.) containing their Supabase project URL and publishable key. |
| Supabase Cloud, no web app | Not available. Users connecting via APK-only must use QR code, shareable link, or manual entry. |

#### Discovery Flow

```mermaid
sequenceDiagram
    participant UI as Setup Screen
    participant App as Discovery Client
    participant Server as Instance Server

    UI->>App: User enters "https://forge.example.com"
    App->>Server: GET https://forge.example.com/.well-known/ardent-forge.json
    
    alt Discovery succeeds
        Server-->>App: 200 OK + JSON payload
        App->>App: Extract supabase_url + supabase_publishable_key
        App->>App: Run existing connection validator (19c)
        
        alt Connection valid + schema present
            App-->>UI: Success — proceed to auth
        else Connection valid + no schema
            App-->>UI: "Connected, but database schema not found."
        else Connection fails
            App-->>UI: "Server found, but database is unreachable."
        end
    else Discovery fails (404, network error)
        App-->>UI: "Could not find server configuration at this address."
        UI->>UI: Suggest QR scan or manual entry
    end
```

---

### QR Code and Deep Link Onboarding

Any authenticated user can generate a QR code or shareable deep link that allows another device to connect to the same Ardent Forge instance. This is the primary onboarding path for the friends-and-family use case.

#### Deep Link Format

The `ardentforge://` custom URL scheme is already registered as part of Supabase auth redirect handling. The onboarding flow adds a new path under the existing scheme:

```
ardentforge://connect?url={encoded_supabase_url}&key={encoded_publishable_key}
```

| Parameter | Encoding | Example |
|-----------|----------|---------|
| `url` | URI-encoded Supabase URL | `https%3A%2F%2Fxyzcompany.supabase.co` |
| `key` | URI-encoded publishable key | `sb_publishable_abc123...` |

The publishable key is not secret — it is designed to be embedded in client-side code and is safe to encode in QR codes and shareable links.

#### Deep Link Handling

When the app receives an `ardentforge://connect` deep link, behavior depends on the app's current configuration state.

```mermaid
flowchart TB
    Receive["Receive ardentforge://connect"] --> Parse["Parse url + key params"]
    Parse --> Valid{"Params present<br/>and well-formed?"}
    
    Valid -->|No| Ignore["Ignore link,<br/>show error toast"]
    Valid -->|Yes| HasConfig{"App already<br/>configured?"}
    
    HasConfig -->|No| AutoSetup["Pre-populate setup screen<br/>with parsed values,<br/>auto-validate"]
    HasConfig -->|Yes| SameInstance{"Same instance<br/>as current?"}
    
    SameInstance -->|Yes| NoOp["Toast: 'Already connected<br/>to this server'"]
    SameInstance -->|No| ChangeFlow["Trigger backend change flow<br/>(with data wipe confirmation<br/>for Tauri, per CF-3)"]
```

#### QR Code Generation

Accessible from Settings → Backend → "SHARE INSTANCE" button. Available to any authenticated user — no role or admin gate.

The QR code encodes the `ardentforge://connect` deep link using the connection details from the current device's config store. The same screen also shows a "COPY LINK" button for sharing via text or group chat.

| Element | Design |
|---------|--------|
| Section heading | "SHARE THIS SERVER" in `text-industrial` |
| QR code | Rendered client-side from config store values. Centered on `surface-iron` card. |
| Copy link button | Secondary button below QR: "COPY INVITE LINK" |
| Explainer text | `body-small` Inter: "Anyone with this link can connect to this server. They will still need to create an account or sign in." |

#### QR Code Library

The QR code is rendered client-side using a lightweight library (e.g., `qrcode.react` or `react-qr-code`). No server-side generation, no API call, no external service. The payload is constructed from values already in the local config store.

---

### Configuration Lifecycle

On first launch, the app resolves its backend configuration through a tiered process. The tiers are ordered by user-friendliness: the app tries the easiest path first and only falls through to more technical options if earlier tiers fail.

```mermaid
flowchart TB
    Launch["App Launch"]
    
    Launch --> CheckConfig{"Config exists<br/>in local store?"}
    
    CheckConfig -->|Yes| UseStored["Use stored config"]
    CheckConfig -->|No| CheckEnv{"Build-time env vars<br/>available?"}
    
    CheckEnv -->|Yes| TryDefaults["Attempt connection<br/>with bundled defaults"]
    CheckEnv -->|No| ShowSetup["Show setup screen"]
    
    TryDefaults --> DefaultsWork{"Connection<br/>successful?"}
    
    DefaultsWork -->|Yes| PersistDefaults["Persist defaults<br/>to local store"]
    DefaultsWork -->|No| ShowSetup
    
    PersistDefaults --> AuthFlow["Proceed to auth"]
    UseStored --> AuthFlow
    
    ShowSetup --> Tiered["Tiered setup screen"]
    
    Tiered --> T1["Tier 1: Server address<br/>(discovery endpoint)"]
    Tiered --> T2["Tier 2: Scan QR code<br/>(deep link)"]
    Tiered --> T3["Tier 3: Advanced<br/>(raw Supabase fields)"]
    
    T1 --> Validate["Validate connection"]
    T2 --> Validate
    T3 --> Validate
    
    Validate --> Valid{"Valid?"}
    Valid -->|Yes| PersistCustom["Persist to<br/>local store"]
    Valid -->|No| ShowError["Show error +<br/>retry"]
    
    ShowError --> Tiered
    PersistCustom --> AuthFlow
```

### Configuration Persistence

The config store follows the same adapter pattern as the data layer. Config must be readable before the Supabase client is initialized, so it cannot live in Supabase itself.

| Platform | Storage Location | Mechanism |
|----------|-----------------|-----------|
| Browser | `localStorage` | `ardentforge:config` key, JSON string |
| Tauri (all platforms) | SQLite `app_config` table | Read via Tauri command before adapter initialization |

The `app_config` table in SQLite is a simple key-value store outside the sync boundary. It is never synced to Supabase — it is local-only, device-specific configuration.

### Configuration Validation

Before persisting a new configuration, the app validates the connection by performing a lightweight health check against the target Supabase instance.

```mermaid
sequenceDiagram
    participant UI as Settings Screen
    participant Config as Config Store
    participant Supa as Target Supabase

    UI->>Config: User submits URL + key
    Config->>Supa: GET /rest/v1/ with apikey header
    
    alt Connection succeeds
        Supa-->>Config: 200 OK
        Config->>Supa: SELECT 1 FROM exercises LIMIT 1
        alt Schema present
            Supa-->>Config: Row or empty set
            Config->>Config: Persist config
            Config-->>UI: Success — restart required
        else Schema missing
            Supa-->>Config: 404 / relation does not exist
            Config-->>UI: "Connected, but database schema not found.<br/>See setup guide."
        end
    else Connection fails
        Supa-->>Config: Error / timeout
        Config-->>UI: "Cannot reach server.<br/>Check URL and key."
    end
```

### Backend Change Behavior

Changing the backend configuration is a destructive operation in Tauri mode. Local SQLite data belongs to the previous Supabase instance and must not be mixed with data from a different instance.

| Platform | On Backend Change |
|----------|-------------------|
| Browser | Clear auth session. No local data to worry about — all data lives in Supabase. |
| Tauri | Clear auth session. Warn user that local data will be reset. On confirmation: drop and recreate all SQLite tables. Sync engine restarts clean against new instance. |

The confirmation dialog must be explicit: "Changing the backend will sign you out and delete all locally cached data. Your data on the previous server is not affected. Continue?"

### Supabase Client Initialization

The Supabase client currently initializes eagerly at module load from environment variables. With runtime configuration, initialization becomes lazy.

The client factory reads from the config store on first access. If no config exists, it returns null — the app detects this and routes to the setup screen. After configuration is set, the client is constructed and cached. On config change, the cached client is discarded and reconstructed.

The data adapter's existing switching logic (`isTauri()`) is unaffected. The change is upstream: where the Supabase URL and key come from. Both the Supabase adapter (browser mode) and the sync engine (Tauri mode) consume the same config store.

---

## Docker Composition

### Architecture

```mermaid
flowchart TB
    subgraph DockerCompose["docker-compose.yml"]
        subgraph SupabaseStack["Supabase Self-Hosted"]
            Kong["Kong<br/>API Gateway"]
            GoTrue["GoTrue<br/>Auth"]
            PostgREST["PostgREST<br/>REST API"]
            Realtime["Realtime<br/>WebSocket"]
            Postgres["PostgreSQL"]
            Studio["Supabase Studio<br/>Admin Dashboard"]
        end
        
        subgraph ArdentForge["Ardent Forge"]
            Migrations["Migration Runner<br/>(init container)"]
            WebApp["Web App<br/>(nginx serving static build)"]
        end
        
        subgraph Proxy["Reverse Proxy"]
            Caddy["Caddy<br/>TLS + routing"]
        end
    end
    
    Caddy --> Kong
    Caddy --> WebApp
    Migrations --> Postgres
    Kong --> GoTrue
    Kong --> PostgREST
    Kong --> Realtime
    PostgREST --> Postgres
    GoTrue --> Postgres
    Realtime --> Postgres
```

### Container Responsibilities

| Container | Base Image | Purpose | Lifecycle |
|-----------|-----------|---------|-----------|
| Postgres | `supabase/postgres` | Database | Persistent (named volume) |
| Kong | `kong` | API gateway for Supabase services | Long-running |
| GoTrue | `supabase/gotrue` | Authentication | Long-running |
| PostgREST | `postgrest/postgrest` | REST API over Postgres | Long-running |
| Realtime | `supabase/realtime` | WebSocket subscriptions | Long-running |
| Studio | `supabase/studio` | Admin dashboard (optional) | Long-running |
| Migration Runner | `supabase/cli` | Applies schema migrations | Init container — runs once, then exits |
| Web App | `nginx:alpine` | Serves the Vite production build | Long-running |
| Caddy | `caddy:alpine` | Reverse proxy with automatic TLS | Long-running |

### Environment Configuration

The Docker Compose file uses a single `.env` file for all configuration. Self-hosters copy `.env.example`, fill in their values, and run `docker compose up`.

| Variable | Purpose | Example |
|----------|---------|---------|
| `SITE_URL` | Public URL for the deployment | `https://forge.example.com` |
| `POSTGRES_PASSWORD` | Database password | (generated) |
| `JWT_SECRET` | Supabase JWT signing secret | (generated) |
| `ANON_KEY` | Supabase publishable key (auto-derived from JWT secret) | (generated) |
| `SERVICE_ROLE_KEY` | Supabase service key (used only by migration runner) | (generated) |

The `.env.example` file includes a helper script or instructions for generating the JWT secret and derived keys.

### Migration Runner

The migration runner is a one-shot init container that applies all SQL migrations from the `supabase/migrations/` directory in the repo. It runs before the web app container starts (via `depends_on` with health checks).

The runner uses the `service_role` key, which has full DDL permissions. This key never leaves the Docker network — it is not exposed to any client-facing container.

On subsequent `docker compose up` invocations, the runner detects already-applied migrations and exits cleanly (idempotent).

### Web App Container

The web app container is a multi-stage build. The first stage runs `bun install && bun run build` to produce the Vite static output. The second stage copies the build output into an nginx container that serves it. No Node.js runtime in production.

For Docker self-hosters, the build-time environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are set from the Compose `.env` file. This means the web app served by Docker has the correct defaults baked in — users of that instance's web interface never need to manually configure anything.

Play Store users connecting to a Docker self-hosted instance configure the URL and key in Settings.

---

## Self-Hosting Documentation

The repository README includes a self-hosting section with two paths.

### Path 1: Docker (Recommended)

Prerequisites: Docker, Docker Compose, a domain name (for TLS). Steps: clone repo, copy `.env.example` to `.env`, generate secrets, run `docker compose up -d`. The guide includes a verification checklist: Studio accessible, web app loads, registration works.

### Path 2: Supabase Cloud + Custom Web Deployment

Prerequisites: a Supabase account, a static hosting provider (Vercel, Netlify, Cloudflare Pages), Supabase CLI installed. Steps: create Supabase project, clone repo, `supabase link --project-ref <ref>`, `supabase db push`, deploy web app with environment variables set. The guide includes the same verification checklist.

### Mobile App Configuration

Both deployment paths end with users connecting the Play Store app to their instance. Three onboarding methods are available, in order of preference:

| Method | User Experience | When to Use |
|--------|----------------|-------------|
| QR code scan | Instance operator shows QR from their app; new user scans it | In-person onboarding, group meetups |
| Shareable link | Operator sends `ardentforge://connect?...` via text or group chat; recipient taps it | Remote onboarding, group chats |
| Server address | User enters the instance URL (e.g., `https://forge.example.com`); app resolves config via discovery endpoint | User knows the server address but has no QR or link |
| Manual entry | User opens Advanced section and enters raw Supabase URL + publishable key | Supabase Cloud self-hosters without a web deployment, debugging |

---

## Resolved Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| H-1 | Where does runtime config live? | `localStorage` (browser), `app_config` SQLite table (Tauri) | Must be readable before Supabase client init; cannot live in Supabase |
| H-2 | What happens on backend change in Tauri? | Sign out + wipe local SQLite | Mixing data from two instances corrupts sync; local data is a cache |
| H-3 | Can the app auto-run migrations? | No — publishable key lacks DDL permissions | Migration is a deployment concern; Docker init container or CLI handles it |
| H-4 | How does Docker handle migrations? | Init container with `service_role` key | Runs once on first `compose up`, idempotent on restarts |
| H-5 | First-launch behavior for unconfigured users? | Try bundled defaults → show setup screen on failure | Maintainer's friends see zero config; self-hosters get a clear prompt |
| H-6 | Does the web app container need Node.js? | No — multi-stage build, nginx serves static files | Smaller image, better performance, no runtime dependencies |
| H-7 | How do users connect to an instance? | Tiered: server URL with discovery (primary), QR/deep link (parallel), raw Supabase fields (advanced) | Non-technical users should never see infrastructure terminology; power users retain full control |
| H-8 | Where does discovery metadata live? | `/.well-known/ardent-forge.json` served by Caddy (Docker) or static hosting (Cloud) | Standard well-known URI convention; no additional containers; values derived from existing env vars |
| H-9 | Custom URL scheme or HTTPS App Links? | Custom scheme (`ardentforge://connect`) | Scheme is already registered for Supabase auth redirects; avoids dependency on a central domain for all instances; web fallback not needed since QR flow assumes app is installed |
| H-10 | Who can generate QR codes? | Any authenticated user | Publishable key is not secret; adding an admin role for this single feature would be disproportionate |
| H-11 | Email invites? | Deferred to P2 | Requires server-side component (Edge Function or additional container), API key, email template; QR + shareable link covers the friends-and-family use case |
