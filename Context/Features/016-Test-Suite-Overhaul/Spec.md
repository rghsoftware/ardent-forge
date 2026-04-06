# Feature 016: Test Suite Overhaul

## Overview

Overhaul the test suite to close critical coverage gaps in the Rust/Tauri backend, expand E2E coverage beyond smoke tests, integrate Rust tests into CI, and establish Android-specific testing. The Rust command handlers are the entire mobile data path -- bugs here cause silent data loss on Android with no test safety net.

## Problem Statement

The TypeScript layer has reasonable test coverage (93 files, 1925 tests), but the layers that matter most for Android are badly undertested:

1. **Rust command handlers (0% covered):** 15 files totaling 4,672 lines of untested code. These handle every CRUD operation for exercises, workout logs, programs, session templates, sharing, user profiles, and sync -- the entire offline-first data path. Five more files have empty `#[cfg(test)]` scaffolding with zero actual test functions.

2. **Rust tests not in CI:** The 37 existing Rust test functions (event_reminder, notification, session_reminder, sync/conflict, sync/pull) never run in CI. Regressions can ship undetected.

3. **E2E is smoke-only:** 2 Playwright tests (app loads, auth page renders). No coverage of core user flows: creating an exercise, logging a workout, building a program, starting a session.

4. **Zero Android-specific testing:** No instrumentation tests, no on-device validation. The Tauri WebView wrapper, deep links, push notifications, and camera (QR scanner) have never been tested on an actual Android target.

## User Stories

- As a developer, I want Rust command handler tests so that data CRUD regressions are caught before they reach Android users.
- As a developer, I want `cargo test` in CI so existing Rust tests actually prevent regressions.
- As a developer, I want E2E tests covering core workout flows so that user-facing breakage is caught automatically.
- As a developer, I want Android-specific test infrastructure so that device-dependent behavior (deep links, notifications, WebView rendering) can be validated.

## Requirements

### Must Have

- **M1: Rust command handler unit tests** -- Add `#[cfg(test)]` modules with test functions to all untested command files: `exercises.rs`, `workout_logs.rs`, `programs.rs`, `session_templates.rs`, `sharing.rs`, `user_profile.rs`, `app_config.rs`, `guest.rs`, `notification.rs` (commands), `sync.rs` (commands), `rest_timer.rs` (commands)
- **M2: Rust infrastructure tests** -- Add tests to `error.rs` (error type mapping), `models.rs` (serde round-trips), `utils.rs` (helper functions), `db.rs` (connection/migration logic)
- **M3: Flesh out empty Rust test modules** -- `commands/chat.rs`, `rest_timer.rs`, `sync/mod.rs`, `sync/push.rs`, `sync/queue.rs` all have `#[cfg(test)]` but zero test functions
- **M4: Cargo test in CI** -- Add a `rust-tests` job to `.github/workflows/ci.yml` that runs `cargo test` in `src-tauri/` with appropriate caching
- **M5: Core flow E2E tests** -- Expand Playwright specs to cover: sign-up/sign-in, create exercise, log a workout set, view workout history, basic program builder interaction
- **M6: E2E test data isolation** -- Each E2E test must create/teardown its own data so tests are independent and repeatable

### Should Have

- **S1: Android instrumentation test scaffold** -- Set up a Maestro or Appium test harness that can run against the APK on an emulator, with at least one test validating the app launches and renders the WebView
- **S2: Android deep link test** -- Verify `ardentforge://` URL scheme triggers correct in-app navigation
- **S3: Coverage reporting** -- Add `cargo-tarpaulin` or `cargo-llvm-cov` for Rust coverage, integrate Vitest coverage output; report both in CI (no gating threshold yet)
- **S4: Rust clippy in CI** -- Add `cargo clippy -- -D warnings` to the CI pipeline alongside tests
- **S5: TypeScript coverage gap-fill** -- Add tests for the highest-value untested TS modules: `src/lib/sync-bridge.ts` consumers, `src/components/workout/` components missing coverage, store files

### Won't Have (this iteration)

- On-device performance benchmarks
- Visual regression testing (screenshot comparison)
- iOS testing (no iOS target currently)
- Rust integration tests with a real SQLite database (unit tests with mocked `invoke`/DB are sufficient for now)
- Achieving a specific coverage percentage threshold

## Testable Assertions

| ID    | Assertion                                                                                                                           | Verification                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A-001 | Every Rust command file in `src-tauri/src/commands/` has a `#[cfg(test)]` module with at least one `#[test]` function               | `grep -r "#\[test\]"` in each file    |
| A-002 | `error.rs`, `models.rs`, `utils.rs`, `db.rs` each have at least one test function                                                   | `grep` in each file                   |
| A-003 | The 5 existing empty test modules (`chat`, `rest_timer`, `sync/mod`, `sync/push`, `sync/queue`) each contain at least one `#[test]` | `grep`                                |
| A-004 | `cargo test` in `src-tauri/` passes with 0 failures                                                                                 | `cd src-tauri && cargo test`          |
| A-005 | CI workflow includes a job that runs `cargo test` and fails the pipeline on test failure                                            | Review `.github/workflows/ci.yml`     |
| A-006 | E2E test count is >= 10 (up from 2), covering auth, exercise CRUD, workout logging, and history                                     | `bun run test:e2e`                    |
| A-007 | All E2E tests pass against local Supabase                                                                                           | `bun run test:e2e`                    |
| A-008 | Total Rust test function count is >= 80 (up from 37)                                                                                | `grep -rc "#\[test\]" src-tauri/src/` |
| A-009 | All existing TypeScript tests still pass (no regressions)                                                                           | `bun run test`                        |
| A-010 | CI runs `cargo clippy -- -D warnings` and passes                                                                                    | Review CI + run locally               |

## Open Questions

- [ ] Which Android test framework to use for S1? Maestro (simpler YAML-based) vs Appium (more powerful, heavier setup). Maestro is likely better for a solo dev workflow.
- [ ] Should the Rust command tests mock the SQLite database layer or use an in-memory SQLite instance? In-memory is more realistic but couples tests to the DB schema.
- [ ] What CI runner to use for `cargo test`? `ubuntu-latest` should work but needs Rust toolchain setup. Caching `target/` is important for speed.

## Dependencies

- Feature 012 (TauriAdapter Tests) -- already done, provides the TS-side mock pattern
- Existing Rust test patterns in `event_reminder.rs`, `sync/pull.rs` -- use as templates
- Local Supabase stack for E2E tests (already in CI)

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-05 | Initial spec | --  |
