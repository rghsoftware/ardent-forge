# Changelog

All notable changes to Ardent Forge are documented in this file.

## [1.0.0-beta] - 2026-04-04

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

### Bug Fixes

- RLS infinite recursion on group_members and conversation_participants (#56)
- PKCE flow for OAuth sign-in (#55) and code race condition on callback (#54)
- Display QA findings from PR review (#61)
- Migration rename and auto-recreate DB on checksum mismatch

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
- **Tauri desktop shell** -- Rust/SQLite backend with offline support (Step 8)
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
