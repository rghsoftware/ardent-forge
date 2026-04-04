# Onboarding Redesign — Refactoring Plans

**Context:** Steps 19 (Runtime Backend Configuration) and 20 (Docker & Self-Hosting) are complete. These refactoring plans modify the existing codebase to replace the raw Supabase fields setup screen with a tiered onboarding flow: instance URL with discovery (primary), QR code / deep link (parallel), raw Supabase fields (advanced fallback). Each plan is independently shippable but ordered by dependency.

**Docs:** `03-prd-hosting.md` (with onboarding additions applied)

---

## REFACTOR A: Discovery Client + Server URL Input

**Modifies:** Setup screen (`/setup` route), connection validator, Caddyfile
**Estimated effort:** 1 day
**Dependencies:** None — this plan touches only the setup screen and adds a new utility module

### What exists today

The setup screen at `/setup` has two underline inputs (Supabase URL, Publishable Key), a "CONNECT" button, inline status feedback, and a help link. The connection validator (`validateConnection`) takes a URL and publishable key, hits the REST API root, and queries a known table. The Caddyfile routes `/rest/v1/*`, `/auth/v1/*`, `/realtime/v1/*` to Kong and everything else to the web app nginx container.

### What changes

#### Aa. Discovery client module

Create `src/lib/discovery.ts`. A single async function that takes a server URL string and returns the Supabase URL and publishable key, or an error.

| Function | Signature | Behavior |
|----------|-----------|----------|
| `discoverInstance` | `(serverUrl: string) => Promise<DiscoveryResult>` | Normalizes input (prepend `https://` if no protocol, strip trailing slash), fetches `${normalized}/.well-known/ardent-forge.json`, validates response shape (must have `version`, `supabase_url`, `supabase_publishable_key`), returns extracted fields or a typed error |

Error types: `NETWORK_ERROR` (fetch failed), `NOT_FOUND` (404 or non-JSON response), `INVALID_RESPONSE` (JSON present but missing required fields).

The function is pure fetch — no config store interaction, no side effects. It can be unit tested with a mocked fetch.

#### Ab. Setup screen UI refactor

Modify the existing `/setup` route component. The current two-field form becomes the "Advanced" section, collapsed by default. A new primary section takes its place.

**Existing elements to keep:** Heading (change copy from "CONFIGURE BACKEND" to "CONNECT TO SERVER"), status feedback area, help link, overall Iron & Ember styling.

**New layout, top to bottom:**

| Element | Notes |
|---------|-------|
| Server URL field | Underline input, placeholder "Server address (e.g. forge.example.com)". Replaces the old Supabase URL field position. |
| "CONNECT" button | `forge` CTA. Calls `discoverInstance`, then pipes result into existing `validateConnection`. |
| Status area | Reuses existing inline feedback component. New states added for discovery phase ("Looking up server...", "Could not find server configuration at this address."). |
| QR scan button | Placeholder for Refactor B — render as disabled or hidden until that plan lands. |
| "OR" divider | `text-industrial` label with horizontal rules on `surface-charcoal`. |
| "Manual configuration" toggle | Tappable row with chevron. Expands to reveal the existing two-field form (Supabase URL + Publishable Key + secondary "CONNECT" button). |

**Server URL input behavior:** Accept bare domains (`forge.example.com`), full URLs (`https://forge.example.com`), and URLs with trailing slashes. All normalization happens in `discoverInstance`, not in the UI component.

**State machine change:** The existing setup screen has states: empty → validating → success/error. The refactored screen adds a discovery phase before validation: empty → discovering → discovered (auto-validates) → success/error, with a branch for discovery failure that suggests QR scan or manual entry.

The Advanced section's "CONNECT" button bypasses discovery entirely and calls `validateConnection` directly with the raw fields, exactly as the current screen works today.

#### Ac. Caddy discovery endpoint

Add a `handle` block to the existing Caddyfile that serves `/.well-known/ardent-forge.json` directly from Caddy using a `respond` directive. This block must appear before the catch-all route to the web app container.

The response body is a static JSON string with `{SITE_URL}` and `{ANON_KEY}` placeholder values interpolated from Caddy's environment variables (which already come from the Docker Compose `.env`). Caddy supports environment variable substitution in the Caddyfile natively via `{$ENV_VAR}` syntax.

Response headers: `Content-Type: application/json`, `Cache-Control: public, max-age=3600`.

**Existing Caddyfile routing to preserve:**

| Path | Target |
|------|--------|
| `/.well-known/ardent-forge.json` | **NEW** — Caddy responds directly |
| `/rest/v1/*`, `/auth/v1/*`, `/realtime/v1/*` | Kong (unchanged) |
| `/studio/*` | Supabase Studio (unchanged) |
| `/*` | Web app nginx (unchanged) |

#### Ad. Self-hosting docs update

Add a section to `docs/self-hosting.md` for Supabase Cloud + static host deployments explaining how to create the discovery file. For Vercel/Netlify/Cloudflare Pages, this is a static file at `public/.well-known/ardent-forge.json` with hardcoded values. For Docker deployments, note that it's handled automatically by Caddy.

### Done when

- [ ] `discoverInstance("forge.example.com")` returns Supabase URL + key from a valid discovery endpoint
- [ ] `discoverInstance` returns typed errors for network failure, 404, and malformed JSON
- [ ] Setup screen shows server URL field as primary input
- [ ] Entering a server address triggers discovery → validation pipeline
- [ ] Discovery failure shows error message suggesting QR scan or manual entry
- [ ] "Manual configuration" toggle reveals existing Supabase URL + key fields
- [ ] Manual entry bypasses discovery and works exactly as today
- [ ] Caddy serves `/.well-known/ardent-forge.json` with correct env var values
- [ ] `Cache-Control` header set on discovery endpoint response
- [ ] Self-hosting docs updated for static host discovery file
- [ ] Existing connection validator is unchanged — discovery pipes into it
- [ ] All existing setup/config tests still pass

---

## REFACTOR B: QR Code Generation + Scan on Setup

**Modifies:** Settings → Backend section, setup screen (`/setup` route)
**Estimated effort:** 1 day
**Dependencies:** None strict — can land before or after Refactor A. The setup screen QR scan button placeholder from A is activated here, but B can also land first (scan button just exists from the start).

### What exists today

Settings → Backend shows the current Supabase URL (truncated, with copy button) and a "CHANGE BACKEND" button. The setup screen has the input fields and validation flow.

### What changes

#### Ba. QR code dependency

Add `qrcode.react` to project dependencies via `bun add qrcode.react`. Lightweight, client-side-only, no external service calls.

#### Bb. QR generation in Settings

Add a new section to the existing Settings → Backend area, below the current URL display and change button.

**New elements:**

| Element | Design |
|---------|--------|
| Section heading | "SHARE THIS SERVER" in `text-industrial` |
| QR code | `QRCodeSVG` from `qrcode.react`, rendered on `surface-iron` card, centered. Value is `ardentforge://connect?url=${encodeURIComponent(config.supabaseUrl)}&key=${encodeURIComponent(config.publishableKey)}` read from config store. |
| Copy button | Secondary button: "COPY INVITE LINK" — copies the same `ardentforge://connect?...` string to clipboard. Show success toast on copy. |
| Explainer | `body-small` Inter, `text-muted`: "Share this with anyone who wants to connect to this server. They will still need to create an account." |

**Conditional rendering:** The section only renders if `configStore.hasConfig()` is true. On the Settings page this is guaranteed (you can't reach Settings without being configured and authenticated), but the guard makes the contract explicit.

#### Bc. QR scan / paste on setup screen

Add a QR input method to the setup screen alongside the server URL field.

**Tauri mode (Android/iOS/desktop):** Add an icon button (`qr_code_scanner` Material Symbol) to the right of the server URL field. Tapping it opens the device camera via a barcode scanning library. Tauri v2 does not have a built-in barcode scanner plugin, so use `@anthropic-tauri/plugin-barcode-scanner` or `tauri-plugin-barcode-scanner` if available, otherwise use a WebView-based scanner library like `html5-qrcode` that accesses the camera through standard browser APIs inside the Tauri WebView.

**Browser mode:** Replace the camera-based scan with a text input. The icon button opens a small inline field labeled "Paste invite link" that accepts an `ardentforge://connect?...` string. On paste/enter, parse the URL and extract `url` and `key` query parameters.

**Both modes on successful scan/paste:**

1. Parse the `ardentforge://connect` URL, extract `url` and `key` query params.
2. Pre-populate the Advanced section's Supabase URL and key fields (expand it if collapsed).
3. Auto-trigger validation using the existing `validateConnection`.
4. On success, persist to config store and navigate to auth — same as manual entry.

**Error handling:** If the scanned/pasted value is not a valid `ardentforge://connect` URL, show a toast: "Invalid invite link."

### Done when

- [ ] `qrcode.react` added to dependencies
- [ ] Settings → Backend shows "SHARE THIS SERVER" section with QR code
- [ ] QR code encodes correct `ardentforge://connect?url=...&key=...` from config store
- [ ] "COPY INVITE LINK" copies deep link to clipboard with success toast
- [ ] Explainer text renders in `body-small` / `text-muted`
- [ ] Setup screen has QR scan button (Tauri: camera, browser: paste field)
- [ ] Scanning/pasting a valid invite link pre-populates and auto-validates
- [ ] Invalid QR/link content shows error toast
- [ ] Section is hidden if config store is empty (defensive guard)

---

## REFACTOR C: Deep Link Handler for `ardentforge://connect`

**Modifies:** Deep link event listener (Tauri), TanStack Router (browser fallback)
**Estimated effort:** 0.5 days
**Dependencies:** Refactor B (QR generation must exist to produce links worth handling, though the handler itself is independent)

### What exists today

The `ardentforge://` custom URL scheme is registered via the Tauri deep-link plugin for Supabase auth redirects (OAuth callback flow). The app already has a listener for incoming deep links that routes auth callbacks. In browser mode, TanStack Router handles all routing.

### What changes

#### Ca. Tauri deep link listener extension

Modify the existing deep link event listener to check the incoming URL path. The current listener handles auth callbacks. Add a branch: if the URL path is `/connect` (or the URL starts with `ardentforge://connect`), extract `url` and `key` query parameters and dispatch to the onboarding handler instead of the auth handler.

| Incoming URL pattern | Handler |
|----------------------|---------|
| `ardentforge://connect?url=...&key=...` | **NEW** — onboarding handler (Ca) |
| `ardentforge://...` (all other paths) | Existing auth redirect handler (unchanged) |

**Onboarding handler logic:**

1. Parse `url` and `key` from query params. If either is missing or malformed, show toast "Invalid invite link" and return.
2. Check `configStore.hasConfig()`:
   - **Not configured:** Navigate to `/setup`. Pass parsed `url` and `key` as route search params (or via Zustand transient state). The setup screen detects these, pre-populates the Advanced fields, and auto-triggers validation.
   - **Configured, same instance:** Compare parsed `url` with `configStore.getConfig().supabaseUrl`. If match, show toast "Already connected to this server." Return.
   - **Configured, different instance:** Navigate to Settings → Backend. Pre-populate the change form with the parsed values. The existing backend change flow runs (including Tauri data wipe confirmation per CF-3).

#### Cb. Browser route for deep link fallback

Add a TanStack Router route at `/connect` that handles the browser-mode equivalent. This route reads `url` and `key` from the URL search params, then runs the same logic as the Tauri handler: redirect to `/setup` with pre-populated values if unconfigured, or trigger the backend change flow if already configured.

This route is primarily useful for development and testing. In production, browser users are more likely to use the setup screen's paste field (Refactor B) than to receive an `ardentforge://connect` URL that the browser can handle. But it completes the contract: the deep link format works everywhere.

#### Cc. Setup screen: accept pre-populated values

Modify the `/setup` route to check for incoming `url` and `key` values (via search params or transient store). If present:

1. Expand the Advanced section.
2. Pre-populate the Supabase URL and key fields.
3. Auto-trigger validation.
4. Show status feedback as normal.

This is a small change to the existing setup component — add a `useEffect` or `onMount` that checks for pre-populated values and triggers the validation pipeline.

### Done when

- [ ] Tapping `ardentforge://connect?url=...&key=...` on a device with the app installed opens the app
- [ ] Unconfigured app navigates to `/setup` with pre-populated and auto-validating fields
- [ ] Already-configured app with same instance shows "Already connected" toast
- [ ] Already-configured app with different instance triggers backend change flow
- [ ] Malformed deep link shows "Invalid invite link" toast
- [ ] Existing auth redirect deep links continue to work (no regression)
- [ ] Browser route `/connect?url=...&key=...` mirrors Tauri behavior
- [ ] Data wipe confirmation dialog appears for Tauri backend changes (existing behavior preserved)

---

## Dependency & Ordering Summary

```
REFACTOR A: Discovery + Server URL Input        (1 day)
    ├── Modifies: /setup route, Caddyfile
    ├── Adds: src/lib/discovery.ts
    └── No dependencies

REFACTOR B: QR Generation + Scan                (1 day)  
    ├── Modifies: Settings → Backend, /setup route
    ├── Adds: qrcode.react dependency
    └── No strict dependencies (can parallel with A)

REFACTOR C: Deep Link Handler                   (0.5 day)
    ├── Modifies: deep link listener, TanStack Router
    ├── Adds: /connect route
    └── Soft dependency on B (needs links to exist)
```

Refactors A and B can be done in parallel. Refactor C should land last since it depends on having both the setup screen changes (A) and QR-generated links (B) in place to be testable end-to-end. Total effort is approximately 2.5 days.

All three refactors leave the existing connection validator, config store, lazy Supabase client initialization, and root route guard completely untouched. The backend change flow (including Tauri data wipe confirmation) is reused as-is. No Supabase schema changes, no Rust changes, no sync engine changes.
