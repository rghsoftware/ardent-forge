# Feature 010: QR Code Generation + Scan on Setup

## Phase 1 -- Specification

### Overview

Add QR code-based server sharing to Ardent Forge. A configured user can generate a QR code (and copyable invite link) from Settings that encodes their backend connection details. A new user can scan that QR code (mobile) or paste the invite link (browser/desktop) on the setup screen to auto-configure their app without manually typing Supabase credentials.

### Problem Statement

Onboarding new users to a self-hosted Ardent Forge instance currently requires them to manually enter a server URL or raw Supabase credentials. This is error-prone and unfriendly, especially on mobile devices. There is no way for an existing user to share their server configuration with others.

### User Stories

1. **As a configured user**, I want to display a QR code in Settings so I can show it to someone who needs to connect to my server.
2. **As a configured user**, I want to copy an invite link so I can send it via chat/email to someone who needs to connect.
3. **As a new mobile user**, I want to scan a QR code on the setup screen so I can connect without typing URLs.
4. **As a new browser/desktop user**, I want to paste an invite link on the setup screen so I can connect without typing URLs.
5. **As a new user**, I want scanned/pasted credentials to auto-validate so I can proceed to account creation immediately.

### Requirements

#### Must Have

- **M1**: Settings Backend section shows "Share this server" area with QR code encoding `ardentforge://connect?url={supabaseUrl}&key={publishableKey}`
- **M2**: "Copy invite link" button copies the `ardentforge://connect?...` deep link string to clipboard with success toast
- **M3**: QR code and invite link section only renders when `configStore.hasConfig()` is true
- **M4**: Setup screen QR scan button opens native camera via `@tauri-apps/plugin-barcode-scanner` on Android
- **M5**: Barcode scanner uses `windowed: true` mode with dark overlay and viewfinder cutout
- **M6**: Browser mode replaces camera scan with a "Paste invite link" text input
- **M7**: Successful scan/paste of a valid `ardentforge://connect` URL extracts `url` and `key` params, pre-populates the manual config fields, expands the Advanced section, and auto-triggers validation
- **M8**: Invalid QR/link content shows error toast ("Invalid invite link")
- **M9**: Barcode scanner permissions added to `src-tauri/capabilities/mobile.json`
- **M10**: Existing setup flow (server URL discovery and manual entry) continues to work unchanged

#### Should Have

- **S1**: Explainer text below QR code: "Share this with anyone who wants to connect to this server. They will still need to create an account."
- **S2**: QR code renders on `surface-iron` card background, centered, with Iron and Ember styling

#### Will Not Have

- **W1**: Deep link handler for `ardentforge://connect` (Refactor C scope)
- **W2**: QR code expiration or revocation
- **W3**: Embedded credentials in QR (only URL + publishable key, which are non-secret)

### Testable Assertions

| ID   | Assertion                                                                                                  | 验证 Method                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| TA-1 | QR code in Settings encodes `ardentforge://connect?url={encoded}&key={encoded}` with current config values | Unit test: render component, decode QR SVG content                        |
| TA-2 | Copy button writes correct deep link string to clipboard                                                   | Integration test: click button, read clipboard                            |
| TA-3 | QR section does not render when config store is empty                                                      | Unit test: render with empty config, assert section absent                |
| TA-4 | Tauri renders native scan button; browser renders paste field                                              | Platform-conditional render test (`isTauri()` branch)                     |
| TA-5 | Browser paste field parses valid `ardentforge://connect` URL correctly                                     | Unit test: parse function with valid/invalid inputs                       |
| TA-6 | Invalid link shows toast with "Invalid invite link"                                                        | Unit test: trigger invalid input, assert toast call                       |
| TA-7 | Valid scan/paste pre-populates Advanced fields and triggers validation                                     | Integration test: simulate input, assert field values and validation call |
| TA-8 | Existing setup flows (discovery + manual) still work                                                       | Regression: existing test suite passes                                    |

### Open Questions

None -- all resolved:

1. ~~**QR code size**~~: Resolved -- determine optimal dimensions during Phase 2 research.
2. ~~**iOS plist**~~: Resolved -- iOS is not a supported target. Dropped M11 (NSCameraUsageDescription).

### Dependencies

- `qrcode.react` (new dependency for QR generation)
- `@tauri-apps/plugin-barcode-scanner` (new dependency for mobile QR scanning)
- Existing: `sonner` (toasts), `lucide-react` (QrCode icon already imported in setup.tsx), config store, connection validator
