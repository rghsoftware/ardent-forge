# Feature 011: CI/CD Pipeline for Android App

**Status:** Draft
**Date:** 2026-04-04
**Author:** Claude (Cortex)

---

## Overview

Establish a complete CI/CD pipeline using GitHub Actions for the Ardent Forge Android app. The pipeline covers PR validation (lint, typecheck, unit tests, E2E tests), Android debug/release builds, Google Play Store deployment, and Supabase migration management -- all from zero (no existing CI infrastructure).

## Problem Statement

Ardent Forge has no CI/CD infrastructure. All builds, tests, and deployments are manual. This creates risk of:

- Regressions landing on `develop` undetected
- Inconsistent release builds (local machine variance)
- Manual, error-prone Play Store uploads
- Database migrations applied ad-hoc without validation
- No gate between code review and verified build success

## User Stories

1. **As a developer**, I want PRs to automatically run lint, typecheck, unit tests, and E2E tests so regressions are caught before merge.
2. **As a developer**, I want every PR to verify the Android app compiles so I know my changes don't break the build.
3. **As a release manager**, I want tagged releases to automatically build a signed AAB, upload it to Google Play, and apply Supabase migrations so the release process is hands-free.
4. **As a developer**, I want CI builds to be fast via aggressive caching so the feedback loop stays tight.

## Requirements

### Must Have

| ID  | Requirement                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **PR Validation Workflow** -- On every PR to `develop`: run ESLint, TypeScript type-check (`tsc -b`), and Vitest unit tests             |
| M2  | **E2E Testing on PRs** -- Run Playwright end-to-end tests as part of PR validation                                                      |
| M3  | **Android Debug Build on PR** -- Build a debug APK on every PR to verify Tauri+Gradle compilation succeeds                              |
| M4  | **Android Release Build on Tag** -- Build a signed release AAB/APK when a version tag (e.g., `v1.0.0`) is pushed                        |
| M5  | **Artifact Publishing** -- Upload signed AAB/APK as GitHub Release assets on tagged releases                                            |
| M6  | **Google Play Store Deployment** -- Automatically upload the signed AAB to Google Play Console (internal/beta track) on tagged releases |
| M7  | **Supabase Migration on Release** -- Run Supabase migrations against the production database on tagged releases                         |
| M8  | **Secret Management** -- Android keystore, Play Console service account key, and Supabase credentials stored as GitHub Secrets          |
| M9  | **Dependency Caching** -- Cache Bun dependencies, Cargo/Rust toolchain, Gradle builds, and Android SDK components                       |

### Should Have

| ID  | Requirement                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Version auto-injection** -- Derive `versionCode` from GitHub run number or tag; inject `versionName` from git tag into `tauri.properties` |
| S2  | **Build status badges** -- Add workflow status badges to README                                                                             |
| S3  | **Concurrency controls** -- Cancel superseded workflow runs on the same PR                                                                  |
| S4  | **Branch protection rules** -- Document required status checks for `develop` branch protection                                              |

### Won't Have (this phase)

| ID  | Exclusion                               | Rationale                                                              |
| --- | --------------------------------------- | ---------------------------------------------------------------------- |
| W1  | iOS build pipeline                      | No iOS target configured yet                                           |
| W2  | Desktop (Linux/macOS/Windows) builds    | Desktop distribution not prioritized                                   |
| W3  | Play Store production track deployment  | Start with internal/beta; promote manually until confidence is built   |
| W4  | Automated rollback on migration failure | Requires more sophisticated migration tooling; manual rollback for now |

## Testable Assertions

| ID  | Assertion                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------- |
| TA1 | A PR to `develop` triggers lint + typecheck + unit tests; failure blocks merge                                  |
| TA2 | A PR to `develop` triggers Playwright E2E tests; failure blocks merge                                           |
| TA3 | A PR to `develop` triggers an Android debug APK build; failure blocks merge                                     |
| TA4 | Pushing a `v*` tag triggers a release build producing a signed AAB                                              |
| TA5 | The signed AAB is uploaded as a GitHub Release asset                                                            |
| TA6 | The signed AAB is uploaded to Google Play Console internal/beta track                                           |
| TA7 | Pushing a `v*` tag triggers Supabase migrations against the production instance                                 |
| TA8 | CI caching reduces second-run build time by at least 40% compared to cold build                                 |
| TA9 | All secrets (keystore, Play Console key, Supabase credentials) are injected via GitHub Secrets, never committed |

## Open Questions (Resolved)

| ID  | Question                                                              | Resolution                                                                                                                             |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| OQ1 | Which Google Play track should be the initial deployment target?      | **Internal testing track.** Safest starting point; promote to beta/production manually from Play Console.                              |
| OQ2 | Should Supabase migrations run before or after the Play Store upload? | **Before.** If migrations break, abort the release before the app reaches users. Ensures API is ready when users update.               |
| OQ3 | Tag-based release strategy?                                           | **Pre-release tags (`-alpha`, `-beta`, `-rc`) from `develop`; stable tags from `main`.** Two workflow triggers with branch filtering.  |
| OQ4 | Is there an existing Google Play Console project and service account? | **Yes.** Both exist and are ready for CI integration.                                                                                  |
| OQ5 | Should E2E tests run against local Supabase or a staging environment? | **Local Supabase** via `supabase start`. Hermetic, no external dependencies, Docker-based. Already configured in `docker-compose.yml`. |

## Dependencies

| Dependency                                   | Type     | Notes                                            |
| -------------------------------------------- | -------- | ------------------------------------------------ |
| GitHub repository (rghsoftware/ardent-forge) | External | Workflows live in `.github/workflows/`           |
| Google Play Console                          | External | Service account with upload permissions required |
| Supabase CLI                                 | Tooling  | For `supabase db push` in CI                     |
| Android SDK 36 + NDK                         | Tooling  | Must be available on CI runner                   |
| Rust + Android cross-compilation targets     | Tooling  | `aarch64-linux-android`, etc.                    |
| Bun runtime                                  | Tooling  | For frontend build and test execution            |
| Java 21                                      | Tooling  | For Gradle/Android builds                        |
| Playwright                                   | Tooling  | For E2E test execution in CI                     |
