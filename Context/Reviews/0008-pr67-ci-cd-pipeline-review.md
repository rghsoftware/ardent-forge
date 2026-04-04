# PR Review: feat/ci-cd-pipeline -> develop

**Date:** 2026-04-04
**Feature:** Context/Features/011-ci-cd-pipeline/
**Branch:** feat/ci-cd-pipeline
**Reviewers:** code-reviewer, silent-failure-hunter, pr-test-analyzer, comment-analyzer
**Status:** :large_green_circle: Resolved

## Summary

16 findings across 14 files implementing the Android CI/CD pipeline (Feature 011). 3 critical issues around silent failure modes in signing config and workflow secret handling, 7 important issues covering security anti-patterns and missing validation, and 6 documentation inaccuracies. The pipeline architecture is solid but needs defensive hardening before secrets-dependent workflows run in production.

## Findings

### Fix-Now

#### [FIX] P8-001: Signing config unconditionally assigned to release builds

- **File:** src-tauri/gen/android/app/build.gradle.kts:53
- **Severity:** Critical
- **Detail:** `signingConfig = signingConfigs.getByName("release")` is assigned unconditionally, but the signing config only populates fields when `ANDROID_KEYSTORE_PATH` is set. When env vars are absent (local dev), the signing config has null fields, causing cryptic Gradle errors on release builds. Additionally, if `ANDROID_KEYSTORE_PATH` is set but the other 3 env vars are missing, you get opaque "keystore password was incorrect" errors. Fix: guard the `signingConfig =` assignment inside an `if (keystorePath != null)` block, and validate all 4 env vars together.
- **Relates to:** S003 acceptance criteria ("Local debug builds still work without env vars set"), TA9
- **Status:** :white_check_mark: Fixed
- **Resolution:** Guarded `signingConfig` assignment with `if (keystorePath != null)` check in release build type

#### [FIX] P8-002: jq silently returns "null" string for missing Supabase status keys

- **File:** .github/workflows/ci.yml:76-78
- **Severity:** Critical
- **Detail:** If `bunx supabase status --output json` output lacks `API_URL` or `ANON_KEY`, `jq -r` returns the literal string "null" with exit code 0. `VITE_SUPABASE_URL=null` gets set, the frontend build succeeds, and E2E tests fail with cryptic network errors. Also calls `supabase status` twice redundantly. Fix: capture status once, validate extracted values are non-empty and not "null".
- **Relates to:** TA2
- **Status:** :white_check_mark: Fixed
- **Resolution:** Captured status once into variable, added non-empty and non-"null" validation with `::error::` annotations

#### [FIX] P8-003: Empty KEYSTORE_BASE64 secret silently produces corrupt keystore file

- **File:** .github/workflows/release.yml:62
- **Severity:** Critical
- **Detail:** `echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > $RUNNER_TEMP/upload-key.jks` succeeds with exit 0 when secret is empty, producing a near-empty file. Gradle then burns 10-15 min building before failing with "Invalid keystore format." The secret is also inlined in shell rather than passed via `env:`. Fix: pass through env block, validate non-empty before decode, validate decoded file size.
- **Relates to:** TA9
- **Status:** :white_check_mark: Fixed
- **Resolution:** Passed KEYSTORE_BASE64 via env block, added empty-check before decode and file size validation (min 100 bytes)

#### [FIX] P8-004: Secrets interpolated directly in shell commands

- **File:** .github/workflows/release.yml:62,106
- **Severity:** High
- **Detail:** `${{ secrets.KEYSTORE_BASE64 }}` and `${{ secrets.SUPABASE_PROJECT_REF }}` are expanded inline in `run:` commands. While GitHub masks known secrets, passing via shell args (vs `env:` blocks) risks exposure if commands print error messages with arguments, or if shell tracing is enabled. Fix: pass all secrets through `env:` blocks consistently.
- **Relates to:** TA9
- **Status:** :white_check_mark: Fixed
- **Resolution:** Both secrets now passed through `env:` blocks and referenced as shell variables

#### [FIX] P8-005: GitHub Release created before Play Store upload (partial release risk)

- **File:** .github/workflows/release.yml:125-140
- **Severity:** High
- **Detail:** If Play Store upload fails, a GitHub Release already exists with an AAB attached but never published to Play Store. This creates a partial release state. Fix: reorder to upload to Play Store first, then create GitHub Release.
- **Relates to:** TA5, TA6
- **Status:** :white_check_mark: Fixed
- **Resolution:** Reordered publish job steps: Play Store upload now runs before GitHub Release creation

#### [FIX] P8-006: test:e2e script uses bare playwright instead of bunx

- **File:** package.json (scripts.test:e2e)
- **Severity:** High
- **Detail:** `"test:e2e": "playwright test"` violates project convention "Never use npx/npm/yarn; always bun and bunx." Should be `"test:e2e": "bunx playwright test"`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed to `"test:e2e": "bunx playwright test"`

#### [FIX] P8-007: Missing if-no-files-found on Playwright report upload

- **File:** .github/workflows/ci.yml:89-95
- **Severity:** Medium
- **Detail:** If Playwright crashes before generating the report directory, the upload step fails, masking the actual test failure in the job summary. Add `if-no-files-found: ignore`.
- **Relates to:** TA2
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `if-no-files-found: ignore` to upload-artifact step

#### [FIX] P8-008: Missing newline at end of build.gradle.kts

- **File:** src-tauri/gen/android/app/build.gradle.kts (EOF)
- **Severity:** Low
- **Detail:** POSIX convention violation. Causes noisy diffs when next edit appends content.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added trailing newline

#### [FIX] P8-009: Tech.md says "Four workflows" but only two exist

- **File:** Context/Features/011-ci-cd-pipeline/Tech.md:12
- **Severity:** Medium
- **Detail:** Architecture Overview opens with "Four GitHub Actions workflows" but only ci.yml and release.yml exist. The table below correctly says two files. Change "Four" to "Two".
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed "Four" to "Two" in Architecture Overview

#### [FIX] P8-010: Tech.md documents armv7-linux-androideabi target not used in workflows

- **File:** Context/Features/011-ci-cd-pipeline/Tech.md (Tool Installation Order table, Step 4)
- **Severity:** Medium
- **Detail:** Table lists `armv7-linux-androideabi` as a Rust target but neither workflow installs it. Both use only `aarch64-linux-android` via the action's `targets` input. Remove the extra target and fix the method description.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed `armv7-linux-androideabi`, updated method to reference `dtolnay/rust-toolchain` `targets` input

#### [FIX] P8-011: Tech.md E2E base URL and server description wrong

- **File:** Context/Features/011-ci-cd-pipeline/Tech.md (E2E Testing Setup section)
- **Severity:** Medium
- **Detail:** States Playwright targets `localhost:5173` (dev server) but actual config uses `localhost:4173` (preview). Also says "Vite dev server is started in preview mode" which is contradictory. Fix both to reference port 4173 and "Vite preview server."
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated to reference port 4173 and "Vite preview server"

#### [FIX] P8-012: Steps.md S004 env var names missing VITE\_ prefix

- **File:** Context/Features/011-ci-cd-pipeline/Steps.md (S004)
- **Severity:** Medium
- **Detail:** S004 says `SUPABASE_URL` and `SUPABASE_ANON_KEY` but actual workflow uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (prefix required for Vite).
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated env var names to include `VITE_` prefix

#### [FIX] P8-013: Tech.md signing snippet differs from actual implementation

- **File:** Context/Features/011-ci-cd-pipeline/Tech.md (Signing Architecture section)
- **Severity:** Low
- **Detail:** Code snippet shows `?: "/dev/null"` fallback pattern but actual implementation uses null-guard `if` pattern. Update snippet to match.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated code snippet to use `if (keystorePath != null)` guard pattern matching actual implementation

#### [FIX] P8-014: ADR-007 status should be "Accepted"

- **File:** Context/Decisions/ADR-007-github-actions-cicd.md:3
- **Severity:** Low
- **Detail:** Status says "Proposed" but implementation is complete. Change to "Accepted" at merge time.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed status from "Proposed" to "Accepted"

### Missing Tasks

#### [TASK] P8-015: Add secret validation steps to release workflow jobs

- **File:** .github/workflows/release.yml (all jobs)
- **Severity:** High
- **Detail:** 7 secrets across the release workflow have no upfront validation. Empty secrets silently expand to empty strings, causing failures 10-15 minutes into builds with opaque error messages. Add a "validate secrets" step at the beginning of each job that uses secrets (build-release, migrate, publish). This was not anticipated in Steps.md.
- **Relates to:** TA9
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added as S010 in Steps.md, then implemented: validation steps added to build-release, migrate, and publish jobs

#### [TASK] P8-016: Add Playwright webServer timeout and output capture

- **File:** playwright.config.ts:21-24
- **Severity:** High
- **Detail:** No `timeout` configured (default 60s). If preview server fails to start, error output is swallowed and tests time out with a generic message. Add `timeout: 30_000` and `stdout: 'pipe'` / `stderr: 'pipe'`. Not covered in S002 acceptance criteria.
- **Relates to:** TA2
- **Status:** :white_check_mark: Fixed
- **Resolution:** Applied directly to playwright.config.ts -- added `timeout: 30_000`, `stdout: 'pipe'`, `stderr: 'pipe'` to webServer config

### Architectural Concerns

_None identified._

### Convention Gaps

_None identified._

## Resolution Summary

**Resolved at:** 2026-04-04
**Session:** Review resolution for PR #67 CI/CD pipeline

| Category  | Total  | Fixed  | Tasks  | ADRs   | Rules  | Deferred | Discarded |
| --------- | ------ | ------ | ------ | ------ | ------ | -------- | --------- |
| [FIX]     | 14     | 14     | --     | --     | --     | --       | --        |
| [TASK]    | 2      | 2      | --     | --     | --     | --       | --        |
| **Total** | **16** | **16** | **--** | **--** | **--** | **--**   | **--**    |

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings added to Steps.md or fixed directly
- [x] All [ADR] findings have ADRs created or dismissed
- [x] All [RULE] findings applied or dismissed
- [x] Review verified by review-verify agent
