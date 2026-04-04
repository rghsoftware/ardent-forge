# Feature 010: QR Code Generation + Scan on Setup

## Phase 3 -- Implementation Steps

### Team Composition

| Role                | Agent      | Stacks                                       |
| ------------------- | ---------- | -------------------------------------------- |
| Frontend Specialist | `frontend` | React, TypeScript, Tailwind, TanStack Router |
| Tauri Specialist    | `tauri`    | Rust, Tauri plugins, capabilities, Cargo     |
| Quality Engineer    | `qa`       | Testing, validation, regression              |

### Dependency Graph

```
S001 (deps)  ──┐
S002 (invite) ─┤──► M1: Milestone -- Foundation
               │
S003 (tauri) ──┘
               │
S004 (settings QR) ─────► M2: Milestone -- QR Generation
               │
S005 (setup scan/paste) ─► M3: Milestone -- QR Consumption
               │
S006 (tests) ─────────────► M4: Milestone -- Validation
```

---

### Wave 1: Foundation (parallel)

#### S001: Install frontend dependencies

**Agent:** `frontend`
**Files:** `package.json`
**Depends on:** nothing
**Parallel:** yes (with S002, S003)

1. Run `bun add qrcode.react`
2. Verify `qrcode.react` appears in `package.json` dependencies
3. Run `bun install` to confirm clean lockfile

**Done:** `qrcode.react` in dependencies, no lockfile errors.

---

#### S002: Create invite link utility

**Agent:** `frontend`
**Files:** `src/lib/invite-link.ts` (NEW)
**Depends on:** nothing
**Parallel:** yes (with S001, S003)

1. Create `src/lib/invite-link.ts` with two exported functions:

```typescript
export function buildInviteLink(supabaseUrl: string, publishableKey: string): string
```

- Returns `ardentforge://connect?url=${encodeURIComponent(supabaseUrl)}&key=${encodeURIComponent(publishableKey)}`

```typescript
export function parseInviteLink(raw: string): { url: string; key: string } | null
```

- Parse input as URL. If scheme is not `ardentforge:` or path/host is not `connect`, return `null`.
- Extract `url` and `key` query params. If either is missing or empty after decoding, return `null`.
- Return `{ url, key }`.
- Handle edge cases: extra whitespace (trim), missing protocol, garbage input (try/catch URL constructor).

2. No side effects, no imports beyond standard `URL` API.

**Done:** Both functions exported, pure logic, no dependencies on app state.

**Assertions:** TA-5

---

#### S003: Register barcode scanner Tauri plugin

**Agent:** `tauri`
**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/mobile.json`, `package.json`
**Depends on:** nothing
**Parallel:** yes (with S001, S002)

1. Run `bun tauri add barcode-scanner` -- this handles:
   - Adding `tauri-plugin-barcode-scanner` to `src-tauri/Cargo.toml`
   - Adding `@tauri-apps/plugin-barcode-scanner` to `package.json`
   - Registering the plugin in `src-tauri/src/lib.rs` (`.plugin(tauri_plugin_barcode_scanner::init())`)

2. Verify `src-tauri/src/lib.rs` has the plugin registered in the builder chain alongside existing plugins (log, notification, deep_link, opener).

3. Add `"barcode-scanner:default"` to the permissions array in `src-tauri/capabilities/mobile.json`. This grants: `allow-scan`, `allow-cancel`, `allow-check-permissions`, `allow-request-permissions`, `allow-open-app-settings`, `allow-vibrate`.

4. Verify the Rust project compiles: `cd src-tauri && cargo check`

**Done:** Plugin registered, permissions granted, Rust compiles.

**Assertions:** TA-4 (partial -- plugin available)

---

### >> M1: Foundation Milestone

**Gate:** S001 + S002 + S003 all complete.
**Verify:** `bun install` clean, `invite-link.ts` exists with both exports, `cargo check` passes.
**Assertions covered:** TA-5 (invite link parsing)

---

### Wave 2: QR Generation in Settings

#### S004: Add "Share this server" section to backend settings

**Agent:** `frontend`
**Files:** `src/components/profile/backend-settings.tsx`
**Depends on:** S001 (qrcode.react installed), S002 (buildInviteLink available)
**Parallel:** no

1. Import `QRCodeSVG` from `qrcode.react` and `buildInviteLink` from `src/lib/invite-link.ts`.

2. Add a new section below the existing backend URL display and "Change backend" button area. Structure:
   - Section heading: "Share this server" -- use existing section heading pattern: `font-sans text-xs font-medium uppercase tracking-widest text-warm-ash`
   - QR code card: `bg-surface-iron p-6` container, centered. Render `QRCodeSVG` with:
     - `value={buildInviteLink(config.supabaseUrl, config.supabaseKey)}`
     - `size={256}`
     - `level="M"`
     - `marginSize={4}`
     - `fgColor="#e5e2e1"` (bone-white)
     - `bgColor="#201f1f"` (surface-iron)
     - `title="Scan to connect to this Ardent Forge server"`
   - "Copy invite link" button: secondary style button below the QR code. On click:
     - `navigator.clipboard.writeText(buildInviteLink(config.supabaseUrl, config.supabaseKey))`
     - Show `toast('Invite link copied')` via sonner
   - Explainer text: `text-sm text-warm-ash/70` -- "Share this with anyone who wants to connect to this server. They will still need to create an account."

3. Guard the entire section with `configStore.hasConfig()` (should always be true on Settings page, but makes the contract explicit).

4. Read the existing `backend-settings.tsx` patterns for state access, styling classes, and toast usage. Match exactly.

**Done:** QR code and copy button visible in Settings when configured.

**Assertions:** TA-1, TA-2, TA-3, S1, S2

---

### >> M2: QR Generation Milestone

**Gate:** S004 complete.
**Verify:** Settings page shows QR code with correct encoded value. Copy button works. Section hidden when config empty.
**Assertions covered:** TA-1, TA-2, TA-3

---

### Wave 3: QR Consumption on Setup Screen

#### S005: Activate QR scan/paste on setup screen

**Agent:** `frontend`
**Files:** `src/routes/setup.tsx`
**Depends on:** S002 (parseInviteLink), S003 (barcode scanner plugin registered)
**Parallel:** no

1. Read `src/routes/setup.tsx` thoroughly. Note the existing disabled QR button at ~line 188-195 and the manual configuration (Advanced) section state.

2. **Replace the disabled QR button** with platform-branched behavior:

   **Tauri branch (`isTauri()` is true -- Android):**
   - QR icon button becomes active (remove `disabled`, `opacity-30`, `cursor-not-allowed`).
   - On tap, execute the camera permission + scan flow:

     ```typescript
     import {
       scan,
       cancel,
       checkPermissions,
       requestPermissions,
       openAppSettings,
       Format,
     } from '@tauri-apps/plugin-barcode-scanner'

     async function handleScan() {
       let perms = await checkPermissions()
       if (perms === 'prompt') perms = await requestPermissions()
       if (perms === 'denied') {
         toast('Camera permission required')
         await openAppSettings()
         return
       }
       const result = await scan({ windowed: true, formats: [Format.QRCode] })
       await cancel()
       processInviteLink(result.content)
     }
     ```

   - Before calling `scan()`, set a `scanning` state that applies a transparent/overlay CSS class to the setup page so the native camera feed shows through.
   - After `cancel()`, remove the overlay.

   **Browser branch (`!isTauri()`):**
   - QR icon button toggles a paste input field inline.
   - `ForgeInput` with placeholder "Paste invite link", matching existing underline input styling.
   - On Enter keypress or paste event, extract the value and call `processInviteLink(value)`.

3. **Shared `processInviteLink(raw: string)` function** (local to setup.tsx):
   - Call `parseInviteLink(raw)` from `src/lib/invite-link.ts`.
   - If `null`, show `toast('Invalid invite link')` and return.
   - If valid:
     - Set `showAdvanced` to `true` (expand the Advanced section).
     - Pre-populate the `advancedUrl` and `advancedKey` state fields with parsed values.
     - Auto-trigger validation by calling the existing `handleAdvancedConnect()` function (or equivalent manual validation path).

4. **Scanning overlay component** (Tauri only):
   - When `scanning` state is true, render a full-screen overlay with:
     - `bg-black/80` background (semi-transparent dark).
     - Centered viewfinder cutout (transparent rectangle, ~280x280px, with `border-2 border-ember` outline).
     - "Cancel" button at bottom that calls `cancel()` and clears the `scanning` state.
   - The actual camera feed renders natively underneath the transparent WebView.

5. Keep all existing setup screen behavior (server URL discovery, manual config, env var auto-detect) completely unchanged.

**Done:** QR scan works on Android, paste works in browser, both feed into validation.

**Assertions:** TA-4, TA-6, TA-7

---

### >> M3: QR Consumption Milestone

**Gate:** S005 complete.
**Verify:** Scan button active on Tauri, paste field on browser, both parse and auto-validate. Invalid input shows toast. Existing flows unaffected.
**Assertions covered:** TA-4, TA-5, TA-6, TA-7

---

### Wave 4: Validation

#### S006: Tests and regression

**Agent:** `qa`
**Files:** `src/lib/__tests__/invite-link.test.ts` (NEW), existing test suite
**Depends on:** S004, S005
**Parallel:** no

1. **Unit tests for `invite-link.ts`:**
   - `buildInviteLink` produces correct URL format with encoded params
   - `parseInviteLink` round-trips with `buildInviteLink` output
   - `parseInviteLink` returns `null` for: empty string, random text, wrong scheme (`https://connect?...`), missing `url` param, missing `key` param, malformed URL
   - `parseInviteLink` handles: extra whitespace, trailing newlines

2. **Run existing test suite:** `bun run test` -- all existing tests pass (regression check).

3. **Run linter:** `bun run lint` -- no new lint errors.

4. **Run type check:** `bun run build` (includes `tsc` check) -- no type errors.

**Done:** All tests pass, no regressions, no lint/type errors.

**Assertions:** TA-5, TA-8

---

#### S006-T1: Component tests for processInviteLink valid/invalid flows

**Agent:** `qa`
**Files:** `src/routes/__tests__/setup.test.tsx` (NEW)
**Depends on:** S005, S006
**Parallel:** no

1. Create component test file for the setup page QR/paste flow:
   - Test that a valid invite link populates url/key fields, expands Advanced section, triggers validation
   - Test that an invalid invite link shows "Invalid invite link" toast and leaves fields unchanged
   - Mock `validateConnection`, `getConfigStore`, and `parseInviteLink` as needed

**Done:** Component tests verify processInviteLink valid/invalid paths.

**Assertions:** TA-6, TA-7

---

#### S006-T2: Component tests for "Share this server" conditional rendering and copy button

**Agent:** `qa`
**Files:** `src/components/profile/__tests__/backend-settings.test.tsx` (NEW)
**Depends on:** S004, S006
**Parallel:** yes (with S006-T1)

1. Create component test file for backend settings QR section:
   - Test that QR section is absent when config is null and present when configured (TA-3)
   - Test that copy button writes correct invite link to clipboard and shows toast (TA-2)
   - Mock `getConfigStore` and `navigator.clipboard`

**Done:** Component tests verify conditional rendering and copy behavior.

**Assertions:** TA-2, TA-3

---

### >> M4: Validation Milestone (Final)

**Gate:** S006 complete.
**Verify:** All unit tests pass, existing suite green, lint clean, types clean.
**Assertions covered:** All (TA-1 through TA-8)

---

### Execution Summary

| Wave | Steps            | Agent(s)                  | Parallel    |
| ---- | ---------------- | ------------------------- | ----------- |
| 1    | S001, S002, S003 | frontend, frontend, tauri | yes (all 3) |
| 2    | S004             | frontend                  | no          |
| 3    | S005             | frontend                  | no          |
| 4    | S006             | qa                        | no          |

**Total steps:** 6
**Critical path:** S002 -> S004 -> S005 -> S006
**Estimated execution:** All waves sequential after Wave 1 parallel foundation.

### Recommended Execution

```
/impl 010
```

Tasks are isolated by domain (frontend owns most work, tauri handles plugin registration, qa validates). No cross-domain coordination needed -- `/impl` over `/team-impl`.
