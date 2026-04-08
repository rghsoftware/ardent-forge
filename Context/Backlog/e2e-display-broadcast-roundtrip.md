# Backlog: E2E test for display broadcast round-trip

**Created:** 2026-04-07
**Origin:** F018 Gym-Scoped Displays, S031 smoke test deferral

## Summary

The F018 implementation has thorough unit / integration coverage of the display pipeline (publisher, subscriber, route, hooks, picker, Edge Function), but every test mocks Supabase Realtime. The one thing no automated test validates is the **real wire-format round trip through a live Realtime channel between two browser contexts**. F018's S031 covers this manually; we want it automated.

## What the test would verify

1. Phone-side browser context: signs in, opens `/`, taps Start Workout, picks a gym, navigates to `/log/<id>`, confirms a set.
2. TV-side browser context: opens `/display/gym/<gym-id>` anonymously, subscribes to the Realtime channel via the publishable key.
3. Assertion: the phone's set confirmation produces a visible update in the TV DOM (new workout card, correct athlete name, correct exercise).
4. Negative path: phone picks Private, confirms a set, TV does NOT update.

## Why it's not in F018

- Existing `e2e/smoke.spec.ts` has no Supabase / auth / workout scaffolding
- Would require `supabase start` in the Playwright `webServer` config (or a separate orchestration), seeded test user and gym, persisted auth session fixtures, and dual browser context coordination
- Multi-hour build-out that's meaningful as its own feature, not a bolt-on

## Suggested approach

1. Add `supabase start` + `bun run dev` to the Playwright `webServer` config (or a pre-test script)
2. Seed via `supabase db reset` + a test-only SQL fixture file that creates a known user and gym
3. Store a pre-authenticated session fixture in `e2e/fixtures/` for Playwright to load via `storageState`
4. Write `e2e/display-roundtrip.spec.ts` that opens two contexts and drives the end-to-end flow
5. Gate under a separate CI job since local Supabase startup is slow (30-60s)

## Prior art to reference

- F011 brought E2E infrastructure online -- revisit its patterns
- `playwright.config.ts` currently runs `bun run preview` only; needs expansion

## Dependencies

- Requires local Supabase tooling (`npx supabase start` or the bun equivalent) to be stable in CI
- Requires F018 migrations applied to the test DB (`20260407000001`, `20260407000002`, and any follow-up hardening migration)
