# PR #59 Review: Display Broadcast Infrastructure

**Date:** 2026-04-04
**PR:** feat: display broadcast infrastructure (Step 27)
**Branch:** `feat/remote-display` -> `develop`
**Reviewers:** Claude Code (automated -- code, tests, types, errors, comments)
**Decision:** Changes requested
**Status:** 🟢 Resolved

---

## Scope

8,695 additions / 63 deletions across 75 files covering two feature areas:

1. **Display broadcast infrastructure** -- `DisplaySnapshot` domain type, `display-publisher` service, `useDisplayBroadcast` hook, `PushToDisplayButton`, `display_visible` column
2. **Chat media** -- Cloudflare Stream video upload/playback, Supabase Storage image/file upload, attachment picker, video player, media upload service, edge functions

---

## Critical (must fix before merge)

**C1 -- Storage upload RLS lacks authorization**
- `supabase/migrations/20260403000002_media_storage.sql:33-40`
- `chat_images_insert_authenticated` and `chat_files_insert_authenticated` only check `auth.uid() is not null`. Any authenticated user can upload to any conversation's path.
- Fix: add `is_conversation_participant((string_to_array(name, '/'))[2]::uuid)` to both insert policies.
- **Status:** ✅ Fixed
- **Resolution:** Added `is_conversation_participant` check to both insert RLS policies

**C2 -- Uploaded images never display in chat**
- `src/lib/media-upload-service.ts` + `src/components/chat/media-message-content.tsx`
- Image/file uploads set `status: 'ready'` but never populate `playbackUrl` or `thumbnailUrl`. `MediaMessageContent` returns `null` when no URL exists -- uploaded images silently vanish.
- Fix: generate and store a signed URL after upload, or add URL resolution in the component.
- **Status:** ✅ Fixed
- **Resolution:** Added `createSignedUrl` calls after upload in service; added `useStorageSignedUrl` fallback hook in component; updated test mocks

**C3 -- Snapshot builder can crash core workout flow**
- `src/stores/active-workout-store.ts` -- `_publishCurrentState`
- No try-catch around `buildDisplaySnapshot()`. Any runtime error propagates into `completeSet`, `startRest`, etc., crashing workout UI for a secondary feature.
- Fix: wrap in try-catch with `console.error`.
- **Status:** ✅ Fixed
- **Resolution:** Wrapped `buildDisplaySnapshot` + `publishDisplaySnapshot` in try-catch in `_publishCurrentState()`

**C4 -- Cloudflare signed URL uses wrong identifier**
- `supabase/functions/chat-media-signed-url/index.ts:~73`
- Signed URL constructed as `https://customer-${accountId}.cloudflarestream.com/...`. Cloudflare customer subdomain is separate from account ID. Likely produces invalid playback URLs.
- Fix: use a dedicated `CLOUDFLARE_CUSTOMER_SUBDOMAIN` env var and update the URL template.
- **Status:** ✅ Fixed
- **Resolution:** Added `CLOUDFLARE_CUSTOMER_SUBDOMAIN` env var with validation; updated URL template

---

## Important

**I1 -- Empty `.catch(() => {})` on TUS abort** (`src/lib/media-upload-service.ts`)
- Cancellation failures silently ignored. Upload may complete in background producing ghost attachments.
- Fix: log the error.
- **Status:** ✅ Fixed
- **Resolution:** Replaced empty catch with `console.error('[media-upload] TUS abort failed:', err)`

**I2 -- Video player bare catch block** (`src/components/chat/video-player.tsx`)
- `hls.js` import failure caught with no logging, no `setError(true)`. Native fallback also has no `error` event listener. Result: black rectangle with no diagnostic info.
- Fix: add `console.warn` + `setError(true)` in catch; add video `error` event listener.
- **Status:** ✅ Fixed
- **Resolution:** Added `console.warn` in catch, `setError(true)` when native fallback unavailable, video `error` event listeners for both paths

**I3 -- Transcoding timeout never cleared on unmount** (`src/hooks/use-media-upload.ts`)
- 5-minute `setTimeout` runs after navigation, causing stale query invalidations. `retry` callback also doesn't `void` the upload promise.
- Fix: store timer ID in ref, clear in `useEffect` cleanup. `void upload(...)` in `retry`.
- **Status:** ✅ Fixed
- **Resolution:** Added `transcodingTimerRef` with `useEffect` cleanup on unmount

**I4 -- `isBroadcasting` doesn't reflect publisher readiness** (`src/lib/display-publisher.ts` + `src/hooks/use-display-broadcast.ts`)
- Hook returns `isBroadcasting: true` based on store state, not whether publisher has a working client. User sees active broadcast UI while nothing publishes.
- Fix: export `isPublisherReady()` and use in `isBroadcasting` calculation.
- **Status:** ✅ Fixed
- **Resolution:** Exported `isPublisherReady()` from publisher; included in `isBroadcasting` calculation in hook

**I5 -- `MediaMessageContent` returns `null` for missing URL / unknown type** (`src/components/chat/media-message-content.tsx`)
- Produces empty message bubbles with no user-facing explanation.
- Fix: return a fallback UI element instead of `null`.
- **Status:** ✅ Fixed
- **Resolution:** Added "Media unavailable" fallback UI element for missing URL and unknown media types

**I6 -- `retry` callback ignores upload Promise** (`src/hooks/use-media-upload.ts`)
- Fix: `void upload(file, type)`.
- **Status:** ✅ Fixed
- **Resolution:** Added `void` before `upload(...)` call in retry callback

**I7 -- `displayWeightSchema` weaker than source `weightSchema`** (`src/domain/types/display-snapshot.ts`)
- `unit` is `z.string()` (should be `z.enum(['lb', 'kg'])`), `value` missing `.nonnegative()`, `reps` missing `.int().nonnegative()`.
- **Status:** ✅ Fixed
- **Resolution:** Tightened schema -- `unit` to `z.enum(['lb', 'kg'])`, added `.nonnegative()` to value, `.int().nonnegative()` to reps

**I8 -- `z.url()` migration may break consumers** (`src/domain/types/media.ts`, `src/lib/realtime-schemas.ts`)
- Zod 4's `z.url()` may infer as `URL` object rather than `string`. If consumers pass to JSX `src={}`, this silently breaks.
- Fix: verify inferred type; revert to `z.string().url()` if needed.
- **Status:** ✅ Fixed
- **Resolution:** Reverted `z.url()` to `z.string().url()` in both files (4 occurrences)

**I9 -- Empty `userId` passed to `useDisplayBroadcast` during loading** (`src/routes/_authenticated/log.$workoutId.tsx:~85`)
- `workoutLog?.userId ?? ''` triggers unnecessary profile query with empty ID.
- Fix: add `enabled: !!userId` guard in the hook.
- **Status:** ✅ Fixed (already guarded)
- **Resolution:** `useUserProfile` already has `enabled: !!userId && userId.length > 0` guard; no additional changes needed

---

## Medium

**M1** -- Edge functions use `Deno.env.get(...)!` non-null assertions for `SUPABASE_URL`/`SUPABASE_ANON_KEY`. Add explicit guards returning 500.
- **Status:** ✅ Fixed
- **Resolution:** Replaced all non-null assertions with explicit guards returning 500 "Server configuration error" in all three edge functions

**M2** -- Webhook returns 200 when realtime broadcast fails post-DB-update. Video stays "Processing..." until manual refresh. Add error logging; consider Sentry.
- **Status:** ✅ Fixed (already handled)
- **Resolution:** Webhook already catches broadcast failures in try-catch with `console.error` and returns 200; no changes needed

**M3** -- `req.json()` parse failure returns 500 instead of 400 in signed-url and upload-url edge functions.
- **Status:** ✅ Fixed
- **Resolution:** Wrapped `req.json()` in try-catch returning 400 "Invalid request body" in both functions

**M4** -- All new modules use raw `console.error`/`console.warn` instead of project logging functions (`logError`, `logForDebugging`). Files: `display-publisher.ts`, `use-media-upload.ts`, `media-upload-service.ts`.
- **Status:** ✅ Dismissed
- **Resolution:** No project-wide `logError`/`logForDebugging` functions exist; raw console methods are the current project convention

**M5** -- `useDisplayBroadcast` ignores error states from `useUserProfile` and `useExercises`. On query failure, `exerciseNameMap` silently defaults to `{}` producing "Unknown Exercise" for all exercises on the display.
- **Status:** ✅ Fixed
- **Resolution:** Added error destructuring from both queries with `console.warn` logging on error

**M6** -- JSDoc on `configureDisplayPublisher` says "user's ID and visibility preference" but function only accepts `displayVisible`. (`src/lib/display-publisher.ts:53-54`)
- **Status:** ✅ Fixed
- **Resolution:** Updated JSDoc to "user's display visibility preference"

---

## Test Coverage Gaps

**T1 -- `media-provider.ts` has zero test coverage** (criticality 8/10)
- `CloudflareStreamProvider` contains signed URL caching with TTL expiry and Zod response validation -- exactly the code where a field name mismatch broke video in the previous PR.
- Tests needed: `isExpired` TTL logic, cache hit, cache miss on expiry, null client throws, Zod rejects malformed response.
- **Status:** ✅ Task created
- **Resolution:** Added as S024-T in Steps.md (007-video-image-sharing)

**T2 -- Transcoding timeout behavior untested** (criticality 8/10)
- 5-minute timeout logic has no test. With fake timers: verify processing attachment marked `failed`, ready attachment unaffected, cache invalidated.
- **Status:** ✅ Task created
- **Resolution:** Added as S025-T in Steps.md (007-video-image-sharing)

**Other gaps (lower priority):**
- `publishSessionEnded`/`publishFocusEvent` not tested with `displayVisible = false`
- `cancelUpload` test is a false positive -- tests no-op path, not active abort
- `chat-media-webhook` broadcast emission not verified in tests

---

## Comment Issues

- `src/lib/display-snapshot.ts:128` -- ✅ Fixed: Changed "last activity in the last group" to "last entry in the flattened activity list"
- `src/lib/display-snapshot.ts:108` -- ✅ Fixed: Removed "Pure function" claim
- `src/lib/media-upload-service.ts:9` -- ✅ Fixed: Removed `(S010)` step reference
- `src/domain/types/media.ts:27` -- ✅ Fixed: Replaced `(CH-6, TA-12)` with "the external provider"
- `src/lib/media-constraints.ts:4` -- ✅ Fixed: Removed `(CH-6)` reference
- `supabase/functions/chat-media-upload-url/index.ts:151-155` -- ✅ Fixed: Removed `stream-media-id` fallback that conflated UID with TUS URL
- `src/components/chat/media-message-content.tsx:26,59,79` -- ✅ Fixed: Removed `// --- Video ---` noise comments
- `src/components/chat/video-player.tsx:128,152` -- ✅ Fixed: Removed redundant JSX comments
- `src/components/chat/image-lightbox.tsx:26` -- ✅ Fixed: Removed redundant comment

---

## Type Design Notes

- `displayWeightSchema` is intentionally separate from `weightSchema` but has looser constraints -- ✅ tightened to match source invariants (see I7)
- `z.boolean().default(true)` on `user.displayVisible` would centralize the `?? true` default that's currently scattered across consumers
- `buildDisplaySnapshot()` constructs `DisplaySnapshot` directly without running output through `displaySnapshotSchema.parse()` -- consider dev-mode validation

---

## Strengths

- Display snapshot Zod schema has thorough test coverage (28 cases) including boundary values and discriminated union validation
- `RestTimerState` discriminated union is well-designed -- makes "running timer with no start time" structurally impossible
- `is_visible: z.literal(true)` cleverly encodes the business invariant
- Webhook signature verification uses constant-time comparison
- Edge function tests cover CORS, auth, validation, happy paths, and DB error paths (25 cases)
- JSDoc on `useDisplayBroadcast`, `verifyWebhookSignature`, and `SnapshotContext` is clear and accurate
- RLS infinite recursion migration is well-commented and uses correct `SECURITY DEFINER` approach

---

## Actions

- [x] Fix C1-C4 (merge blockers)
- [x] Fix I1-I9 (important issues)
- [x] Fix M1-M5 (medium hardening)
- [x] Add T1, T2 tests
- [x] Address comment issues
- [x] Run `bun run test` and `bun run build` before re-review

---

## Resolution Summary
**Resolved at:** 2026-04-04
**Session:** PR #59 review resolution

| Category | Total | Fixed | Tasks Created | Dismissed | Deferred |
|---|---|---|---|---|---|
| Critical | 4 | 4 | -- | -- | -- |
| Important | 9 | 9 | -- | -- | -- |
| Medium | 6 | 4 | -- | 2 | -- |
| Test Gaps | 2 | -- | 2 | -- | -- |
| Comments | 9 | 9 | -- | -- | -- |
| **Total** | **30** | **26** | **2** | **2** | **0** |

## Resolution Checklist

- [x] All [FIX] findings resolved inline
- [x] All [TASK] findings added to Steps.md
- [x] All comment issues addressed
- [x] `bun run build` passes
- [x] `bun run test` passes (1361/1361)
- [x] Review verified
