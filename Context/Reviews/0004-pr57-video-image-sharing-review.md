# PR #57 Review: Video, Image, and File Sharing (Feature 007)

**Date:** 2026-04-03
**PR:** [feat(chat): video, image, and file sharing](https://github.com/rghsoftware/ardent-forge/pull/57)
**Branch:** `feat/video-image-sharing` -> `main`
**Feature:** Context/Features/007-video-image-sharing/
**Decision:** Request changes (4 critical, 10 important)
**Status:** Resolved

---

## Scope

Full-stack media sharing feature reviewed across 41 files, 4,370 additions.

| Layer | Files Reviewed |
|---|---|
| Frontend components | attachment-picker, compose-bar, file-card, image-lightbox, media-message-content, media-status-indicator, message-bubble, message-list, upload-progress, video-player |
| Hooks | use-media-attachments, use-media-upload, use-metadata |
| Services / lib | media-constraints, media-provider, media-upload-service, realtime-manager, realtime-schemas, supabase-adapter, supabase, tauri-adapter, data-adapter |
| Edge Functions | chat-media-signed-url, chat-media-upload-url, chat-media-webhook |
| Migrations | 20260403000001_fix_rls_infinite_recursion, 20260403000002_media_storage |
| Rust | src-tauri/src/commands/chat.rs |
| Tests | media-constraints.test.ts (NEW), media-upload-service.test.ts (NEW), supabase.test.ts |

---

## Critical Issues (Must Fix Before Merge)

### C1: Storage RLS download policies allow cross-conversation file access (SECURITY)
**Files:** `supabase/migrations/20260403000002_media_storage.sql:48-81`
**Status:** Fixed
**Resolution:** Added `AND ma.provider_asset_id = storage.objects.name` to both SELECT policy subqueries.

The `chat_images_select_participant` and `chat_files_select_participant` policies check only that the user participates in *any* conversation with *any* media -- they do not correlate the requested storage object to a specific attachment. Any authenticated user in at least one conversation can read every file in the bucket.

**Fix:** Add `AND ma.provider_asset_id = storage.objects.name` to both SELECT policy subqueries.

---

### C2: File download uses wrong storage bucket -- all file downloads silently fail
**File:** `src/components/chat/message-list.tsx:210`
**Status:** Fixed
**Resolution:** Changed bucket to `'chat-files'`; added `console.error` to catch block.

`handleFileDownload` hardcodes `'chat-images'` but files are uploaded to `'chat-files'` (media-upload-service.ts:135). The empty `catch {}` block hides the failure from the user.

**Fix:** Use `'chat-files'` bucket for file downloads; add error feedback to user.

---

### C3: `signedUrl` vs `url` field name mismatch -- video playback silently broken
**Files:** `supabase/functions/chat-media-signed-url/index.ts:207` (returns `signedUrl`) vs `src/lib/media-provider.ts:80` (casts as `url`)
**Status:** Fixed
**Resolution:** Updated media-provider.ts to parse `signedUrl` from response and map to `url` in `CachedSignedUrl`. Also replaced `as` cast with Zod validation (I10).

At runtime `data.url` is always `undefined`. The `as` cast hides the mismatch. Video playback will never work.

**Fix:** Align field names -- either rename edge function response from `signedUrl` to `url`, or update the client cast and `MediaProvider` interface to expect `signedUrl`. Update `CachedSignedUrl` interface accordingly.

---

### C4: Webhook thumbnail URL uses video UID as Cloudflare customer subdomain
**File:** `supabase/functions/chat-media-webhook/index.ts:141`
**Status:** Fixed
**Resolution:** Reads `CLOUDFLARE_ACCOUNT_ID` from env and uses it in the subdomain.

The fallback thumbnail URL puts `event.uid` (video UID) in the subdomain that should be the account ID. Points to a nonexistent host.

**Fix:** Read `CLOUDFLARE_ACCOUNT_ID` from env (same as other edge functions) and use it in the subdomain.

---

## Important Issues (Should Fix)

### I1: Empty catch blocks on video play and file download
**File:** `src/components/chat/message-list.tsx:190-198, 206-219`
**Status:** Fixed
**Resolution:** Added `console.error` logging to both catch blocks.

`handleVideoPlay` and `handleFileDownload` both have empty `catch {}` blocks. Users get no feedback when these operations fail. At minimum add `console.error` logging; ideally surface errors via toast or error state.

---

### I2: AbortController created but never wired to Supabase Storage upload
**File:** `src/lib/media-upload-service.ts:93,101,131,139`
**Status:** Fixed
**Resolution:** Removed dead AbortController from image/file upload paths. Added comments documenting that Supabase Storage does not support abort signals; only TUS video uploads support true cancellation.

`this.abortController` is created in `uploadImage` and `uploadFile` but its `.signal` is never passed to `client.storage.upload()`. The cancel button resets UI state but the upload continues in the background consuming bandwidth.

**Fix:** Pass `this.abortController.signal` to the Supabase upload options, or remove the dead AbortController and document that image/file upload cancellation is not supported.

---

### I3: Transcoding timeout only logs console.warn -- spec requires marking status `failed`
**File:** `src/hooks/use-media-upload.ts:88-94`
**Status:** Fixed
**Resolution:** Timeout now checks if attachment is still `processing`, calls `adapter.updateMediaAttachment(att.id, { status: 'failed' })`, and invalidates both messages and media-attachments query caches.

Spec (S5) and tech plan (TD-8) specify the client should mark the attachment status `failed` after 5 minutes with no webhook. The current implementation only emits a `console.warn`. Videos stuck in "Processing..." stay that way indefinitely.

**Fix:** After the timeout, call `adapter.updateMediaAttachment(attachmentId, { status: 'failed' })` and invalidate the query cache.

---

### I4: Webhook realtime broadcast failures are fire-and-forget
**File:** `supabase/functions/chat-media-webhook/index.ts:160-169, 183-193`
**Status:** Fixed
**Resolution:** Wrapped both broadcast calls (ready and failed events) in try/catch with `console.error` logging.

If the `supabaseAdmin.channel(...).send(...)` broadcast fails, the webhook returns 200 OK to Cloudflare (no retry), the database is already updated, but the client never receives notification and stays stuck in "Processing..." state.

**Fix:** Wrap broadcast in try/catch, log failures. Note: the 200 response to Cloudflare is still correct (DB updated), but failures should be logged for monitoring.

---

### I5: Realtime schema `thumbnail_url`/`playback_url` typed as `optional()` but webhook sends explicit `null`
**Files:** `src/lib/realtime-schemas.ts`, `supabase/functions/chat-media-webhook/index.ts:188-189`
**Status:** Fixed
**Resolution:** Changed both fields to `z.url().nullish()` in realtime-schemas.ts.

Zod `z.url().optional()` accepts `undefined` but not `null`. The webhook broadcasts explicit `null` for failed events. `safeParse` silently rejects failure-state broadcasts.

**Fix:** Change to `z.url().nullish()` for both fields.

---

### I6: Zod 4 `z.string().url()` deprecation inconsistency
**File:** `src/domain/types/media.ts:37-38`
**Status:** Fixed
**Resolution:** Changed `z.string().url().optional()` to `z.url().optional()` for both fields.

The most recent commit (`eb83a88`) fixed this in `realtime-schemas.ts` but `media.ts` still uses the deprecated form for `thumbnailUrl` and `playbackUrl`.

**Fix:** Change to `z.url()` in `media.ts`.

---

### I7: Duplicate index on `media_attachments(message_id)`
**File:** `supabase/migrations/20260403000002_media_storage.sql:86-91`
**Status:** Fixed
**Resolution:** Removed duplicate `CREATE INDEX` statement; retained note that `idx_media_message` already exists from prior migration.

Migration comment acknowledges `idx_media_message` was created in a previous migration on the same column. The new `idx_media_attachments_message` is a redundant index on the same column and table, wasting disk space and slowing writes.

**Fix:** Remove the duplicate index creation, or drop `idx_media_message` if the new name is preferred.

---

### I8: Incorrect `CH-12` invariant references -- should be `CH-6`
**Files:** `src/lib/media-constraints.ts:4`, `src/lib/media-provider.ts:4`, `src/domain/types/media.ts:27`
**Status:** Fixed
**Resolution:** Replaced `(CH-12)` with `(CH-6)` in all three files.

The relevant invariant is `CH-6: Media Binaries Are Cloud-Only`. `CH-12` does not exist. The Spec.md and Tech.md for this feature correctly reference `CH-6`.

**Fix:** Replace `(CH-12)` with `(CH-6)` in all three locations.

---

### I9: `useMediaAttachments` error state not consumed in message-list
**Files:** `src/hooks/use-media-attachments.ts:58`, `src/components/chat/message-list.tsx:183`
**Status:** Fixed
**Resolution:** Destructured `error: mediaError` and added `console.error` logging when the query fails.

The hook exposes `error` but `message-list.tsx` only destructures `{ attachments }`. If the query fails, all media messages permanently show "Processing..." with no error indication.

**Fix:** Destructure and handle the `error` state from `useMediaAttachments`.

---

### I10: Unsafe `as` casts on edge function responses
**File:** `src/lib/media-provider.ts:50, 80`
**Status:** Fixed
**Resolution:** Added `uploadUrlResponseSchema` and `signedUrlResponseSchema` Zod schemas; replaced both `as` casts with `safeParse` validation that throws on invalid responses.

`response.data` from `supabase.functions.invoke` is cast directly to typed shapes without runtime validation. If the edge function response shape changes, these silently produce incorrect data.

**Fix:** Validate with Zod schemas instead of `as` casts, consistent with how realtime payloads are handled.

---

## Suggestions

| # | Suggestion | File(s) |
|---|-----------|---------|
| S1 | Add `satisfies Record<MediaType, unknown>` to `MEDIA_CONSTRAINTS` for compile-time exhaustiveness | `media-constraints.ts` |
| S2 | Model `UploadResult` as discriminated union on `mediaType` (currently flat interface with all-optional fields) | `media-upload-service.ts` |
| S3 | Add Zod schemas for edge function request validation (replace manual `typeof` checks) | `supabase/functions/*` |
| S4 | Extract duplicated `extractExtension` utility (exists in both `media-constraints.ts` and `media-upload-service.ts`) | Both files |
| S5 | Add `allowedMimeTypes` to `file` constraint group for client-side defense-in-depth | `media-constraints.ts` |
| S6 | Test: add Storage upload error paths (mock returning error response) | `media-upload-service.test.ts` |
| S7 | Test: add TUS `onError` path (mock always calls `onSuccess` currently) | `media-upload-service.test.ts` |
| S8 | Test: add video duration rejection >60s and metadata error paths | `media-constraints.test.ts` |
| S9 | Test: Edge Functions have zero coverage (~605 lines of server logic) | new test files |
| S10 | Use constant-time comparison for webhook signature verification | `chat-media-webhook/index.ts` |
| S11 | Remove obvious noise comments `{/* Video */}`, `{/* Photo */}` | `attachment-picker.tsx` |
| S12 | Fix `isExpired` JSDoc: "within 60 seconds" is ambiguous -- should say "will expire within the next 60 seconds" | `media-provider.ts:90` |

---

## Strengths

- Clean upload pipeline architecture: service, provider interface, hooks, components well-separated
- Webhook signature verification correctly implemented (HMAC-SHA256)
- Rust commands use proper `Result<T, AppError>` with domain-specific variants
- `ValidationResult` discriminated union is well-designed (type score: 8.8/10)
- `MediaStatusBroadcastPayload` correctly uses `safeParse` at the trust boundary
- Defense-in-depth on file types: both allowlist and blocklist for extensions
- Thorough feature documentation (Spec, Tech, Steps all complete)
- All 26 existing tests pass; new test infrastructure is solid

---

## Test Coverage Summary

| Coverage Area | Status |
|---|---|
| `media-constraints.ts` -- happy paths | Good |
| `media-constraints.ts` -- duration rejection >60s | Missing |
| `media-upload-service.ts` -- success paths | Good |
| `media-upload-service.ts` -- Storage error paths | Missing |
| `media-upload-service.ts` -- TUS error path | Missing |
| `media-upload-service.ts` -- cancel actually aborts | Not verified by test |
| Supabase Edge Functions | Zero coverage |
| `media-provider.ts` -- signed URL cache TTL | Missing |

---

## Actions Required

### Before merge (critical)
- [x] Fix RLS policies: add path correlation to SELECT policies (C1)
- [x] Fix file download bucket: `chat-images` -> `chat-files` (C2)
- [x] Fix field name mismatch: `signedUrl` vs `url` (C3)
- [x] Fix thumbnail URL: use `CLOUDFLARE_ACCOUNT_ID` not `event.uid` (C4)

### Before merge (important)
- [x] Add error feedback to video play and file download handlers (I1)
- [x] Fix or remove dead AbortController in image/file upload (I2)
- [x] Implement transcoding timeout status update to `failed` (I3)
- [x] Wrap webhook broadcast in try/catch with error logging (I4)
- [x] Fix realtime schema null/optional mismatch (I5)
- [x] Fix `z.string().url()` -> `z.url()` in `media.ts` (I6)
- [x] Remove duplicate migration index (I7)
- [x] Fix `CH-12` -> `CH-6` references (I8)
- [x] Handle `useMediaAttachments` error state in message-list (I9)
- [x] Replace unsafe `as` casts with Zod validation in media-provider (I10)

---

## Resolution Summary
**Resolved at:** 2026-04-03
**Session:** Review resolve -- fix all critical and important findings

| Category | Total | Fixed | Tasks Created | ADRs | Rules | Dismissed | Deferred |
|---|---|---|---|---|---|---|---|
| Critical | 4 | 4 | -- | -- | -- | -- | -- |
| Important | 10 | 10 | -- | -- | -- | -- | -- |
| **Total** | **14** | **14** | **0** | **0** | **0** | **0** | **0** |

---

## Related Artifacts

- Feature spec: Context/Features/007-video-image-sharing/Spec.md
- Tech plan: Context/Features/007-video-image-sharing/Tech.md
- Implementation steps: Context/Features/007-video-image-sharing/Steps.md
- PR: https://github.com/rghsoftware/ardent-forge/pull/57
