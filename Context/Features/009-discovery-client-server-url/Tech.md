# Feature 009: Discovery Client + Server URL Input -- Technical Plan

## Status: Draft
## Created: 2026-04-04

---

## Architecture Overview

This feature adds an instance discovery layer between the user-facing setup screen and the existing connection validator. The discovery client is a pure async function that resolves a human-friendly server URL into Supabase credentials by fetching a well-known JSON file. The server side is a static Caddy `respond` directive -- no new containers, no runtime services.

```
User enters "forge.example.com"
  |
  v
discoverInstance()          <-- NEW: src/lib/discovery.ts
  |  fetch /.well-known/ardent-forge.json
  |  normalize URL, validate response shape
  v
validateConnection()        <-- EXISTING: src/lib/connection-validator.ts (unchanged)
  |  Step 1: reachability
  |  Step 2: schema check
  v
configStore.setConfig()     <-- EXISTING: src/lib/config-store.ts (unchanged)
  |
  v
Navigate to /sign-in
```

The setup screen gains a new primary section (server URL) and collapses the existing credential inputs into an "Advanced" toggle. The state machine extends from `idle -> validating -> ok/error` to `idle -> discovering -> validating -> ok/error`, with a branch on discovery failure.

---

## Key Decisions

### KD-1: Discovery endpoint path and format

**Decision**: `/.well-known/ardent-forge.json` with fields `version`, `supabase_url`, `supabase_publishable_key`.

**Rationale**: The `/.well-known/` prefix follows [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615), the standard for site-wide metadata. A JSON file with explicit field names is self-documenting and forward-compatible (new optional fields can be added without breaking existing clients). The `version` field enables schema evolution.

**Alternatives considered**:
- `/api/discover` -- custom route, requires server-side logic. Rejected: unnecessary complexity for static metadata.
- DNS TXT records -- standard for email/domain verification but requires DNS access, which many self-hosters lack. Rejected.
- `/.well-known/host-meta` -- XML-based, heavyweight. Rejected.

### KD-2: Discovery client as a pure function (no side effects)

**Decision**: `discoverInstance` takes a string, returns credentials or error. No config store writes, no navigation, no client creation.

**Rationale**: Keeps the function trivially testable (mock fetch, assert result) and composable. The setup screen orchestrates the pipeline: discover -> validate -> persist -> navigate. This also means the discovery client can be reused by future flows (deep links, QR scan fallback) without coupling.

### KD-3: URL normalization in the discovery client, not the UI

**Decision**: `discoverInstance` handles `https://` prepending and trailing slash stripping internally.

**Rationale**: The UI should accept whatever the user types. Normalization is a concern of the network layer. If multiple entry points call `discoverInstance` in the future (deep links, QR), they all benefit from the same normalization.

### KD-4: Caddy `respond` directive (not reverse proxy or static file)

**Decision**: Caddy responds directly with inline JSON using `{$SITE_URL}` and `{$ANON_KEY}` env var interpolation.

**Rationale**: No additional container or file volume needed. Caddy's native `{$ENV_VAR}` syntax handles interpolation at startup. A `respond` directive is the simplest mechanism for a single static JSON response with dynamic values.

**Alternative considered**: Mounting a static file from the host and templating it at `docker compose up` time. Rejected: adds a volume mount and a templating step to the startup flow.

### KD-5: Setup screen state machine extension (not replacement)

**Decision**: Add `discovering` and `discovery-failed` states to the existing `ConnectionUiStatus`-like local state. The existing states (`idle`, `validating`, `ok`, `unreachable`, `no-schema`) are preserved exactly.

**Rationale**: The manual entry path must work identically to today. The advanced section's "Connect" button skips discovery entirely. Extending the state machine (rather than replacing it) means existing behavior is untouched and tests pass without modification.

---

## Stack-Specific Details

### Frontend (src/)

**New file**: `src/lib/discovery.ts`
- Exports `discoverInstance(serverUrl: string): Promise<DiscoveryResult>`
- `DiscoveryResult` is a discriminated union: `{ ok: true; supabaseUrl: string; supabaseKey: string }` or `{ ok: false; error: 'NETWORK_ERROR' | 'NOT_FOUND' | 'INVALID_RESPONSE'; message: string }`
- Uses native `fetch` with an 8-second `AbortController` timeout (matching the convention in `connection-validator.ts`)
- Response validation: checks HTTP status, `Content-Type` includes `application/json`, parses JSON, validates presence of `version` (string), `supabase_url` (string), `supabase_publishable_key` (string)

**New file**: `src/lib/__tests__/discovery.test.ts`
- Unit tests with mocked `fetch` (no real network)
- Test cases for each error type plus happy path, URL normalization variants

**Modified file**: `src/routes/setup.tsx`
- New local state: `discoveryStatus` (`'idle' | 'discovering' | 'discovered' | 'discovery-failed'`)
- The existing `status`/`message` state is reused for the validation phase
- New `handleDiscoverAndConnect` function: calls `discoverInstance`, on success pipes into `handleConnect` (existing), on failure sets discovery error state
- New UI sections: server URL input (primary), "Or" divider, "Manual configuration" collapsible
- The existing two-field form moves inside the collapsible section with its own "Connect" button wired to `handleConnect` directly
- Env var auto-validation logic preserved: if `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUB_KEY` are set, auto-trigger manual validation on mount (skips discovery, since env vars provide raw credentials)
- QR scan button placeholder: a disabled icon button rendered but non-functional

### Docker (docker/)

**Modified file**: `docker/caddy/Caddyfile`
- Add `handle /.well-known/ardent-forge.json` block before the catch-all
- Uses Caddy's `respond` directive with inline JSON body
- Sets `Content-Type` and `Cache-Control` headers via `header` directive

**Modified file**: `docker-compose.yml`
- Add `ANON_KEY: ${ANON_KEY}` to the caddy service's `environment` block

### Docs

**Modified file**: `docs/self-hosting.md`
- Add a "Discovery Endpoint" subsection under "Path 2: Supabase Cloud + Static Hosting"
- Explains creating `public/.well-known/ardent-forge.json` as a static file with hardcoded values
- Notes that Docker deployments handle this automatically via Caddy

---

## Integration Points

| From | To | Contract |
|------|----|----------|
| `discoverInstance` | `/.well-known/ardent-forge.json` | HTTP GET, expects `{ version, supabase_url, supabase_publishable_key }` |
| Setup screen | `discoverInstance` | Passes user input string, receives `DiscoveryResult` |
| Setup screen | `validateConnection` | Unchanged -- passes `(url, key)` from either discovery or manual input |
| Setup screen | `configStore.setConfig` | Unchanged -- passes `{ supabaseUrl, supabaseKey }` |
| Caddy | Environment | Reads `{$SITE_URL}` (existing) and `{$ANON_KEY}` (new) |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CORS blocks discovery fetch from a different origin | Medium | Discovery fails silently | Caddy serves the discovery endpoint from the same origin as the app. For Supabase Cloud + static host deployments, the static file is on the same origin. Cross-origin discovery is not a supported use case in v1. |
| User enters a URL that redirects (e.g., HTTP -> HTTPS redirect) | Low | `fetch` follows redirects by default; should work. | Test with redirect scenarios. If an issue arises, document that the URL must be the final address. |
| Caddy env var `{$ANON_KEY}` is empty or unset | Low | Discovery endpoint returns invalid JSON with empty string | `generate-keys.sh` always sets `ANON_KEY`. Add a note in self-hosting docs that all keys must be generated before first start. |
| Future discovery schema changes break old clients | Low | Old app versions fail on new required fields | `version` field enables forward-compatible evolution. New fields should be optional. |

---

## Pre-existing Issue Noted

The Dockerfile sets `VITE_SUPABASE_PUBLISHABLE_KEY` but the app code reads `VITE_SUPABASE_PUB_KEY`. This means env-var-based auto-configuration in Docker builds is broken. This is out of scope for Refactor A but should be tracked separately (the setup screen's manual entry flow works regardless).

---

## ADR Reference

- **ADR-006**: Discovery Endpoint Format and Discovery Client Design (created alongside this Tech.md)
