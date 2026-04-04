# Spec: Video + Image Sharing (Step 25)

**Feature:** 007-video-image-sharing
**Status:** Draft
**Created:** 2026-04-03
**Source:** `docs/implementation-plan.md` Step 25, `docs/12-prd-chat.md` Media Sharing + Video Platform Integration, `docs/07-architecture.md` Media Provider Interface + Edge Functions, `docs/06-invariants.md` CH-1 through CH-8, `docs/08-erd.md` Chat Tables

---

## Overview

Add video, image, and file sharing to chat conversations. Videos upload to Cloudflare Stream via TUS protocol with transcoding progress. Images and files upload to Supabase Storage. Both use signed URLs for access control gated by conversation membership. The attachment picker (currently stubbed) becomes functional, and the message bubble gains media rendering states (processing, ready, failed). Two Supabase Edge Functions handle the Cloudflare integration: one proxies upload URL generation, the other receives transcoding webhooks.

## Problem Statement

The chat system (Steps 21-23) supports text and workout messages but has no media pipeline. The attachment picker shows "Coming soon" for all four options. Users need to share lift critique videos, progress photos, and training documents within conversations. The `media_attachments` table, domain types, adapter methods, and Tauri commands all exist as metadata plumbing -- what's missing is the binary upload path, the Cloudflare Stream integration, the Supabase Storage bucket configuration, and the UI to select, upload, and render media.

## User Stories

1. **As a lifter**, I can record a 30-second squat video and share it to my group chat so my training partners can critique my form.
2. **As a lifter**, I can share a progress photo in a direct conversation so my training partner can see my results.
3. **As a coach**, I can share a training document (PDF) to a group conversation so all members can access it.
4. **As a chat participant**, I can see a progress bar while my video uploads, and a pulsing placeholder while it transcodes, so I know the system is working.
5. **As a chat participant**, I can tap a video thumbnail to play it inline, or tap an image to view it full-screen.
6. **As a chat participant**, I can tap "Download" on a file card to save the document to my device.
7. **As a chat participant**, I see a clear message when I try to share media while offline, because media uploads require connectivity.
8. **As a chat participant**, I can tap "Retry" when a video transcoding or upload fails.

## Requirements

### Must Have (P0)

| ID | Requirement | Invariant | Verification |
|----|-------------|-----------|--------------|
| M1 | Video uploads use Cloudflare Stream via TUS protocol with resumable uploads | -- | Upload a 30s video, interrupt network mid-upload, resume completes |
| M2 | `chat-media-upload-url` Edge Function returns TUS upload URL after auth verification | -- | Unauthenticated request returns 401; authenticated returns valid URL |
| M3 | `chat-media-webhook` Edge Function processes `ready.to.stream` and `encoding.failed` events | -- | Mock webhook payload updates `media_attachments.status` correctly |
| M4 | Images upload to Supabase Storage `chat-images` bucket | -- | Upload JPEG, verify file exists in bucket |
| M5 | Files upload to Supabase Storage `chat-files` bucket with allowlist enforcement | -- | Upload PDF succeeds; upload .exe rejected before upload |
| M6 | Video constraints enforced: duration <= 60s, size <= 50 MB | -- | Reject 90s video with inline error before upload starts |
| M7 | Image constraints enforced: size <= 10 MB, formats JPEG/PNG/WebP/HEIC | -- | Reject 15 MB file with inline error |
| M8 | File constraints enforced: size <= 25 MB, allowlist/blocklist | -- | Reject .sh file; accept .pdf |
| M9 | Media uploads require connectivity -- offline attempts show clear message | CH-6 | Toggle airplane mode, attempt upload, verify error message |
| M10 | Media binaries are never stored in or synced to local SQLite | CH-6 | Check SQLite after media message -- only metadata rows exist |
| M11 | Signed URL access control for video playback -- only conversation participants can play | CH-1 | Non-participant request for signed URL returns 403 |
| M12 | Message bubble renders four media states: processing, ready (video), ready (image/file), failed | -- | Visual inspection across all states |
| M13 | Attachment picker is functional for Video, Photo, and File options | -- | Each option opens native picker/camera |
| M14 | Upload progress displayed as horizontal bar in `ember` on `surface-steel` track | -- | Visual inspection during upload |
| M15 | Webhook shared secret validation rejects unsigned requests | -- | Unsigned POST to webhook endpoint returns 403 |
| M16 | Cloudflare Stream API token stored in Supabase Vault, never exposed to client | -- | Network inspector shows no Cloudflare credentials in client requests |

### Should Have (P1)

| ID | Requirement | Verification |
|----|-------------|--------------|
| S1 | Video plays inline with HLS (hls.js or Cloudflare embedded player) with full-screen toggle | Tap thumbnail, video plays in conversation; tap full-screen |
| S2 | Image tap opens full-screen lightbox viewer | Tap image preview, verify full-screen overlay |
| S3 | Thumbnails cached locally for offline display in Tauri mode | View media message online, go offline, thumbnail still visible |
| S4 | Signed playback URLs cached client-side for their 1-hour TTL | Play video twice -- second play does not trigger Edge Function call |
| S5 | Transcoding timeout: status set to `failed` after 5 minutes with no webhook | Send video, block webhook, verify status transitions after timeout |
| S6 | Broadcast event sent on transcoding completion for real-time UI update | Connected participant sees processing-to-ready transition without refresh |

### Won't Have (this step)

| ID | Exclusion | Reason |
|----|-----------|--------|
| W1 | Video editing or trimming before upload | Complexity; users can trim in their phone's native camera app |
| W2 | Image resizing or compression before upload | Deferred; phone cameras produce reasonable sizes |
| W3 | Inline file preview (PDF viewer, document rendering) | Deferred; download-only for initial release |
| W4 | Message edit or delete for media messages | CH-7: messages are append-only |
| W5 | Multiple attachments per message | Future expansion; schema supports it but UI sends one |
| W6 | Push notifications for media messages | Decision 29: push notifications deferred |
| W7 | Media upload while offline with queue | CH-6: media binaries are cloud-only |

## Testable Assertions

| ID | Assertion | How to Test |
|----|-----------|-------------|
| TA-1 | Video upload from mobile: select/record -> progress bar -> playable thumbnail | Record 30s video, share to conversation, observe full lifecycle |
| TA-2 | Video constraints enforced (60s duration, 50 MB size) | Attempt to share a 90s video; verify rejection with inline error |
| TA-3 | Image upload to Supabase Storage works with inline preview rendering | Share a JPEG photo, verify it appears as inline preview (max-width 280px) |
| TA-4 | Image constraints enforced (10 MB, JPEG/PNG/WebP/HEIC) | Attempt 15 MB file; verify rejection |
| TA-5 | File upload works with allowlist enforcement and file card rendering | Share a PDF, verify file card with icon, filename, size, download button |
| TA-6 | File constraints enforced (25 MB, blocked extensions) | Attempt .exe, .sh files; verify rejection messages |
| TA-7 | Processing state renders pulsing placeholder with "Processing..." label | Share video, observe placeholder before transcoding completes |
| TA-8 | Failed state renders with retry option | Simulate transcoding failure; verify error icon and "Retry" button |
| TA-9 | Signed URL access control prevents unauthorized video playback | Request signed URL for a conversation the user is not in; verify 403 |
| TA-10 | Media uploads blocked offline with clear error message | Enable airplane mode, attempt upload, verify error |
| TA-11 | `chat-media-upload-url` Edge Function authenticates and returns valid TUS URL | Call Edge Function with valid auth; verify TUS URL returned |
| TA-12 | `chat-media-webhook` processes ready and failed events correctly | POST mock payloads; verify `media_attachments` rows updated |
| TA-13 | Media provider interface is swappable (Cloudflare implementation isolated) | Code review: all Cloudflare-specific logic behind `MediaProvider` interface |
| TA-14 | All media UI follows Iron & Ember palette (zero border-radius, tonal layering) | Visual inspection of all media rendering states |
| TA-15 | `original_filename` and `mime_type` stored in `media_attachments` for files | Query `media_attachments` after file upload; verify columns populated |
| TA-16 | Broadcast event triggers real-time processing-to-ready transition | Connected participant sees video thumbnail appear without page refresh |

## Open Questions

| ID | Question | Impact | Resolution |
|----|----------|--------|------------|
| OQ-1 | Should file messages use `message_type = 'file'` (requires CHECK constraint update) or `message_type = 'media'` with `media_type = 'file'` on the attachment? | Migration complexity, message rendering logic | **Resolved:** Use `message_type = 'media'` for all three (video, image, file). Discriminate via `media_type` on the `media_attachments` row. The `messages.message_type` CHECK constraint stays unchanged. Only `media_attachments.media_type` CHECK gains `'file'`. Simplifies rendering: media messages always look at their attachment's `media_type`. |
| OQ-2 | The ERD defines `file_size_bytes` as NOT NULL but the PRD says nullable. Which is correct? | Affects whether we require size on all uploads | **Resolved:** Nullable. PRD wins. ERD should be updated to match. Camera capture may not report size on all platforms before upload. |
| OQ-3 | Should the `chat-media-upload-url` Edge Function also handle image upload URL generation, or do images upload directly to Supabase Storage via the client SDK? | Determines whether images need an Edge Function | **Resolved:** Images and files upload directly via Supabase Storage client SDK with the user's auth token. Only video needs the Edge Function (sole purpose: isolate the Cloudflare API token). |
| OQ-4 | Does `media_attachments` need an index on `message_id` for JOIN performance? | Query performance for message-with-attachment loading | **Resolved:** Yes. Add `CREATE INDEX idx_media_attachments_message ON media_attachments(message_id)`. Essential for both the retention cleanup JOIN and message detail rendering. Should have been in the original schema. |

## Dependencies

### Upstream (required before this step)

| Dependency | Status | Notes |
|------------|--------|-------|
| Step 21: Chat Data Layer | Complete | `media_attachments` table, domain types, adapter methods |
| Step 22: Supabase Realtime | Complete | Broadcast channels for transcoding status updates |
| Step 23: Chat UI | Complete | Attachment picker (stubbed), compose bar, message bubble |
| Cloudflare Stream account | Not started | Must be provisioned before development begins |
| Supabase Vault | Available | For storing Cloudflare API token |

### Downstream (blocked by this step)

| Dependent | Step | What it needs |
|-----------|------|---------------|
| Step 26: Message Retention | 26 | Media asset deletion when messages expire (Cloudflare Stream API + Storage delete) |
| Milestone 8: Lift Critique Video | -- | End-to-end video sharing flow |
