# Feature 009: Discovery Client + Server URL Input

## Status: Draft
## Created: 2026-04-04

---

## Overview

Replace the setup screen's raw Supabase credential inputs with a primary "Server URL" flow that auto-discovers backend credentials via a `.well-known/ardent-forge.json` endpoint. The existing manual credential entry becomes a collapsed "Advanced" fallback. This is the first step toward a tiered onboarding experience (server URL > QR code > manual entry).

## Problem Statement

New users connecting to a self-hosted Ardent Forge instance must currently know and enter two technical Supabase values (project URL and anon key). This creates unnecessary friction -- the instance administrator already configured these values during deployment. A single server address should be sufficient; the app can discover the rest automatically.

## User Stories

1. **As a new user**, I want to enter just my server address so that I can connect without asking my admin for Supabase credentials.
2. **As a self-hosting admin**, I want my Caddy deployment to automatically serve discovery metadata so that users only need the server URL.
3. **As a Supabase Cloud user**, I want to still enter raw credentials via a manual option so that I can connect without a discovery endpoint.
4. **As a static-host deployer** (Vercel/Netlify/Cloudflare Pages), I want docs explaining how to create a discovery file so that my users get the simple server-URL experience.

## Requirements

### Must Have

- **M1**: `discoverInstance(serverUrl)` function that fetches `/.well-known/ardent-forge.json`, validates shape (`version`, `supabase_url`, `supabase_publishable_key`), and returns credentials or a typed error
- **M2**: Discovery error types: `NETWORK_ERROR` (fetch failed), `NOT_FOUND` (404 or non-JSON), `INVALID_RESPONSE` (JSON present, missing required fields)
- **M3**: Setup screen primary input is a single "Server address" field with a "Connect" button
- **M4**: Server URL input accepts bare domains (`forge.example.com`), full URLs (`https://forge.example.com`), and URLs with trailing slashes -- normalization happens in `discoverInstance`
- **M5**: Successful discovery auto-pipes into existing `validateConnection` -- no changes to the validator
- **M6**: Discovery failure shows inline error suggesting manual configuration
- **M7**: "Manual configuration" collapsible section exposes existing Supabase URL + key inputs with its own "Connect" button that bypasses discovery
- **M8**: Manual entry works identically to today's setup screen
- **M9**: Caddy serves `/.well-known/ardent-forge.json` with `{$SITE_URL}` and `{$ANON_KEY}` interpolation, `Content-Type: application/json`, `Cache-Control: public, max-age=3600`
- **M10**: `ANON_KEY` env var added to caddy service in `docker-compose.yml`

### Should Have

- **S1**: Discovery phase status feedback ("Looking up server...", "Could not find server configuration at this address.")
- **S2**: QR scan button placeholder (disabled/hidden) for future Refactor B activation
- **S3**: "Or" divider between primary and advanced sections, styled with `text-industrial` and `surface-charcoal` horizontal rules
- **S4**: Self-hosting docs updated with instructions for creating a static discovery file on Vercel/Netlify/Cloudflare Pages

### Won't Have (this refactor)

- QR code scanning or generation (Refactor B)
- Deep link handling for `ardentforge://connect` (Refactor C)
- Storing the server URL in the config store (only Supabase credentials are persisted)
- Changes to `validateConnection`, config store, Supabase client initialization, or root route guard

## Testable Assertions

| ID | Assertion |
|----|-----------|
| TA-1 | `discoverInstance("forge.example.com")` prepends `https://`, fetches `https://forge.example.com/.well-known/ardent-forge.json`, and returns `{ supabaseUrl, supabaseKey }` from a valid response |
| TA-2 | `discoverInstance("https://forge.example.com/")` strips trailing slash before fetching |
| TA-3 | `discoverInstance` returns `{ error: 'NETWORK_ERROR' }` when fetch throws |
| TA-4 | `discoverInstance` returns `{ error: 'NOT_FOUND' }` on 404 or non-JSON response |
| TA-5 | `discoverInstance` returns `{ error: 'INVALID_RESPONSE' }` when JSON lacks required fields |
| TA-6 | Setup screen renders server URL field as primary input on mount |
| TA-7 | Entering a server address and tapping "Connect" triggers `discoverInstance` then `validateConnection` |
| TA-8 | Discovery failure displays inline error and does not call `validateConnection` |
| TA-9 | "Manual configuration" toggle expands to show Supabase URL + key fields |
| TA-10 | Manual "Connect" calls `validateConnection` directly, bypassing discovery |
| TA-11 | Successful validation (either path) saves config and navigates to `/sign-in` |
| TA-12 | `GET /.well-known/ardent-forge.json` on Docker deployment returns valid JSON with correct `supabase_url` and `supabase_publishable_key` values |
| TA-13 | Response includes `Content-Type: application/json` and `Cache-Control: public, max-age=3600` headers |
| TA-14 | All existing `connection-validator.test.ts` and `config-store.test.ts` tests pass without modification |

## Open Questions

1. ~~Should the discovery response include additional fields (e.g., instance name, branding)?~~ Not for now -- `version`, `supabase_url`, `supabase_publishable_key` is the minimum viable schema. Additional fields can be added later without breaking clients.

## Dependencies

- **Upstream**: None -- this is the first refactor in the onboarding redesign sequence
- **Downstream**: Refactor B (QR scan button placeholder activated), Refactor C (deep link handling uses the same discovery result shape)
- **External**: None -- no new third-party dependencies
