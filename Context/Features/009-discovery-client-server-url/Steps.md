# Feature 009: Discovery Client + Server URL Input -- Implementation Steps

## Status: Complete
## Created: 2026-04-04

---

## Team Composition

| Role | Agent | Stacks |
|------|-------|--------|
| Frontend Specialist | `frontend-specialist` | React, TypeScript, Tailwind |
| Infrastructure Specialist | `infra-specialist` | Docker, Caddy, docker-compose |
| Quality Engineer | `quality-engineer` | Vitest, validation |

---

## Wave 1: Discovery Client Module (parallel)

### S001: Create `src/lib/discovery.ts`

**Agent**: `frontend-specialist`
**Parallel**: Yes (independent of S002)
**Files**:
- CREATE `src/lib/discovery.ts`

**Instructions**:

Create the discovery client module. Reference the existing `src/lib/connection-validator.ts` for conventions (AbortController timeout pattern, error typing style).

Types:
```typescript
type DiscoveryError = 'NETWORK_ERROR' | 'NOT_FOUND' | 'INVALID_RESPONSE'

type DiscoveryResult =
  | { ok: true; supabaseUrl: string; supabaseKey: string }
  | { ok: false; error: DiscoveryError; message: string }
```

Function `discoverInstance(serverUrl: string): Promise<DiscoveryResult>`:
1. Normalize input: if no protocol (`://` absent), prepend `https://`. Strip trailing slashes.
2. Construct discovery URL: `${normalized}/.well-known/ardent-forge.json`
3. Fetch with 8-second AbortController timeout
4. On fetch error (network, timeout): return `NETWORK_ERROR`
5. On non-2xx status or response not parseable as JSON: return `NOT_FOUND`
6. Parse JSON. Validate presence and string type of `version`, `supabase_url`, `supabase_publishable_key`. On failure: return `INVALID_RESPONSE`
7. Return `{ ok: true, supabaseUrl: json.supabase_url, supabaseKey: json.supabase_publishable_key }`

Export `DiscoveryResult`, `DiscoveryError`, and `discoverInstance`.

**Acceptance**:
- [TA-1] Bare domain gets `https://` prepended and correct URL constructed
- [TA-2] Trailing slash stripped before fetch
- [TA-3] Fetch failure returns `NETWORK_ERROR`
- [TA-4] 404/non-JSON returns `NOT_FOUND`
- [TA-5] Missing fields returns `INVALID_RESPONSE`

---

### S001-T: Unit tests for discovery client

**Agent**: `frontend-specialist`
**Parallel**: No (blocked by S001)
**Files**:
- CREATE `src/lib/__tests__/discovery.test.ts`

**Instructions**:

Write Vitest tests for `discoverInstance`. Mock global `fetch` (use `vi.stubGlobal`). Follow the patterns in `src/lib/__tests__/connection-validator.test.ts`.

Test cases:
1. Happy path: valid JSON response returns `{ ok: true, supabaseUrl, supabaseKey }`
2. Bare domain normalization: `forge.example.com` fetches `https://forge.example.com/.well-known/ardent-forge.json`
3. Full URL with trailing slash: `https://forge.example.com/` strips slash before appending path
4. URL with `http://` protocol: preserved as-is (not forced to `https://`)
5. Network error: fetch throws TypeError, returns `NETWORK_ERROR`
6. Timeout: fetch throws AbortError/DOMException, returns `NETWORK_ERROR`
7. 404 response: returns `NOT_FOUND`
8. Non-JSON response (200 but HTML): returns `NOT_FOUND`
9. JSON missing `version` field: returns `INVALID_RESPONSE`
10. JSON missing `supabase_url` field: returns `INVALID_RESPONSE`
11. JSON with all fields present but `supabase_url` is a number (not string): returns `INVALID_RESPONSE`

**Acceptance**:
- All 11 test cases pass
- No real network calls

---

### S002: Caddy discovery endpoint + docker-compose env

**Agent**: `infra-specialist`
**Parallel**: Yes (independent of S001)
**Files**:
- MODIFY `docker/caddy/Caddyfile`
- MODIFY `docker-compose.yml`

**Instructions**:

**Caddyfile**: Add a `handle` block for `/.well-known/ardent-forge.json` BEFORE the catch-all `handle` block (but after the API and Studio routes -- ordering among specific `handle` blocks does not matter, only that the catch-all is last).

```caddyfile
handle /.well-known/ardent-forge.json {
    header Content-Type application/json
    header Cache-Control "public, max-age=3600"
    respond `{"version":"1","supabase_url":"{$SITE_URL}","supabase_publishable_key":"{$ANON_KEY}"}`
}
```

Note: Use backtick quoting for the respond body to avoid escaping issues with curly braces in Caddy. The `{$SITE_URL}` and `{$ANON_KEY}` are Caddy env var placeholders, not JSON template syntax.

**docker-compose.yml**: Add `ANON_KEY: ${ANON_KEY}` to the `caddy` service's `environment` block, alongside the existing `SITE_URL: ${SITE_URL}`.

**Acceptance**:
- [TA-12] `GET /.well-known/ardent-forge.json` returns valid JSON with interpolated values
- [TA-13] Response has correct `Content-Type` and `Cache-Control` headers
- Existing routes (API, Studio, web catch-all) still work

---

## Milestone 1: Discovery infrastructure complete

**Gate**: S001, S001-T, S002 all complete. The discovery function can be called programmatically and the Caddy endpoint serves the expected JSON. No UI changes yet.

**Contracts**:
- `discoverInstance(serverUrl: string): Promise<DiscoveryResult>` is exported from `src/lib/discovery.ts`
- `DiscoveryResult` discriminated union is exported for consumers

---

## Wave 2: Setup screen refactor

### S003: Refactor setup screen UI

**Agent**: `frontend-specialist`
**Parallel**: No (depends on S001)
**Blocked by**: S001
**Files**:
- MODIFY `src/routes/setup.tsx`

**Instructions**:

Refactor the setup screen. Read the current file carefully before modifying. Preserve all existing behavior for the manual entry path.

**New state additions** (local useState, alongside existing `url`/`key`/`status`/`message`):
- `serverUrl: string` -- the server address input value
- `discoveryStatus: 'idle' | 'discovering' | 'discovery-failed'` -- tracks discovery phase
- `discoveryMessage: string` -- error message from discovery
- `advancedOpen: boolean` -- whether manual config section is expanded

**New handler `handleDiscoverAndConnect`**:
1. If `serverUrl` is empty, set discoveryStatus to `'discovery-failed'` with message "Server address is required." and return
2. Set `discoveryStatus` to `'discovering'`
3. Call `discoverInstance(serverUrl)`
4. If `ok: false`: set `discoveryStatus` to `'discovery-failed'`, set `discoveryMessage` to result message plus a suggestion to try manual configuration. Return.
5. If `ok: true`: set `url` and `key` from result, then call existing `handleConnect()` (which handles validation, persistence, and navigation)

**Layout (top to bottom inside AuthPageShell)**:

1. Heading: change "Configure Backend" to "Connect to Server" (keep same styling: `text-sm text-warm-ash`)

2. Env-var warning banner: keep as-is

3. **Primary section -- Server URL**:
   - Label "Server address" using `FORGE_LABEL_CLASS`
   - `ForgeInput` with placeholder "forge.example.com", value bound to `serverUrl`
   - QR scan icon button: render a small disabled button with `QrCode` icon (from lucide-react) to the right of the input, `opacity-30 cursor-not-allowed`. This is a placeholder for Refactor B.
   - "Connect" button: `bg-forge text-on-forge`, calls `handleDiscoverAndConnect`, disabled while `discoveryStatus === 'discovering'` or `status === 'validating'`
   - Discovery status feedback:
     - `discovering`: pulsing "Looking up server..." in `text-warm-ash` (same pattern as existing "Connecting...")
     - `discovery-failed`: error message in `text-warning-flare`
   - Validation status feedback: reuse existing status rendering block (shown after discovery succeeds and validation runs)

4. **"Or" divider**:
   - Horizontal flex with two `border-t border-surface-charcoal flex-1` lines and a centered `text-xs text-industrial px-3` span containing "or"

5. **Manual configuration toggle**:
   - A `button` styled as a row: "Manual configuration" text in `text-sm text-warm-ash` with a chevron icon (ChevronDown/ChevronUp from lucide-react) that toggles `advancedOpen`
   - When expanded, renders the existing two-field form (Supabase URL + Publishable Key inputs + their own "Connect" button calling `handleConnect` directly)
   - The existing fields' state (`url`, `key`) is shared -- if discovery populates them, they appear pre-filled in the manual section too

6. Help link: keep as-is at bottom

**Env var auto-validation**: Keep the existing `useEffect` that auto-triggers `handleConnect` when env vars are present. This bypasses discovery entirely (env vars provide raw credentials). No change needed.

**Acceptance**:
- [TA-6] Server URL field is primary input on mount
- [TA-7] Entering address and tapping Connect triggers discovery then validation
- [TA-8] Discovery failure shows inline error, does not call validateConnection
- [TA-9] Manual configuration toggle expands to show Supabase URL + key fields
- [TA-10] Manual Connect calls validateConnection directly
- [TA-11] Successful validation saves config and navigates to /sign-in
- [TA-14] Existing connection-validator and config-store tests still pass

---

### S003-T: Validate existing tests still pass

**Agent**: `quality-engineer`
**Parallel**: No (blocked by S003)
**Blocked by**: S003
**Files**: (read-only inspection)

**Instructions**:

Run the full test suite (`bun run test`). Verify:
1. All tests in `src/lib/__tests__/connection-validator.test.ts` pass without modification
2. All tests in `src/lib/__tests__/config-store.test.ts` pass without modification
3. All tests in `src/lib/__tests__/discovery.test.ts` pass
4. No other test failures introduced
5. Run `bun run lint` and confirm no new lint errors
6. Run `bun run build` and confirm TypeScript compilation succeeds

Report pass/fail for each check. Do not modify any files.

**Acceptance**:
- [TA-14] All existing tests pass
- Build and lint clean

---

## Milestone 2: Feature complete (UI + infrastructure)

**Gate**: S003 and S003-T complete. The setup screen has the new server URL flow, manual fallback works identically to before, and all tests pass.

---

## Wave 3: Documentation

### S004: Update self-hosting docs

**Agent**: `frontend-specialist`
**Parallel**: No (depends on S003 for final understanding of the flow)
**Blocked by**: S003
**Files**:
- MODIFY `docs/self-hosting.md`

**Instructions**:

Add a "Discovery Endpoint" subsection. Place it under the existing "Path 2: Supabase Cloud + Static Hosting" section, after step 6.

Content to add:

**For static host deployments** (Vercel/Netlify/Cloudflare Pages):
- Create `public/.well-known/ardent-forge.json` in the project root with:
```json
{
  "version": "1",
  "supabase_url": "https://<your-project-ref>.supabase.co",
  "supabase_publishable_key": "<your-anon-key>"
}
```
- Explain that this enables users to connect with just the site URL instead of entering Supabase credentials manually

**For Docker deployments**:
- Note that the discovery endpoint is served automatically by Caddy -- no manual setup required

Also update the "Mobile App Configuration" section to mention that users can now enter just the server address (the app discovers credentials automatically), with manual entry still available via "Manual configuration".

**Acceptance**:
- [S4] Self-hosting docs updated with discovery file instructions for static hosts
- Docker auto-configuration noted
- Mobile app section updated

---

### S004-D: Final documentation review

**Agent**: `quality-engineer`
**Parallel**: No (blocked by S004)
**Blocked by**: S004
**Files**: (read-only)

**Instructions**:

Review the updated `docs/self-hosting.md` for:
1. Accuracy of the discovery file JSON format (matches what Caddy serves and what `discoverInstance` expects)
2. Correct file path for static hosts (`public/.well-known/ardent-forge.json`)
3. No broken links or formatting issues
4. Consistency with existing doc style and tone

Report any issues found. Do not modify files.

**Acceptance**:
- Documentation is accurate and consistent

---

## Milestone 3: Feature shipped

**Gate**: All steps complete. Discovery client, Caddy endpoint, setup screen refactor, tests, and documentation are all done.

---

## Execution Summary

| Wave | Steps | Parallel? | Agents |
|------|-------|-----------|--------|
| 1 | S001, S001-T, S002 | S001 and S002 parallel; S001-T after S001 | frontend-specialist, infra-specialist |
| 2 | S003, S003-T | Sequential | frontend-specialist, quality-engineer |
| 3 | S004, S004-D | Sequential | frontend-specialist, quality-engineer |

**Total steps**: 6 (3 implementation, 1 test suite, 2 documentation)
**Total files touched**: 5 modified + 2 created
- CREATE: `src/lib/discovery.ts`, `src/lib/__tests__/discovery.test.ts`
- MODIFY: `src/routes/setup.tsx`, `docker/caddy/Caddyfile`, `docker-compose.yml`, `docs/self-hosting.md`

**Dependency chain**:
```
S001 ──────┐
S001-T ◄───┘──┐
              ├── S003 ── S003-T
S002 ─────────┘
                  S004 ── S004-D (after S003)
```
