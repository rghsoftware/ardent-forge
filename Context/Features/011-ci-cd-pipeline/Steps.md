# Feature 011: CI/CD Pipeline -- Implementation Steps

**Status:** Draft
**Date:** 2026-04-04
**Spec:** [Spec.md](./Spec.md)
**Tech:** [Tech.md](./Tech.md)

---

## Team Composition

| Role              | Agent               | Domain                                            |
| ----------------- | ------------------- | ------------------------------------------------- |
| CI/CD Engineer    | `cicd-engineer`     | GitHub Actions workflows, caching, secrets        |
| Backend Engineer  | `backend-engineer`  | Supabase migration job, E2E Supabase setup        |
| Frontend Engineer | `frontend-engineer` | Playwright setup, E2E test scaffolding            |
| Android Engineer  | `android-engineer`  | Gradle signing config, build commands, Play Store |
| Quality Engineer  | `quality-engineer`  | Validation of all workflows                       |

---

## Wave 1: Foundation (parallel)

### S001 -- Create `.github/workflows/` directory and CI validation workflow

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/ci.yml`
**Depends on:** none

Create the PR validation workflow (`ci.yml`) with:

- Trigger: `pull_request` targeting `develop` or `main`
- Concurrency: cancel in-progress runs per PR (`ci-${{ github.ref }}`)
- Job `validate`:
  - `actions/checkout@v4`
  - `oven-sh/setup-bun@v2` (pinned version)
  - `actions/cache@v4` for `~/.bun/install/cache` keyed on `bun.lock`
  - `bun install`
  - `bun run lint`
  - `bun run build` (includes `tsc -b` + Vite build)
  - `bun run test`

**Acceptance criteria:**

- Workflow triggers on PRs to `develop` and `main`
- Lint, typecheck, and unit test failures block the PR
- Superseded runs are cancelled

**Ref:** TA1

---

### S002 -- Add Playwright and E2E test scaffolding

**Agent:** `frontend-engineer`
**Files:** `package.json`, `playwright.config.ts`, `e2e/smoke.spec.ts`
**Depends on:** none

1. Add `@playwright/test` as a dev dependency (`bun add -d @playwright/test`)
2. Create `playwright.config.ts`:
   - `testDir: './e2e'`
   - Projects: Chromium only
   - `baseURL: 'http://localhost:4173'` (Vite preview)
   - `webServer` config to run `bun run preview` before tests
   - Reporter: HTML (for CI artifact upload)
3. Create `e2e/smoke.spec.ts`:
   - Test: app loads without crashing
   - Test: login/auth page renders
4. Add script to `package.json`: `"test:e2e": "playwright test"`
5. Update `.gitignore` with `playwright-report/`, `test-results/`

**Acceptance criteria:**

- `bun run test:e2e` runs Playwright tests locally
- Smoke test verifies app renders

---

### S003 -- Configure Android release signing in Gradle

**Agent:** `android-engineer`
**Files:** `src-tauri/gen/android/app/build.gradle.kts`
**Depends on:** none

Modify `src-tauri/gen/android/app/build.gradle.kts` to add:

1. `signingConfigs` block that reads from environment variables:
   - `ANDROID_KEYSTORE_PATH` (file path)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
2. Only apply release signing config when env vars are present (guard with `if` so local debug builds are unaffected)
3. Wire `signingConfig` into the `release` build type

**Acceptance criteria:**

- Local debug builds (`bunx tauri android build`) still work without env vars set
- When env vars are set, release builds use the configured signing config
- No secrets are hardcoded

**Ref:** M8

---

## Milestone 1: PR Validation Foundation

**Gate:** S001, S002, S003 all complete
**Assertions verified:** TA1 (partial -- E2E not yet in CI), TA9

---

## Wave 2: CI Workflow Completion (parallel)

### S004 -- Add E2E test job to CI workflow

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/ci.yml`
**Depends on:** S001, S002

Add `e2e` job to `ci.yml`:

1. `actions/checkout@v4`
2. `oven-sh/setup-bun@v2` + Bun cache
3. `supabase/setup-cli@v1`
4. `bun install`
5. `bunx supabase start` (requires Docker, available on `ubuntu-latest`)
6. `bun run build`
7. `bunx playwright install --with-deps chromium`
8. `bun run test:e2e`
9. On failure: upload `playwright-report/` as artifact via `actions/upload-artifact@v4`

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables from `bunx supabase status` output for the E2E tests.

**Acceptance criteria:**

- E2E job runs in parallel with `validate` job
- E2E failure blocks PR merge
- Playwright report is downloadable on failure

**Ref:** TA2

---

### S005 -- Add Android debug build job to CI workflow

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/ci.yml`
**Depends on:** S001

Add `android-debug` job to `ci.yml`:

1. `actions/checkout@v4`
2. `actions/setup-java@v4` (Java 21, temurin, `cache: gradle`)
3. `android-actions/setup-android@v3` + `sdkmanager "ndk;<pinned-version>"`
4. `dtolnay/rust-toolchain@stable` + `rustup target add aarch64-linux-android`
5. `Swatinem/rust-cache@v2` with `workspaces: "src-tauri -> target"`, `shared-key: android`
6. `oven-sh/setup-bun@v2` + Bun cache
7. `bun install`
8. Set `ANDROID_NDK_HOME` environment variable
9. `bunx tauri android build --target aarch64 --apk` (debug, single arch for speed)
10. Optionally upload debug APK as artifact

**Acceptance criteria:**

- Android debug build runs in parallel with `validate` and `e2e`
- Build failure blocks PR merge
- Caching is effective (Cargo, Gradle, Bun all cached)

**Ref:** TA3

---

## Milestone 2: Complete PR Validation

**Gate:** S004, S005 complete
**Assertions verified:** TA1, TA2, TA3, TA8 (caching)

---

## Wave 3: Release Workflow (sequential within, parallel setup)

### S006 -- Create release workflow with signed AAB build

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/release.yml`
**Depends on:** S003, S005

Create `release.yml` with:

- Trigger: `push` tags matching `v*`
- Job `build-release`:
  1. Same toolchain setup as S005 (Java, Android SDK/NDK, Rust, Bun)
  2. Decode keystore: `echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > $RUNNER_TEMP/upload-key.jks`
  3. Inject version into `src-tauri/gen/android/app/tauri.properties`:
     - `versionName` from tag: `${GITHUB_REF_NAME#v}`
     - `versionCode` from `${{ github.run_number }}`
  4. Set signing env vars: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
  5. `bunx tauri android build --target aarch64 --aab`
  6. Upload AAB as workflow artifact via `actions/upload-artifact@v4`

**Acceptance criteria:**

- Pushing a `v*` tag triggers the workflow
- Signed AAB is produced and uploaded as artifact
- Version info in AAB matches the git tag

**Ref:** TA4

---

### S007 -- Add Supabase migration job to release workflow

**Agent:** `backend-engineer`
**Files:** `.github/workflows/release.yml`
**Depends on:** S006

Add `migrate` job to `release.yml`:

1. `actions/checkout@v4`
2. `oven-sh/setup-bun@v2`
3. `supabase/setup-cli@v1`
4. `bunx supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}`
5. `bunx supabase db push`
   - Uses `SUPABASE_ACCESS_TOKEN` secret for authentication

Job runs in **parallel** with `build-release`. Both must succeed before `publish` job starts.

**Acceptance criteria:**

- Migration job runs on tagged releases
- Migration failure blocks the publish job
- Supabase credentials are injected via secrets, never committed

**Ref:** TA7

---

### S008 -- Add publish job (GitHub Release + Play Store)

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/release.yml`
**Depends on:** S006, S007

Add `publish` job to `release.yml`, gated on both `build-release` and `migrate`:

1. Download AAB artifact via `actions/download-artifact@v4`
2. Create GitHub Release via `softprops/action-gh-release@v2`:
   - `tag_name: ${{ github.ref_name }}`
   - `prerelease: ${{ contains(github.ref_name, '-') }}`
   - Attach AAB file
   - Generate release notes from commits
3. Upload to Play Store via `r0adkll/upload-google-play@v3`:
   - `serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}`
   - `packageName: com.rghsoftware.ardentforge`
   - `releaseFiles: <path-to-aab>`
   - `track: internal`
   - `status: completed`

**Acceptance criteria:**

- Publish only runs after both build and migration succeed
- GitHub Release created with AAB attached
- Pre-release tags get `prerelease: true` flag
- AAB uploaded to Play Console internal testing track

**Ref:** TA5, TA6

---

## Milestone 3: Release Pipeline Complete

**Gate:** S006, S007, S008 complete
**Assertions verified:** TA4, TA5, TA6, TA7

---

## Wave 4: Polish and Documentation (parallel)

### S009 -- Add concurrency controls and branch protection docs

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`
**Depends on:** S008

1. Verify concurrency groups are set on both workflows:
   - `ci.yml`: `ci-${{ github.ref }}` with `cancel-in-progress: true`
   - `release.yml`: `release-${{ github.ref }}` (no cancel -- don't cancel a release mid-flight)
2. Create `.github/BRANCH_PROTECTION.md` documenting recommended branch protection settings:
   - `develop`: require `validate`, `e2e`, `android-debug` status checks
   - `main`: require `validate`, `e2e`, `android-debug` status checks
3. Add workflow status badges to the top of `README.md` (if README exists)

**Acceptance criteria:**

- Superseded CI runs are cancelled
- Release runs are never cancelled
- Branch protection requirements are documented

**Ref:** S3, S4

---

### S009-T -- Validate all workflows

**Agent:** `quality-engineer`
**Files:** all `.github/workflows/*.yml`
**Depends on:** S008

Validate:

1. YAML syntax is valid for all workflow files
2. All secret references match the documented secrets in Tech.md
3. All action versions are pinned (no `@master` or `@main`)
4. Caching keys are correct and consistent
5. Job dependency graph is correct (`needs:` declarations)
6. Concurrency groups are properly configured
7. No secrets are exposed in logs (no `echo ${{ secrets.* }}`)
8. Tag filtering logic correctly differentiates pre-release from stable
9. `tauri.properties` version injection uses correct sed/echo syntax
10. E2E job properly starts and tears down local Supabase

**Acceptance criteria:**

- All workflows pass validation
- No security issues in secret handling
- Dependency graph matches Tech.md architecture

**Ref:** TA9

---

### S009-D -- Document secrets setup and first-time prerequisites

**Agent:** `cicd-engineer`
**Files:** `.github/README.md`
**Depends on:** S008

Create `.github/README.md` covering:

1. List of all required GitHub Secrets with descriptions
2. How to generate and encode the upload keystore (`base64 -w 0 upload-key.jks`)
3. How to create the Google Play Console service account
4. How to get the Supabase access token and project ref
5. First-time Play Store upload requirement (manual initial upload)
6. Branch protection setup instructions
7. How to trigger a release (tag and push workflow)

**Acceptance criteria:**

- A new developer can set up the pipeline from this document alone
- All prerequisites are listed
- No secrets or credentials are included in the document

---

### S010 -- Add secret validation steps to release workflow jobs

**Agent:** `cicd-engineer`
**Files:** `.github/workflows/release.yml`
**Depends on:** S008

Add an upfront "Validate secrets" step at the beginning of each release workflow job that uses secrets (`build-release`, `migrate`, `publish`). Each step should validate that all required secrets for that job are non-empty, failing fast with a clear error message instead of letting builds run 10-15 minutes before hitting opaque failures.

Required validations per job:

- `build-release`: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
- `migrate`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
- `publish`: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

**Acceptance criteria:**

- Each job fails within 10 seconds if a required secret is missing
- Error messages clearly identify which secret is missing
- All 7 secrets across the release workflow are validated

**Ref:** TA9, PR Review P8-015

---

## Milestone 4: Feature Complete

**Gate:** S009, S009-T, S009-D all complete
**Assertions verified:** All (TA1-TA9)

---

## Summary

| Wave | Steps                | Parallel                            | Key Deliverable                                     |
| ---- | -------------------- | ----------------------------------- | --------------------------------------------------- |
| 1    | S001, S002, S003     | Yes (3 agents)                      | CI skeleton, Playwright scaffold, Gradle signing    |
| 2    | S004, S005           | Yes (2 agents)                      | Complete PR validation (lint + E2E + Android debug) |
| 3    | S006, S007, S008     | S006+S007 parallel, S008 sequential | Full release pipeline with Play Store + migrations  |
| 4    | S009, S009-T, S009-D | Yes (3 agents)                      | Polish, validation, documentation                   |

**Total steps:** 10 (7 implementation + 1 test + 1 documentation + 1 polish)
**Estimated agents in parallel (max):** 3
**Critical path:** S001 -> S005 -> S006 -> S008 -> S009-T
