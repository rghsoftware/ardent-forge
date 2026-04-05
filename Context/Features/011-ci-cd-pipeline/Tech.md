# Feature 011: CI/CD Pipeline -- Technical Plan

**Status:** Draft
**Date:** 2026-04-04
**Spec:** [Spec.md](./Spec.md)

---

## Architecture Overview

Two GitHub Actions workflows, triggered by different events, sharing a common toolchain setup:

```
PR to develop          v*-alpha/beta/rc tag (develop)     v* stable tag (main)
    |                          |                                |
    v                          v                                v
[ci.yml]                [release.yml]                    [release.yml]
 - lint                  - signed AAB build               - signed AAB build
 - typecheck             - GitHub Release (prerelease)    - GitHub Release
 - unit tests            - Play Store (internal track)    - Play Store (internal track)
 - E2E tests             - Supabase migrations (prod)     - Supabase migrations (prod)
 - debug APK build
```

### Workflow Files

| File                            | Trigger                       | Purpose                                                                  |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`      | PR to `develop`, PR to `main` | Lint, typecheck, unit tests, E2E tests, debug APK build                  |
| `.github/workflows/release.yml` | Push tag `v*`                 | Signed AAB build, GitHub Release, Play Store upload, Supabase migrations |

Two workflows total. `release.yml` handles both pre-release and stable tags, differentiating via tag pattern matching (`contains(github.ref, '-')` for pre-release flag).

---

## Toolchain and Actions

### Runner

**`ubuntu-latest`** for all workflows. Cheaper than macOS runners, Android SDK/NDK install is straightforward, and Tauri's Rust cross-compilation does not require macOS.

### Tool Installation Order

Each workflow installs tools in this dependency order:

| Step | Tool                 | Action / Method                                    | Version                   |
| ---- | -------------------- | -------------------------------------------------- | ------------------------- |
| 1    | Java 21              | `actions/setup-java@v4` (temurin, `cache: gradle`) | `21`                      |
| 2    | Android SDK + NDK    | `android-actions/setup-android@v3` + `sdkmanager`  | SDK 36, NDK pinned        |
| 3    | Rust stable          | `dtolnay/rust-toolchain@stable`                    | stable (min 1.77.2)       |
| 4    | Rust Android targets | `dtolnay/rust-toolchain` `targets` input           | `aarch64-linux-android`   |
| 5    | Bun                  | `oven-sh/setup-bun@v2`                             | pinned (currently latest) |
| 6    | Supabase CLI         | `supabase/setup-cli@v1`                            | latest (E2E + release)    |

### Caching Strategy

| Cache  | Method                               | Key                                                        |
| ------ | ------------------------------------ | ---------------------------------------------------------- |
| Gradle | `actions/setup-java` `cache: gradle` | Auto-keyed on `*.gradle*` + wrapper properties             |
| Cargo  | `Swatinem/rust-cache@v2`             | `workspaces: "src-tauri -> target"`, `shared-key: android` |
| Bun    | `actions/cache@v4`                   | `~/.bun/install/cache` keyed on `bun.lock`                 |

### Key Actions

| Purpose           | Action                             | Version                   |
| ----------------- | ---------------------------------- | ------------------------- |
| Checkout          | `actions/checkout@v4`              | v4                        |
| Java              | `actions/setup-java@v4`            | v4                        |
| Android SDK       | `android-actions/setup-android@v3` | v3                        |
| Rust              | `dtolnay/rust-toolchain@stable`    | stable                    |
| Rust cache        | `Swatinem/rust-cache@v2`           | v2                        |
| Bun               | `oven-sh/setup-bun@v2`             | v2                        |
| Generic cache     | `actions/cache@v4`                 | v4                        |
| Supabase CLI      | `supabase/setup-cli@v1`            | v1 (CLI pinned to 2.84.4) |
| Play Store upload | `r0adkll/upload-google-play@v3`    | v3                        |
| GitHub Release    | `softprops/action-gh-release@v2`   | v2                        |

---

## Workflow Details

### 1. `ci.yml` -- PR Validation

**Trigger:** `pull_request` targeting `develop` or `main`

**Concurrency:** Cancel in-progress runs for the same PR (`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`)

**Jobs:**

#### Job: `validate`

Runs on `ubuntu-latest`. Steps:

1. Checkout
2. Setup Bun + cache
3. `bun install`
4. `bun run lint` (ESLint)
5. `bun run build` (includes `tsc -b` typecheck + Vite build)
6. `bun run test` (Vitest)

#### Job: `e2e`

Runs on `ubuntu-latest`. Needs Docker for local Supabase. Steps:

1. Checkout
2. Setup Bun + cache
3. Setup Supabase CLI
4. `bun install`
5. `bunx supabase start` (spins up local Supabase via Docker)
6. `bun run build` (build frontend for E2E)
7. `bunx playwright install --with-deps chromium`
8. `bunx playwright test`
9. Upload Playwright report as artifact on failure

#### Job: `android-debug`

Runs on `ubuntu-latest`. Steps:

1. Checkout
2. Setup Java 21 (with Gradle cache)
3. Setup Android SDK + NDK
4. Setup Rust + Android targets + Rust cache
5. Setup Bun + cache
6. `bun install`
7. `bunx tauri android build --target aarch64 --apk` (debug build, single arch for speed)
8. Upload debug APK as artifact (optional, for manual testing)

All three jobs run **in parallel**. All must pass for PR merge.

### 2. `release.yml` -- Tagged Release

**Trigger:** `push` with tag pattern `v*`

**Branch filtering:** The tag determines pre-release vs stable:

- Tags containing `-alpha`, `-beta`, `-rc` are marked as pre-release on the GitHub Release
- Tags without a suffix are stable releases

**Jobs:**

#### Job: `build-release`

Steps:

1. Checkout
2. Setup Java 21 (with Gradle cache)
3. Setup Android SDK + NDK
4. Setup Rust + Android targets + Rust cache
5. Setup Bun + cache
6. `bun install`
7. Decode keystore from `KEYSTORE_BASE64` secret to `$RUNNER_TEMP/upload-key.jks`
8. Inject version into `tauri.properties`:
   - `versionName` from git tag (strip `v` prefix)
   - `versionCode` from `github.run_number` (monotonically increasing)
9. `bunx tauri android build --target aarch64 --aab` (signed release AAB)
10. Upload AAB as workflow artifact

#### Job: `migrate`

Runs **before** `build-release` completes (parallel start, but release publishing waits for both). Steps:

1. Checkout
2. Setup Supabase CLI
3. `bunx supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}`
4. `bunx supabase db push` (apply pending migrations to production)

**Failure behavior:** If migrations fail, the entire release workflow fails. The AAB is not published. This protects against deploying an app that expects schema changes that did not land.

#### Job: `publish`

Needs: `build-release`, `migrate` (both must succeed). Steps:

1. Download AAB artifact
2. Create GitHub Release via `softprops/action-gh-release@v2`:
   - Tag name from `github.ref`
   - Pre-release flag: `${{ contains(github.ref_name, '-') }}`
   - Attach AAB file
3. Upload to Play Store via `r0adkll/upload-google-play@v3`:
   - `track: internal`
   - `status: completed`
   - `packageName: com.rghsoftware.ardentforge`

---

## Signing Architecture

**Approach:** Google Play App Signing (Google holds the app signing key; we use an upload key in CI).

**Keystore handling in CI:**

1. Upload keystore is base64-encoded and stored as `KEYSTORE_BASE64` GitHub Secret
2. Decoded at build time to `$RUNNER_TEMP/upload-key.jks` (ephemeral, cleaned up with the runner)
3. Credentials passed via environment variables to Gradle

**Required modification to `src-tauri/gen/android/app/build.gradle.kts`:**
Add a `signingConfigs` block that reads from environment variables:

```kotlin
signingConfigs {
    create("release") {
        val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
        if (keystorePath != null) {
            storeFile = file(keystorePath)
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
}
```

Then reference it in the `release` build type's `signingConfig`.

---

## Secrets Required

| Secret                             | Content                                                    | Used In       |
| ---------------------------------- | ---------------------------------------------------------- | ------------- |
| `KEYSTORE_BASE64`                  | Base64-encoded upload keystore (.jks)                      | `release.yml` |
| `KEYSTORE_PASSWORD`                | Keystore password                                          | `release.yml` |
| `KEY_ALIAS`                        | Key alias within keystore                                  | `release.yml` |
| `KEY_PASSWORD`                     | Key password                                               | `release.yml` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Console service account JSON key                      | `release.yml` |
| `SUPABASE_PROJECT_REF`             | Supabase remote project reference (`azaioeglqubjqbdssnmi`) | `release.yml` |
| `SUPABASE_ACCESS_TOKEN`            | Supabase personal access token for CLI auth                | `release.yml` |

---

## E2E Testing Setup

Playwright is **not yet configured** in the project. This feature will add:

- `@playwright/test` as a dev dependency
- `playwright.config.ts` configured for Chromium, targeting `http://localhost:4173` (Vite preview server)
- `e2e/` directory for test files
- Initial smoke test: app loads, auth page renders

E2E tests run against a local Supabase instance (`bunx supabase start`) seeded with `supabase/seed.sql`. The Vite preview server is started via `bun run preview` (port 4173) pointing at the local Supabase URL.

---

## Version Injection Strategy

The `src-tauri/gen/android/app/tauri.properties` file controls Android versioning:

```properties
tauri.android.versionName=0.8.0
tauri.android.versionCode=8000
```

**In CI:**

- `versionName` is derived from the git tag: `echo "${GITHUB_REF_NAME#v}"` (e.g., `v1.2.0` becomes `1.2.0`)
- `versionCode` uses `${{ github.run_number }}` -- a monotonically increasing integer provided by GitHub Actions, guaranteeing each upload to Play Store has a higher version code

This is written to `tauri.properties` before the build step.

---

## Risks and Mitigations

| Risk                                                  | Impact                              | Mitigation                                                                     |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| Cold Android build takes 15-20 min                    | Slow PR feedback                    | Aggressive caching (Cargo, Gradle, Bun); debug build targets single arch only  |
| NDK version drift on runner images                    | Build breakage                      | Pin NDK version explicitly via `sdkmanager`                                    |
| Supabase migration fails on release                   | Blocked release                     | Migration runs as a gate; release only publishes if migrations succeed         |
| Keystore secret rotation                              | Requires coordinated update         | Document rotation procedure; use Play App Signing so upload key is replaceable |
| First Play Store upload must be manual                | One-time setup step                 | Document as a prerequisite in Steps.md                                         |
| `gen/android/` Gradle files modified by Tauri updates | CI build breaks after Tauri upgrade | Pin `@tauri-apps/cli` version; test upgrades in a dedicated PR                 |

---

## ADRs Created

- [ADR-007: GitHub Actions for CI/CD over alternatives](../../Decisions/ADR-007-github-actions-cicd.md)
