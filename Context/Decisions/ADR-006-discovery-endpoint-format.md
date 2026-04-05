# ADR-006: Discovery Endpoint Format and Discovery Client Design

## Status: Proposed
## Date: 2026-04-04
## Feature: 009-discovery-client-server-url

---

## Context

Ardent Forge's setup screen requires users to enter a Supabase project URL and anon key to connect to a self-hosted instance. This creates onboarding friction because these values are already configured by the instance administrator. We want users to enter just a server address and have the app discover the backend credentials automatically.

## Decision

### Endpoint

Serve instance metadata at `/.well-known/ardent-forge.json` following [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) conventions. The response is static JSON:

```json
{
  "version": "1",
  "supabase_url": "https://forge.example.com",
  "supabase_publishable_key": "eyJ..."
}
```

All three fields are required. The `version` field enables future schema evolution without breaking existing clients.

### Serving mechanism

For Docker deployments, Caddy serves the endpoint directly via its `respond` directive with `{$SITE_URL}` and `{$ANON_KEY}` environment variable interpolation. No additional containers or file volumes.

For static host deployments (Vercel, Netlify, Cloudflare Pages), the deployer creates `public/.well-known/ardent-forge.json` as a static file with hardcoded values.

### Client design

A single pure async function `discoverInstance(serverUrl: string)` in `src/lib/discovery.ts`:
- Normalizes input (prepend `https://` if no protocol, strip trailing slash)
- Fetches the well-known endpoint
- Validates the response shape
- Returns credentials or a typed error (`NETWORK_ERROR`, `NOT_FOUND`, `INVALID_RESPONSE`)
- No side effects -- the caller orchestrates config persistence and navigation

## Alternatives Considered

| Alternative | Why rejected |
|-------------|-------------|
| Custom `/api/discover` route | Requires server-side logic; unnecessary for static metadata |
| DNS TXT records | Requires DNS access many self-hosters lack |
| `/.well-known/host-meta` (XML) | Heavyweight format for simple key-value data |
| Caddy reverse proxy to static file volume | Adds a volume mount and templating step to startup |

## Consequences

- Users can connect with just a server address for Docker-hosted instances (zero-config discovery)
- Static host deployers need one extra step (create the discovery file), documented in self-hosting guide
- The `version` field allows adding optional fields (instance name, branding, feature flags) in future without breaking v1 clients
- Cross-origin discovery is not supported in v1 (the discovery endpoint must be on the same origin as the app)
