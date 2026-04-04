# Feature 010: QR Code Generation + Scan on Setup

## Phase 2 -- Technical Design

### Architecture Overview

This feature adds two independent UI surfaces connected by a shared data format:

1. **QR Generation (Settings)** -- New section in `backend-settings.tsx` that renders a QR code and copy button encoding the current backend config as an `ardentforge://connect` URL.
2. **QR Consumption (Setup)** -- Activates the existing disabled QR button in `setup.tsx` with platform-branched input (native camera scan on Android via Tauri, paste field on web browser).

A shared **invite link utility** (`src/lib/invite-link.ts`) handles URL construction and parsing, used by both surfaces and reusable by Refactor C (deep link handler).

### Key Decisions

#### D1: QR Code Library -- `qrcode.react`

**Choice:** `QRCodeSVG` from `qrcode.react`

**Why:** Lightweight, client-side-only, zero external service calls, ships TypeScript types, and renders as inline SVG (no canvas or image export needed). The SVG output integrates cleanly with the Iron & Ember design system since we can control bg/fg colors via props.

**Config:**

- `size={256}` -- At the expected payload (~175 chars), the QR matrix is ~37x37 modules. At 256px, each module is ~6.9px, well above the ~2-3px minimum for reliable mobile camera scanning.
- `level="M"` -- 15% error correction. Standard for mobile scanning; balances density vs. recoverability.
- `marginSize={4}` -- QR spec-required quiet zone for scanner reliability.
- `fgColor="#e5e2e1"` (bone-white) / `bgColor="#201f1f"` (surface-iron) -- Inverted from traditional black-on-white to match Iron & Ember. Sufficient contrast ratio (~10:1) for scanner readability.

#### D2: Platform Detection -- `isTauri()` (existing)

**Choice:** Use the existing `isTauri()` check from `@tauri-apps/api/core`. No new dependency needed.

**Why:** There is no desktop Tauri build -- the app runs as either mobile Tauri (Android) or web browser. `isTauri() === true` means Android, `isTauri() === false` means browser. This is the same pattern used throughout the codebase (config store, auth, sync bridge, etc.).

**Implementation:**

```typescript
import { isTauri } from '@tauri-apps/api/core'

// Tauri = Android (native camera scan)
// Browser = paste field fallback
{isTauri() ? <QrScanButton /> : <PasteInviteField />}
```

#### D3: Barcode Scanner -- `@tauri-apps/plugin-barcode-scanner`

**Choice:** Native scanner via `@tauri-apps/plugin-barcode-scanner` with `windowed: true`.

**Why:** The plugin accesses the camera natively, bypassing WebView camera APIs entirely. The `windowed` mode makes the WebView transparent and renders the camera feed underneath -- the app renders a dark overlay with a viewfinder cutout.

**Permission flow:**

1. On scan button tap, call `checkPermissions()`.
2. If `'prompt'`, call `requestPermissions()`.
3. If `'denied'`, show toast with "Camera permission required" and call `openAppSettings()`.
4. If `'granted'`, proceed to `scan({ windowed: true, formats: [Format.QRCode] })`.
5. On result, call `cancel()` to dismiss camera, then process `result.content`.

**Setup:** `bun tauri add barcode-scanner` handles Rust crate + JS bindings. Add `barcode-scanner:default` to `src-tauri/capabilities/mobile.json`.

#### D4: Invite Link Format

**Format:** `ardentforge://connect?url={encodedSupabaseUrl}&key={encodedPublishableKey}`

**Why:** Uses the existing `ardentforge://` custom URL scheme already registered for deep links. The `/connect` path distinguishes it from the existing `/auth` path used for OAuth callbacks. Query params are URI-encoded.

**Shared utility (`src/lib/invite-link.ts`):**

```typescript
export function buildInviteLink(supabaseUrl: string, publishableKey: string): string
export function parseInviteLink(raw: string): { url: string; key: string } | null
```

`parseInviteLink` returns `null` for any string that isn't a valid `ardentforge://connect` URL with both params present. This function is reused by:

- Settings copy button (build)
- Setup scan/paste handler (parse)
- Refactor C deep link handler (parse) -- future

#### D5: Browser Fallback -- Paste Field

**Choice:** Inline text input toggled by the QR icon button, not a modal or dialog.

**Why:** Consistent with the setup screen's existing underline input pattern. No camera APIs needed in the browser. The user pastes an `ardentforge://connect?...` string, and on Enter/blur the app parses and auto-validates.

**UX flow:**

1. Tap QR icon button (same position as mobile scan button).
2. A `ForgeInput` appears inline with placeholder "Paste invite link".
3. On paste or Enter, run `parseInviteLink()`.
4. Valid: expand Advanced section, pre-populate fields, auto-trigger validation.
5. Invalid: toast "Invalid invite link", clear the input.

### Files Modified

| File                                          | Change                                                          |
| --------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/invite-link.ts`                      | **NEW** -- `buildInviteLink()`, `parseInviteLink()`             |
| `src/components/profile/backend-settings.tsx` | Add "Share this server" section with QR code + copy button      |
| `src/routes/setup.tsx`                        | Activate QR scan button; add platform-branched scan/paste logic |
| `src-tauri/src/lib.rs`                        | Register `tauri_plugin_barcode_scanner`                         |
| `src-tauri/Cargo.toml`                        | Add `tauri-plugin-barcode-scanner` dependency                   |
| `src-tauri/capabilities/mobile.json`          | Add `barcode-scanner:default` permission                        |
| `package.json`                                | Add `qrcode.react`, `@tauri-apps/plugin-barcode-scanner`        |

### Integration Points

- **Config store** (`src/lib/config-store.ts`): QR generation reads `getConfig()`. Setup scan/paste calls `setConfig()` + `initSupabaseFromConfig()` via existing `validateAndSave` flow.
- **Connection validator** (`src/lib/connection-validator.ts`): Unchanged. Scan/paste results feed into existing `validateConnection()`.
- **Toast system** (`sonner`): Used for copy success, invalid link errors, and camera permission denial.
- **Discovery flow** (`src/lib/discovery.ts`): Unchanged. QR/paste is an alternative input path that bypasses discovery entirely (goes straight to manual validation).

### Risks and Mitigations

| Risk                                                                                 | Severity | Mitigation                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inverted QR colors (bone-white on surface-iron) may not scan on some low-end cameras | Medium   | Test on physical Android device. Fallback: offer a high-contrast toggle or use standard black-on-white with a card overlay.                                                               |
| Barcode scanner `windowed` mode requires WebView transparency CSS                    | Low      | Well-documented pattern. Overlay component handles the transparent background and viewfinder cutout.                                                                                      |
| Publishable key in QR code                                                           | Low      | Publishable keys are non-secret by design (equivalent to a public API key). The QR does not contain the service role key. Explainer text clarifies users still need to create an account. |

### Testing Strategy

- **Unit tests:** `invite-link.ts` -- `buildInviteLink` round-trips with `parseInviteLink`, edge cases (missing params, wrong scheme, extra params).
- **Component tests:** QR section renders/hides based on config state. Copy button calls clipboard API with correct string.
- **Manual testing:** Physical Android device scan with `windowed` mode. Browser paste flow.
- **Regression:** Existing setup flow tests pass unchanged.
