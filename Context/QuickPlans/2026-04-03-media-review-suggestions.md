# Quick Plan: Media Review Suggestions S1-S12

**Date:** 2026-04-03
**Source:** PR #57 review -- `Context/Reviews/0004-pr57-video-image-sharing-review.md`
**Scope:** 12 optional improvements to the video/image/file sharing feature

---

## Task

Apply or track the 12 enhancement suggestions from the PR #57 review. All suggestions were
non-blocking (merge was not conditioned on them), but each improves correctness, safety,
or coverage.

---

## Goal

Reduce tech debt introduced with the media sharing feature before it compounds. Suggestions
fall into three tracks: code quality (S1-S5, S10-S12), test coverage (S6-S9), and security
hardening (S10).

---

## Approach

Group by effort and apply in order:

### Track A -- Trivial (single-line or comment fixes) -- do inline

| # | Change | File |
|---|--------|------|
| S11 | Remove noise comments `{/* Video */}`, `{/* Photo */}` | `src/components/chat/attachment-picker.tsx` |
| S12 | Fix `isExpired` JSDoc: "within 60 seconds" -> "will expire within the next 60 seconds" | `src/lib/media-provider.ts:90` |

### Track B -- Small code improvements -- do as one pass

| # | Change | File |
|---|--------|------|
| S1 | Add `satisfies Record<MediaType, unknown>` to `MEDIA_CONSTRAINTS` for compile-time exhaustiveness | `src/lib/media-constraints.ts` |
| S4 | Extract duplicated `extractExtension` into a shared util (currently in both `media-constraints.ts` and `media-upload-service.ts`) | Create `src/lib/media-utils.ts` or inline in one file |
| S5 | Add `allowedMimeTypes` to `file` constraint group (defense-in-depth client-side check) | `src/lib/media-constraints.ts` |
| S10 | Use constant-time comparison for webhook HMAC signature verification (timing attack prevention) | `supabase/functions/chat-media-webhook/index.ts` |

### Track C -- Structural change (careful review needed)

| # | Change | File |
|---|--------|------|
| S2 | Refactor `UploadResult` from flat interface to discriminated union on `mediaType` | `src/lib/media-upload-service.ts` (and consumers) |
| S3 | Replace manual `typeof` checks in edge functions with Zod request validation | `supabase/functions/chat-media-upload-url/index.ts`, `chat-media-signed-url/index.ts`, `chat-media-webhook/index.ts` |

### Track D -- Test coverage

| # | Change | File |
|---|--------|------|
| S6 | Add Storage upload error paths to upload service tests | `src/lib/__tests__/media-upload-service.test.ts` |
| S7 | Add TUS `onError` path (mock currently only calls `onSuccess`) | `src/lib/__tests__/media-upload-service.test.ts` |
| S8 | Add video duration rejection >60s and metadata error paths | `src/lib/__tests__/media-constraints.test.ts` |
| S9 | Add edge function test coverage (~605 lines currently uncovered) | New test files under `supabase/functions/__tests__/` |

---

## Verification

- `bun run build` passes
- `bun run test` passes with new/updated tests covering S6-S8
- S2 discriminated union: verify all `UploadResult` consumers destructure correctly
- S10 constant-time comparison: verify timing-safe byte comparison used (no string equality)

---

## Risks

- **S2** is the highest-risk item -- `UploadResult` is consumed by `useMediaUpload`, `supabase-adapter`, `tauri-adapter`. A discriminated union removes `Optional` noise but requires updating all destructuring sites. Do not rush.
- **S9** (edge function tests) requires a Deno test harness setup (`deno test` or a local Supabase test runner). This may be more than a "quick" item -- consider converting to a backlog task if setup is non-trivial.
- **S4** (extract `extractExtension`): if moved to a shared module, verify both import sites update and no circular dependency is introduced.

---

## Status

All 12 suggestions implemented:

- [x] Track A: S11, S12 -- trivial fixes
- [x] Track B: S1, S4, S5, S10 -- code improvements
- [x] Track C: S2 (discriminated union), S3 (Zod edge function validation)
- [x] Track D: S6, S7, S8 (Vitest coverage), S9 (Deno test infrastructure)

**S9 details:** Created `supabase/deno.test.jsonc` (import-map approach for mocking),
shared test utils in `_test-utils/`, and 25 tests across 3 edge functions. Handlers
exported for testability. Run with `deno test --config supabase/deno.test.jsonc`
(requires Deno 2 runtime).
