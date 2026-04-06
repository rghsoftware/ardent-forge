# Changelog

All notable changes to Ardent Forge are documented in this file.

## [1.0.0-beta.9] - 2026-04-05

### Features

- **Template names in builder** -- show template names when editing programs in the builder

### Bug Fixes

- Fixed Google OAuth sign-in on mobile by using system browser instead of Custom Chrome Tab (which can't handle custom scheme redirects)
- Made QR scan webview transparent so camera feed is visible (#83)

---

## [1.0.0-beta.8] - 2026-04-05

### Bug Fixes

- Fixed Google OAuth sign-in on mobile by setting `appLink: false` on deep link config (custom scheme was incorrectly treated as App Link requiring verification)
- Added CORS headers to discovery API function for Tauri WebView cross-origin fetch
- Synced baked Android `tauri.conf.json` CSP with source

---

## [1.0.0-beta.7] - 2026-04-05

### Bug Fixes

- Widened CSP connect-src to allow setup flow to reach arbitrary servers (was restricted to \*.supabase.co)
- Made invite links shareable via HTTPS URLs (app.ardentforge.app/connect) instead of custom scheme only
- QR codes still use ardentforge:// deep links for direct mobile scanning

---

## [1.0.0-beta.6] - 2026-04-05

### Features

- **New user onboarding system** -- three-layer onboarding with welcome card, contextual hints, nav discovery dots, and guided first-workout flow (Feature 015)
- **Shared EmptyState component** -- consistent empty states across all authenticated pages with icons, headings, and CTAs

### Improvements

- Overhauled web responsiveness across all authenticated pages (#76)
- Normalized page titles, headers, and icons across all pages
- Added design context section to CLAUDE.md for Iron & Ember design system
- Reordered sidebar nav into logical groups
- Narrowed scheme field onChange to variant-specific types

### Bug Fixes

- Fixed infinite render loop caused by uncached getPageSessions selector
- Fixed safe-area insets, barcode scanner, and auth guard on Tauri mobile
- Skipped env var auto-validation on Tauri mobile builds
- Added P10-025 through P10-029 test coverage for session builder

---

## [1.0.0-beta.4] - 2026-04-05

### Improvements

- Changed VERSION_CODE calculation to use timestamp for deterministic builds

---

## [1.0.0-beta.3] - 2026-04-05

### Features

- **Per-instance session editing** -- edit scheduled sessions individually within assigned programs (#74)
- **Program and template builder redesign** -- overhauled builder UI with improved large screen layout and UX (#75)
- **Exercises library tab** -- added Exercises tab to the Library page

### Improvements

- Improved large screen layout and UX for the program form
- Release skill for versioning and Play Store deployment

### Bug Fixes

- Set workout title from template name when starting a programmed workout
- Offset Android versionCode to prevent Play Store conflicts

---

## [1.0.0-beta.2] - 2026-04-04

### Features

- **Display system** -- gym TV display with board view, focused exercise view, and idle mode with Edge Function broadcast (#59, #60, #62)
- **Discovery and onboarding** -- server URL discovery flow, QR code generation and scanning for device setup (#63, #64)
- **Deep links** -- handle `ardentforge://connect` deep links for streamlined device pairing (#66)
- **Android CI/CD** -- GitHub Actions pipeline for Android builds, signing, and Play Store deployment (#67)
- **Progressive disclosure** -- contextual help and progressive disclosure in builders (Step 14.5)
- **Program builder** -- responsive week grid layout for program builder UI (#58)
- **Link previews** -- OG tags, Twitter Cards, and useMetadata hook for rich link previews (#53)
- **Edge functions** -- Cloudflare video edge functions with Vault secrets and local JWT signing

### Improvements

- Updated app icons and branding assets
- Chrome Custom Tabs for Google OAuth on Android
- TauriAdapter unit tests and error kind sync
- Chat domain type tests and IPC failure logging
- Reviewer account seed script for Supabase
- Batch enhancement issues cleanup (#71)

### Bug Fixes

- Chat Zod refinements in mappers and participant DELETE trigger
- JSONB columns already parsed by Supabase PostgREST (#70)
- Sync pull path HTTP status check and empty update_set guard (#70)
- CI: upgrade supabase/setup-cli to v2 and pin CLI to v2.84.4
- Invalid cron key in Supabase config.toml
- RLS infinite recursion on group_members and conversation_participants (#56)
- PKCE flow for OAuth sign-in (#55) and code race condition on callback (#54)
- Display QA findings from PR review (#61)
- Migration rename and auto-recreate DB on checksum mismatch
- Event metadata column comment formatting

---

## [0.8.0] - 2026-04-03

### Features

- **Chat system** -- real-time messaging with coach conversations, Supabase Realtime integration (#33, #34, #35)
- **Coach program assignment** -- coaches can assign programs to athletes within accountability groups
- **Events & packing lists** -- event planning with gear checklists (#30)
- **Sync engine** -- full bidirectional sync with dynamic upsert and force-pull support (#28)
- **Accountability groups** -- group creation, direct connections, and invite system (#26)
- **Share links** -- read-only share links for programs and workout logs (Step 16)
- **Notification system** -- rest timer, session reminders, and PR celebrations (#24)
- **VAULT analytics** -- analytics screen with PR detection and exercise records (Step 14)
- **Docker self-hosting** -- one-command compose stack for self-hosted deployments (#22)
- **Google OAuth** -- sign-in with PKCE web redirect and Tauri deep-link (#20)
- **Program builder** -- drag-and-drop UI, mobile editor, and preview (Step 12)
- **Programmed workout logging** -- log workouts against structured programs (Step 13)
- **Program structure** -- blocks, weeks, and scheduling (Step 11)
- **Session templates** -- template system with SetScheme editor (#11)
- **Tauri mobile shell** -- Rust/SQLite backend with offline support (Step 8)
- **Workout history** -- history list, detail view, and volume trends (#8)
- **Active workout logging** -- full workout logging UI (Step 6) (#7)
- **Exercise library & profile** -- exercise browser, user profile, bottom nav (#6)
- **Supabase data adapter** -- TanStack Query hooks and auth UI (Step 4)
- **Iron & Ember design system** -- custom design tokens and component library (#3)
- **Supabase schema** -- Postgres schema, RLS policies, indices, and seed data
- **Domain layer** -- domain types, Zod schemas, and data adapter interface (#1)

### Improvements

- UI/UX polish -- auth flow, animations, navigation, layouts (#19)
- Comprehensive unit test suite -- 1,015 tests across 42 files (#15)
- Connection validation with env var error surfacing on setup page
- Vercel deployment configuration

### Bug Fixes

- Incremental sync push breakage and missing error state
- Duplicate migration timestamp collision
- Supabase client connection validation
- Authorization header for Supabase reachability check
- Sync engine correctness, rest timer, and type safety fixes
