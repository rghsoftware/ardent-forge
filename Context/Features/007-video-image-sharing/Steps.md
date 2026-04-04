# Steps: Video + Image Sharing (Step 25)

**Feature:** 007-video-image-sharing
**Status:** Draft
**Created:** 2026-04-03

---

## Team Composition

| Role | Agent | Scope |
|------|-------|-------|
| `backend-specialist` | backend-specialist | Migration, Edge Functions (Deno), Rust command, realtime schema |
| `frontend-specialist-1` | frontend-specialist-1 | Upload pipeline: constraints, provider interface, upload service, hooks |
| `frontend-specialist-2` | frontend-specialist-2 | Media rendering: message content, video player, lightbox, file card, progress/status |
| `frontend-specialist-3` | frontend-specialist-3 | Integration: attachment picker, compose bar, message bubble/list wiring, realtime UI |
| `quality-engineer` | quality-engineer | Validation and unit tests |

---

## Wave 1: Foundation (Infrastructure + Packages)

### S001: Storage buckets migration + missing index

**Agent:** backend-specialist
**Files:** `supabase/migrations/20260403000001_media_storage.sql`
**Depends on:** Nothing
**Parallel:** Yes (independent of S002-S005)

- [ ] Create migration file `20260403000001_media_storage.sql`
- [ ] Create `chat-images` storage bucket: private, 10 MB limit, MIME types `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- [ ] Create `chat-files` storage bucket: private, 25 MB limit, MIME types for PDF, DOC/DOCX, XLS/XLSX, CSV, TXT, ZIP
- [ ] Create storage RLS policy for upload: `auth.uid() IS NOT NULL`
- [ ] Create storage RLS policy for download: conversation participation check via `media_attachments -> messages -> conversation_participants`
- [ ] Add missing index: `CREATE INDEX idx_media_attachments_message ON media_attachments(message_id)`
- [ ] Test migration applies cleanly against local Supabase

**Acceptance:** Buckets exist, RLS enforces auth on upload and membership on download, index exists (TA-3, TA-5)

### S002: Install packages + media constraints module

**Agent:** frontend-specialist-1
**Files:** `package.json`, `src/lib/media-constraints.ts`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001, S003-S005)

- [ ] Install `tus-js-client` and `hls.js` via bun
- [ ] Create `src/lib/media-constraints.ts` with centralized validation constants:
  - Video: 50 MB max, 60s max duration, MP4/MOV/WebM
  - Image: 10 MB max, JPEG/PNG/WebP/HEIC
  - File: 25 MB max, allowlist (pdf, doc, docx, xls, xlsx, csv, txt, zip), blocklist (exe, bat, sh, cmd, ps1, msi, app, dmg, jar, com, scr, vbs, wsf)
- [ ] Export `validateFile(file: File, type: 'video' | 'image' | 'file'): ValidationResult` helper
- [ ] `ValidationResult` returns `{ valid: true }` or `{ valid: false, error: string }` with user-facing message
- [ ] Video duration validation via `HTMLVideoElement.duration` (create object URL, load metadata, read duration)
- [ ] Verify `bun run build` succeeds with new packages

**Acceptance:** Constraints reject invalid files with correct error messages (TA-2, TA-4, TA-6)

### S003: MediaProvider interface + Cloudflare implementation

**Agent:** frontend-specialist-1
**Files:** `src/lib/media-provider.ts`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001, S002, S004, S005)

- [ ] Define `MediaProvider` interface:
  - `getUploadUrl(metadata: { maxDurationSeconds: number }): Promise<{ tusUrl: string; assetId: string }>`
  - `getSignedPlaybackUrl(assetId: string, conversationId: string): Promise<{ url: string; expiresAt: string }>`
- [ ] Implement `CloudflareStreamProvider` that calls Edge Functions:
  - `getUploadUrl` calls `chat-media-upload-url` Edge Function
  - `getSignedPlaybackUrl` calls `chat-media-signed-url` Edge Function
- [ ] Provider reads Supabase function URL from existing config
- [ ] Provider sends user JWT in Authorization header
- [ ] Export factory: `getMediaProvider(): MediaProvider`
- [ ] Signed URL cache: `Map<assetId, { url, expiresAt }>` with TTL check before returning cached URL

**Acceptance:** Interface is swappable -- Cloudflare-specific logic isolated behind interface (TA-13)

### S004: Adapter extensions -- getMediaAttachments + updateMediaAttachment

**Agent:** backend-specialist
**Files:** `src/lib/data-adapter.ts`, `src/lib/supabase-adapter.ts`, `src/lib/tauri-adapter.ts`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001-S003, S005)

- [ ] Add `getMediaAttachments(messageIds: string[]): Promise<MediaAttachment[]>` to `DataAdapter` interface
- [ ] Add `updateMediaAttachment(attachmentId: string, updates: Partial<Pick<MediaAttachment, 'status' | 'thumbnailUrl' | 'playbackUrl' | 'providerAssetId'>>): Promise<MediaAttachment>` to `DataAdapter` interface
- [ ] Implement `getMediaAttachments` in `SupabaseAdapter`: `SELECT * FROM media_attachments WHERE message_id = ANY($1)`
- [ ] Implement `updateMediaAttachment` in `SupabaseAdapter`: partial UPDATE on `media_attachments`
- [ ] Implement `getMediaAttachments` in `TauriAdapter`: invoke `get_media_attachments` Rust command
- [ ] Implement `updateMediaAttachment` in `TauriAdapter`: invoke `save_media_attachment` with existing ID (upsert)

**Acceptance:** Both adapters return correct attachment data for a batch of message IDs

### S005: Rust get_media_attachments command

**Agent:** backend-specialist
**Files:** `src-tauri/src/commands/chat.rs`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001-S004)

- [ ] Add `get_media_attachments` Tauri command accepting `message_ids: Vec<String>`
- [ ] Query SQLite: `SELECT * FROM media_attachments WHERE message_id IN (?...)` with dynamic binding
- [ ] Return `Vec<MediaAttachmentRow>` mapped through existing row struct
- [ ] Register command in Tauri command handler

**Acceptance:** Rust command returns correct attachments for a batch of message IDs

---

## Wave 2: Edge Functions (backend-specialist, parallel with Waves 3-4)

### S006: chat-media-upload-url Edge Function

**Agent:** backend-specialist
**Files:** `supabase/functions/chat-media-upload-url/index.ts`
**Depends on:** S001
**Parallel:** Yes (parallel with S007, S008, and all of Waves 3-4)

- [ ] Create `supabase/functions/chat-media-upload-url/index.ts` (Deno runtime)
- [ ] Verify caller is authenticated via JWT from Authorization header
- [ ] Read Cloudflare Stream API token from Supabase Vault (`vault.decrypted_secrets`)
- [ ] Read Cloudflare Account ID from environment variable
- [ ] Validate request body: `{ maxDurationSeconds: number }` -- reject if > 60
- [ ] Call Cloudflare Stream API to create direct creator upload (TUS endpoint):
  - `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/stream?direct_user=true`
  - Set `maxDurationSeconds` and `requireSignedURLs: true`
- [ ] Return `{ tusUrl: string, assetId: string }` from Cloudflare response
- [ ] Return 401 for unauthenticated requests
- [ ] Return 400 for invalid parameters
- [ ] Return 502 for Cloudflare API errors (pass through error message)

**Acceptance:** Authenticated request returns valid TUS URL; unauthenticated returns 401 (TA-11)

### S007: chat-media-webhook Edge Function

**Agent:** backend-specialist
**Files:** `supabase/functions/chat-media-webhook/index.ts`
**Depends on:** S001
**Parallel:** Yes (parallel with S006, S008)

- [ ] Create `supabase/functions/chat-media-webhook/index.ts` (Deno runtime)
- [ ] Validate webhook signature header against shared secret from env var
- [ ] Return 403 for invalid/missing signature
- [ ] Parse Cloudflare Stream webhook payload
- [ ] Handle `ready.to.stream` event:
  - Query `media_attachments` by `provider_asset_id` matching Stream UID
  - Update: `status = 'ready'`, `thumbnail_url` from Stream response, `playback_url` from Stream HLS manifest
  - Look up `conversation_id` via `media_attachments -> messages` join
  - Broadcast `media_status` event on conversation channel with `{ message_id, attachment_id, status: 'ready', thumbnail_url, playback_url }`
- [ ] Handle `encoding.failed` event (Stream event name may vary -- check Cloudflare docs):
  - Update: `status = 'failed'`
  - Broadcast `media_status` event with `{ message_id, attachment_id, status: 'failed' }`
- [ ] Use `service_role` key for database updates (bypass RLS)
- [ ] Return 200 for successfully processed events
- [ ] Return 204 for unrecognized event types (ignore gracefully)

**Acceptance:** Mock webhook payloads update media_attachments correctly (TA-12); unsigned requests rejected (TA-9)

### S008: chat-media-signed-url Edge Function

**Agent:** backend-specialist
**Files:** `supabase/functions/chat-media-signed-url/index.ts`
**Depends on:** S001
**Parallel:** Yes (parallel with S006, S007)

- [ ] Create `supabase/functions/chat-media-signed-url/index.ts` (Deno runtime)
- [ ] Verify caller is authenticated via JWT
- [ ] Parse request body: `{ assetId: string, conversationId: string }`
- [ ] Verify caller is active participant in the conversation (query `conversation_participants` where `user_id = auth.uid()` and `left_at IS NULL`)
- [ ] Return 403 if not a participant
- [ ] Read Cloudflare Stream API token from Supabase Vault
- [ ] Call Cloudflare Stream API to create signed URL with 1-hour TTL
- [ ] Return `{ signedUrl: string, expiresAt: string }`

**Acceptance:** Non-participant gets 403; participant gets valid signed URL (TA-9)

---

## Wave 3: Upload Pipeline (frontend-specialist-1, parallel with Waves 2 and 4)

### S009: Media upload service

**Agent:** frontend-specialist-1
**Files:** `src/lib/media-upload-service.ts`
**Depends on:** S002, S003
**Parallel:** Yes (parallel with Wave 2 and Wave 4)

- [ ] Create `MediaUploadService` class with three upload methods:
  - `uploadVideo(file: File, onProgress: (pct: number) => void): Promise<UploadResult>`
  - `uploadImage(file: File, onProgress: (pct: number) => void): Promise<UploadResult>`
  - `uploadFile(file: File, onProgress: (pct: number) => void): Promise<UploadResult>`
- [ ] Video upload path:
  - Call `mediaProvider.getUploadUrl({ maxDurationSeconds: 60 })`
  - Create `tus.Upload` with TUS URL, chunk size 5 MB, retry delays [0, 1000, 3000, 5000]
  - Wire `onProgress` callback
  - On success return `{ provider: 'cloudflare_stream', providerAssetId: assetId, mediaType: 'video', status: 'processing' }`
- [ ] Image upload path:
  - Generate storage path: `chat-images/{conversationId}/{uuid}.{ext}`
  - Upload via `supabase.storage.from('chat-images').upload(path, file)`
  - On success return `{ provider: 'supabase_storage', providerAssetId: path, mediaType: 'image', status: 'ready', fileSizeBytes, mimeType }`
- [ ] File upload path:
  - Generate storage path: `chat-files/{conversationId}/{uuid}_{sanitizedFilename}`
  - Upload via `supabase.storage.from('chat-files').upload(path, file)`
  - On success return `{ provider: 'supabase_storage', providerAssetId: path, mediaType: 'file', status: 'ready', originalFilename, mimeType, fileSizeBytes }`
- [ ] `cancelUpload()` method aborts active TUS upload or storage upload
- [ ] Export `UploadResult` type

**Acceptance:** All three upload paths produce correct `UploadResult` with appropriate provider and status

### S010: useMediaUpload hook

**Agent:** frontend-specialist-1
**Files:** `src/hooks/use-media-upload.ts`
**Depends on:** S004, S009
**Parallel:** No (sequential after S009)

- [ ] Create `useMediaUpload(conversationId: string)` hook returning:
  - `upload(file: File, type: 'video' | 'image' | 'file'): Promise<void>` -- full orchestration
  - `progress: number` -- 0 to 1
  - `isUploading: boolean`
  - `error: string | null`
  - `cancel(): void`
  - `retry(): void`
- [ ] `upload` orchestration:
  1. Validate file via `validateFile(file, type)` -- set error if invalid, return
  2. Check `navigator.onLine` -- set error "Media uploads require an internet connection" if offline, return
  3. Start upload via `MediaUploadService`
  4. On progress: update `progress` state
  5. On success: call `adapter.sendMessage(conversationId, 'media')` to create message
  6. Then call `adapter.saveMediaAttachment(messageId, uploadResult)` to persist metadata
  7. Invalidate `['messages', conversationId]` query
  8. If video: start 5-minute transcoding timeout via `setTimeout`
  9. On error: set `error` state, expose `retry()`
- [ ] `retry()` re-runs the last upload with the same file and type
- [ ] `cancel()` calls `MediaUploadService.cancelUpload()` and resets state

**Acceptance:** Hook manages full upload lifecycle: validate -> upload -> create message -> save attachment (TA-1, TA-10)

### S011: useMediaAttachments hook

**Agent:** frontend-specialist-1
**Files:** `src/hooks/use-media-attachments.ts`
**Depends on:** S004
**Parallel:** Yes (parallel with S009, S010)

- [ ] Create `useMediaAttachments(messageIds: string[])` hook
- [ ] TanStack Query: key `['media-attachments', ...sortedIds]`, calls `adapter.getMediaAttachments(messageIds)`
- [ ] Returns `Map<messageId, MediaAttachment>` for O(1) lookup in message list rendering
- [ ] `staleTime: 5 * 60 * 1000` (5 min) -- attachments rarely change after reaching `ready`
- [ ] Exposes `updateAttachment(attachmentId, updates)` for optimistic updates from realtime events

**Acceptance:** Hook returns correct attachment map for a batch of message IDs

---

## Wave 4: Rendering Components (frontend-specialist-2, parallel with Waves 2-3)

### S012: MediaStatusIndicator

**Agent:** frontend-specialist-2
**Files:** `src/components/chat/media-status-indicator.tsx`
**Depends on:** Nothing
**Parallel:** Yes (independent of all other Wave 4 tasks)

- [ ] Create `MediaStatusIndicator` component with props: `{ status: MediaStatus, onRetry?: () => void }`
- [ ] `processing` state: pulsing rectangle on `surface-charcoal`, "Processing..." label in `warm-ash`
- [ ] `failed` state: `error` Material Symbol icon in error color, "Failed" label, "Retry" text button in `ember`
- [ ] Pulsing animation: CSS `@keyframes pulse` with opacity 0.4 to 0.8
- [ ] Fixed aspect ratio container (16:9) for consistent layout before media loads

**Acceptance:** Both states render correctly per Iron & Ember spec (TA-7, TA-8, TA-14)

### S013: FileCard

**Agent:** frontend-specialist-2
**Files:** `src/components/chat/file-card.tsx`
**Depends on:** Nothing
**Parallel:** Yes (independent of S012, S014)

- [ ] Create `FileCard` component with props: `{ filename: string, mimeType?: string, fileSizeBytes?: number, onDownload: () => void }`
- [ ] Document-type icon selection based on MIME type:
  - PDF: `picture_as_pdf`
  - DOC/DOCX: `description`
  - XLS/XLSX: `table_chart`
  - CSV: `table_chart`
  - TXT: `article`
  - ZIP: `folder_zip`
  - Default: `insert_drive_file`
- [ ] Layout: icon (left) + filename + size (center) + "Download" button in `ember` (right)
- [ ] Background: `surface-charcoal`, zero border-radius
- [ ] File size formatted: bytes -> KB/MB with 1 decimal
- [ ] Filename truncated with ellipsis if > 30 characters

**Acceptance:** File card renders with correct icon, name, size, download button (TA-5, TA-14, TA-15)

### S014: UploadProgress

**Agent:** frontend-specialist-2
**Files:** `src/components/chat/upload-progress.tsx`
**Depends on:** Nothing
**Parallel:** Yes (independent of S012, S013)

- [ ] Create `UploadProgress` component with props: `{ progress: number, filename: string, onCancel: () => void }`
- [ ] Horizontal progress bar: `ember` fill on `surface-steel` track, zero border-radius
- [ ] Percentage text in `warm-ash`, `label-small`
- [ ] Filename display truncated with ellipsis
- [ ] Cancel button: `close` Material Symbol icon
- [ ] Container: `surface-charcoal` background, compact height (~48px)

**Acceptance:** Progress bar renders with correct fill and cancel works (TA-1, TA-14)

### S015: MediaMessageContent

**Agent:** frontend-specialist-2
**Files:** `src/components/chat/media-message-content.tsx`
**Depends on:** S012, S013
**Parallel:** No (sequential after S012, S013)

- [ ] Create `MediaMessageContent` component with props: `{ attachment: MediaAttachment, isOwn: boolean }`
- [ ] Route by `attachment.mediaType`:
  - `'video'`: route by `attachment.status`:
    - `'processing'` -> `MediaStatusIndicator` with status `processing`
    - `'ready'` -> video thumbnail image with `play_circle` overlay in `ember`, tap triggers `onPlay`
    - `'failed'` -> `MediaStatusIndicator` with status `failed` and retry callback
  - `'image'`: inline `<img>` preview, max-width 280px, tap triggers `onViewFullScreen`
  - `'file'`: `FileCard` component with download handler
- [ ] Video thumbnail: `<img src={attachment.thumbnailUrl}>` with 16:9 aspect ratio container
- [ ] Image: generate display URL from Supabase Storage signed URL
- [ ] File download: generate signed URL from Supabase Storage, open in new tab

**Acceptance:** All three media types render correctly in all status states (TA-1, TA-3, TA-5, TA-7, TA-8, TA-14)

### S016: VideoPlayer

**Agent:** frontend-specialist-2
**Files:** `src/components/chat/video-player.tsx`
**Depends on:** S015
**Parallel:** No (sequential after S015)

- [ ] Create `VideoPlayer` component with props: `{ signedUrl: string, onClose: () => void }`
- [ ] Dynamic import of `hls.js` to avoid bundle bloat: `const Hls = (await import('hls.js')).default`
- [ ] HLS playback:
  - If `Hls.isSupported()`: create `Hls` instance, `loadSource`, `attachMedia`
  - Else if native HLS (Safari): set `video.src` directly
- [ ] Overlay layout: fixed position, `surface-pit` background with opacity
- [ ] Controls: play/pause, progress scrubber, full-screen toggle, close button
- [ ] Close on backdrop tap or `close` button
- [ ] Cleanup: destroy `Hls` instance on unmount

**Acceptance:** Video plays inline from signed URL; full-screen toggle works (TA-1)

### S017: ImageLightbox

**Agent:** frontend-specialist-2
**Files:** `src/components/chat/image-lightbox.tsx`
**Depends on:** S015
**Parallel:** Yes (parallel with S016)

- [ ] Create `ImageLightbox` component with props: `{ imageUrl: string, onClose: () => void }`
- [ ] Full-screen overlay: fixed position, `surface-pit` background
- [ ] Image: `object-fit: contain`, centered, max dimensions viewport
- [ ] Close on backdrop tap or `close` Material Symbol button (top-right, `bone-white`)
- [ ] Optional: pinch-to-zoom on mobile (CSS `touch-action: pinch-zoom` + transform)

**Acceptance:** Image opens full-screen, close works (TA-3)

---

## Wave 5: Integration (frontend-specialist-3, depends on Waves 2-4)

### S018: Realtime media_status wiring

**Agent:** frontend-specialist-3
**Files:** `src/lib/realtime-manager.ts`, `src/lib/realtime-schemas.ts`
**Depends on:** S007
**Parallel:** Yes (parallel with S019-S021)

- [ ] Add `mediaStatusBroadcastPayloadSchema` to `realtime-schemas.ts`:
  - `message_id`, `attachment_id`, `status`, `thumbnail_url` (optional), `playback_url` (optional)
- [ ] Add `media_status` event listener in `RealtimeManager.subscribeToConversation()`:
  - Parse payload with `mediaStatusBroadcastPayloadSchema.safeParse()`
  - Call registered `mediaStatusListeners` with parsed payload
- [ ] Add `onMediaStatus(listener)` / `offMediaStatus(listener)` registration methods
- [ ] Wire to `useMediaAttachments` hook: on `media_status` event, update the local attachment cache via `queryClient.setQueryData`

**Acceptance:** Connected participant sees processing-to-ready transition without refresh (TA-16)

### S019: AttachmentPicker replacement

**Agent:** frontend-specialist-3
**Files:** `src/components/chat/attachment-picker.tsx`
**Depends on:** S010
**Parallel:** Yes (parallel with S018, S020, S021)

- [ ] Replace `alert()` stubs with real file input triggers
- [ ] Add hidden `<input>` refs for each type:
  - Video: `<input type="file" accept="video/mp4,video/quicktime,video/webm" capture="environment">`
  - Photo: `<input type="file" accept="image/jpeg,image/png,image/webp,image/heic">`
  - File: `<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip">`
- [ ] On file selection: call `validateFile(file, type)` from media-constraints
- [ ] If validation fails: show inline error below the option button, keep sheet open
- [ ] If validation passes: close sheet, call `onFileSelected(file, type)` callback prop
- [ ] Add `onFileSelected: (file: File, type: 'video' | 'image' | 'file') => void` prop
- [ ] Add `isOnline: boolean` prop -- when offline, all options show "Requires internet connection" message
- [ ] Workout option remains unchanged (Step 24 scope)

**Acceptance:** Each option opens native picker; invalid files rejected with error (TA-2, TA-4, TA-6, TA-10, TA-13)

### S020: ComposeBar media state + upload progress

**Agent:** frontend-specialist-3
**Files:** `src/components/chat/compose-bar.tsx`
**Depends on:** S010, S014
**Parallel:** Yes (parallel with S018, S019, S021)

- [ ] Integrate `useMediaUpload(conversationId)` hook
- [ ] Pass `onFileSelected` to `AttachmentPicker`: calls `upload(file, type)`
- [ ] Pass `isOnline` to `AttachmentPicker`: read from `navigator.onLine` + event listener
- [ ] When `isUploading`: show `UploadProgress` strip above the compose bar input
- [ ] When upload error: show error message with retry button in compose area
- [ ] Disable send button and attachment button while upload is in progress
- [ ] On upload cancel: reset to idle state

**Acceptance:** Upload progress visible during upload; compose bar disables appropriately (TA-1, TA-10)

### S021: MessageBubble + MessageList media routing

**Agent:** frontend-specialist-3
**Files:** `src/components/chat/message-bubble.tsx`, `src/components/chat/message-list.tsx`
**Depends on:** S011, S015
**Parallel:** Yes (parallel with S018-S020)

- [ ] In `MessageList`:
  - Extract media message IDs from visible messages: `messages.filter(m => m.messageType === 'media').map(m => m.id)`
  - Call `useMediaAttachments(mediaMessageIds)` to batch-fetch attachments
  - Pass attachment map to `MessageBubble` via new `attachment?: MediaAttachment` prop
- [ ] In `MessageBubble`:
  - Add `attachment?: MediaAttachment` prop
  - When `message.messageType === 'media'` and `attachment` exists: render `MediaMessageContent` instead of text content
  - When `message.messageType === 'media'` and no attachment yet: render loading placeholder (same as processing state)
  - Existing text rendering unchanged for `messageType !== 'media'`
- [ ] Video play handler: call `mediaProvider.getSignedPlaybackUrl()`, open `VideoPlayer`
- [ ] Image view handler: generate Storage signed URL, open `ImageLightbox`
- [ ] File download handler: generate Storage signed URL, `window.open(url, '_blank')`

**Acceptance:** Media messages render with correct content by type; text messages unchanged (TA-1, TA-3, TA-5, TA-7, TA-8)

---

## Wave 6: Validation

### S022-T: End-to-end integration validation

**Agent:** quality-engineer
**Files:** None (read-only validation)
**Depends on:** S001-S021
**Parallel:** No

- [ ] Verify all 16 testable assertions from Spec.md:
  - TA-1: Video upload lifecycle (select -> progress -> placeholder -> thumbnail)
  - TA-2: Video constraint enforcement (duration, size)
  - TA-3: Image upload + inline preview
  - TA-4: Image constraint enforcement
  - TA-5: File upload + file card rendering
  - TA-6: File constraint enforcement (blocklist, allowlist)
  - TA-7: Processing state rendering
  - TA-8: Failed state rendering with retry
  - TA-9: Signed URL access control (403 for non-participants)
  - TA-10: Offline upload blocked with clear message
  - TA-11: Edge Function auth (401 for unauthenticated)
  - TA-12: Webhook processing (ready + failed events)
  - TA-13: MediaProvider interface isolation (code review)
  - TA-14: Iron & Ember compliance (visual inspection)
  - TA-15: original_filename and mime_type stored
  - TA-16: Realtime processing-to-ready transition
- [ ] Verify no regressions in existing text message flow
- [ ] Verify `bun run build` succeeds
- [ ] Verify `bun run lint` passes
- [ ] Verify `bun run test` passes

**Acceptance:** All 16 testable assertions verified; no regressions; build/lint/test pass

### S023-T: Unit tests

**Agent:** quality-engineer
**Files:** `src/lib/__tests__/media-constraints.test.ts`, `src/lib/__tests__/media-upload-service.test.ts`
**Depends on:** S002, S009
**Parallel:** No (after S022-T)

- [ ] Unit tests for `validateFile`:
  - Video: accept 30s/20MB MP4, reject 90s video, reject 60MB video, reject AVI format
  - Image: accept 5MB JPEG, reject 15MB PNG, reject BMP format
  - File: accept 10MB PDF, reject 30MB PDF, reject .exe, reject .sh, accept .docx
- [ ] Unit tests for `MediaUploadService` (mocked dependencies):
  - `uploadVideo`: calls provider.getUploadUrl, creates TUS upload, returns correct UploadResult
  - `uploadImage`: calls supabase.storage.upload, returns correct UploadResult with 'ready' status
  - `uploadFile`: calls supabase.storage.upload, returns correct UploadResult with originalFilename
  - `cancelUpload`: aborts active upload
- [ ] All tests pass via `bun run test`

**Acceptance:** Constraint validation and upload orchestration covered by unit tests

---

### S024-T: Unit tests -- CloudflareStreamProvider (media-provider.ts)

**Agent:** quality-engineer
**Files:** `src/lib/__tests__/media-provider.test.ts`
**Depends on:** S003
**Parallel:** Yes (parallel with S023-T, S025-T)
**Added by:** PR #59 review (T1, criticality 8/10)

- [ ] `isExpired` TTL logic: cached URL before expiry returns cache hit
- [ ] Cache miss on expiry: expired URL triggers new fetch
- [ ] Null client throws meaningful error
- [ ] Zod rejects malformed Cloudflare API response
- [ ] Signed URL cache hit: second call with same assetId returns cached URL without API call

**Acceptance:** CloudflareStreamProvider edge cases covered, especially signed URL caching with TTL

---

### S025-T: Unit tests -- transcoding timeout behavior (use-media-upload.ts)

**Agent:** quality-engineer
**Files:** `src/hooks/__tests__/use-media-upload.test.ts`
**Depends on:** S010
**Parallel:** Yes (parallel with S023-T, S024-T)
**Added by:** PR #59 review (T2, criticality 8/10)

- [ ] With fake timers: 5-minute timeout marks processing attachment as `failed`
- [ ] Ready attachment is unaffected by timeout
- [ ] Query cache invalidated after timeout fires
- [ ] Timer cleared on unmount (no stale invalidations)

**Acceptance:** Transcoding timeout logic fully covered including cleanup on unmount

---

## Milestone Summary

| Wave | Tasks | Parallel | Description |
|------|-------|----------|-------------|
| Wave 1 | S001-S005 | All 5 parallel | Foundation: migration, packages, constraints, provider, adapters, Rust |
| Wave 2 | S006-S008 | All 3 parallel | Edge Functions: upload URL, webhook, signed URL (backend, runs parallel with Waves 3-4) |
| Wave 3 | S009-S011 | S009->S010 sequential, S011 parallel | Upload pipeline: service, upload hook, attachments hook (runs parallel with Waves 2 and 4) |
| Wave 4 | S012-S017 | S012-S014 parallel, S015 after S012+S013, S016-S017 after S015 | Rendering: status indicator, file card, progress, media content, video, lightbox (runs parallel with Waves 2-3) |
| Wave 5 | S018-S021 | All 4 parallel | Integration: realtime, attachment picker, compose bar, message routing |
| Wave 6 | S022-T, S023-T, S024-T, S025-T | S022-T sequential, S023-T/S024-T/S025-T parallel | Validation: end-to-end + unit tests |

**Totals:** 21 implementation tasks + 4 validation tasks = 25 tasks
**Agents:** 3 frontend specialists + 1 backend specialist + 1 quality engineer = 5 agents
**Execution mode:** `/build` (agents work on isolated vertical slices with shared contracts below)

**Parallel execution strategy:** Waves 2, 3, and 4 run concurrently on different agents. Wave 1 must complete first (all foundation). Wave 5 requires Waves 2-4 to complete. Wave 6 requires everything.

---

## Contract: Shared Interfaces

These interfaces are consumed across agent boundaries. Define them before Wave 2+ begins.

### UploadResult (frontend-specialist-1 builds, frontend-specialist-3 consumes via hook)

```typescript
interface UploadResult {
  provider: MediaProvider
  providerAssetId: string
  mediaType: MediaType
  status: MediaStatus
  thumbnailUrl?: string
  playbackUrl?: string
  fileSizeBytes?: number
  durationSeconds?: number
  originalFilename?: string
  mimeType?: string
}
```

### useMediaUpload return (frontend-specialist-1 builds, frontend-specialist-3 consumes)

```typescript
interface UseMediaUploadReturn {
  upload: (file: File, type: 'video' | 'image' | 'file') => Promise<void>
  progress: number
  isUploading: boolean
  error: string | null
  cancel: () => void
  retry: () => void
}
```

### MediaMessageContent props (frontend-specialist-2 builds, frontend-specialist-3 wires)

```typescript
interface MediaMessageContentProps {
  attachment: MediaAttachment
  isOwn: boolean
  onPlay?: (assetId: string) => void
  onViewFullScreen?: (imageUrl: string) => void
  onDownload?: (providerAssetId: string, filename: string) => void
  onRetry?: () => void
}
```

### UploadProgress props (frontend-specialist-2 builds, frontend-specialist-3 wires)

```typescript
interface UploadProgressProps {
  progress: number
  filename: string
  onCancel: () => void
}
```

### AttachmentPicker props (frontend-specialist-3 modifies)

```typescript
interface AttachmentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelected: (file: File, type: 'video' | 'image' | 'file') => void
  isOnline: boolean
}
```

### MediaStatusBroadcastPayload (backend-specialist defines schema, frontend-specialist-3 consumes)

```typescript
interface MediaStatusBroadcastPayload {
  message_id: string
  attachment_id: string
  status: MediaStatus
  thumbnail_url?: string
  playback_url?: string
}
```
