# Tech: Video + Image Sharing (Step 25)

**Feature:** 007-video-image-sharing
**Status:** Draft
**Created:** 2026-04-03

---

## Architecture Overview

This step spans four layers: Supabase Edge Functions (new), Supabase Storage configuration, frontend upload/rendering components, and a thin Cloudflare Stream integration. Unlike the previous chat steps which were pure frontend or pure data layer, this step is the first cross-cutting feature that introduces server-side compute (Edge Functions) and an external vendor dependency (Cloudflare Stream).

The core pattern is **client-direct upload**: binary data flows from the user's device directly to the storage provider (Cloudflare Stream for video, Supabase Storage for images/files). The Ardent Forge backend never touches binary data. Edge Functions serve two narrow purposes: (1) generating pre-signed TUS upload URLs so the Cloudflare API token stays server-side, and (2) receiving transcoding webhooks and updating the media_attachments row.

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VIDEO UPLOAD                                                            │
│                                                                         │
│  Client                Edge Function              Cloudflare Stream     │
│  ──────                ─────────────              ─────────────────     │
│  1. Pick video ──────► 2. POST /chat-media-       3. Create TUS        │
│                           upload-url                 endpoint           │
│                        ◄── { tusUrl, assetId } ──◄                     │
│  4. TUS upload ─────────────────────────────────► 5. Transcode          │
│     (direct)           ┌─ 6. Webhook ────────────◄ ready.to.stream     │
│                        │  POST /chat-media-webhook                     │
│                        │  7. UPDATE media_attachments                  │
│                        │     status='ready', thumbnail_url=...         │
│                        │  8. Broadcast on conversation channel         │
│  9. UI updates ◄───────┘                                               │
│     placeholder → thumbnail                                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ IMAGE / FILE UPLOAD                                                     │
│                                                                         │
│  Client                         Supabase Storage                        │
│  ──────                         ────────────────                        │
│  1. Pick image/file ──────────► 2. Upload via Storage SDK               │
│                                    (auth token in header)               │
│  3. On success:                                                         │
│     sendMessage(messageType='media')                                    │
│     saveMediaAttachment(status='ready')                                 │
│  4. Message appears with inline preview / file card                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Tree (New + Modified)

```
src/
├── components/chat/
│   ├── attachment-picker.tsx         [MODIFY] Replace stubs with real handlers
│   ├── compose-bar.tsx               [MODIFY] Add pending attachment state + preview strip
│   ├── message-bubble.tsx            [MODIFY] Route media messages to MediaMessageContent
│   ├── media-message-content.tsx     [NEW]    Renders video/image/file by media_type
│   ├── video-player.tsx              [NEW]    HLS player wrapper (hls.js)
│   ├── image-lightbox.tsx            [NEW]    Full-screen image viewer overlay
│   ├── file-card.tsx                 [NEW]    File attachment card with download
│   ├── upload-progress.tsx           [NEW]    Progress bar + cancel for active uploads
│   └── media-status-indicator.tsx    [NEW]    Processing/failed state rendering
├── hooks/
│   ├── use-media-upload.ts           [NEW]    Upload orchestration (video/image/file)
│   └── use-media-attachments.ts      [NEW]    Query attachments for a message
├── lib/
│   ├── media-upload-service.ts       [NEW]    Cloudflare TUS + Storage upload logic
│   ├── media-provider.ts             [NEW]    MediaProvider interface + CloudflareStreamProvider
│   ├── media-constraints.ts          [NEW]    Validation constants + helpers
│   ├── data-adapter.ts               [MODIFY] Add getMediaAttachments, updateMediaAttachment
│   ├── supabase-adapter.ts           [MODIFY] Implement new adapter methods
│   ├── tauri-adapter.ts              [MODIFY] Implement new adapter methods
│   ├── realtime-manager.ts           [MODIFY] Handle media_status broadcast events
│   └── realtime-schemas.ts           [MODIFY] Add MediaStatusBroadcastPayload
├── domain/types/
│   └── media.ts                      [NO CHANGE] Already complete
supabase/
├── functions/
│   ├── chat-media-upload-url/
│   │   └── index.ts                  [NEW]    Edge Function: TUS URL generation
│   ├── chat-media-webhook/
│   │   └── index.ts                  [NEW]    Edge Function: transcoding webhook
│   └── chat-media-signed-url/
│       └── index.ts                  [NEW]    Edge Function: signed playback URL
├── migrations/
│   └── 20260403000001_media_storage.sql [NEW] Storage buckets + media_attachments index
src-tauri/
├── src/commands/chat.rs              [MODIFY] Add get_media_attachments command
└── migrations/                       [NO CHANGE] media_attachments table already exists
```

---

## Key Technical Decisions

### TD-1: TUS Protocol for Video Uploads

Cloudflare Stream supports two upload mechanisms: direct creator upload (simple POST with full file) and TUS resumable upload. TUS is the correct choice for mobile: network interruptions during a 30s video upload (15-35 MB) are common, and TUS resumes from the last uploaded chunk rather than restarting.

**Client library:** Use `tus-js-client` (maintained, 12KB gzipped, supports React Native/WebView). The client receives the TUS endpoint URL from the Edge Function and handles chunked upload with automatic retry.

```typescript
import * as tus from 'tus-js-client'

const upload = new tus.Upload(file, {
  endpoint: tusUrl,        // From Edge Function
  retryDelays: [0, 1000, 3000, 5000],
  chunkSize: 5 * 1024 * 1024,  // 5 MB chunks
  metadata: {
    filename: file.name,
    filetype: file.type,
  },
  onProgress: (bytesUploaded, bytesTotal) => {
    setProgress(bytesUploaded / bytesTotal)
  },
  onSuccess: () => { /* Save media attachment metadata */ },
  onError: (error) => { /* Handle failure */ },
})
upload.start()
```

### TD-2: Edge Function Authentication and Secrets

All three Edge Functions use different auth patterns:

| Function | Auth Model | Secret Access |
|----------|-----------|---------------|
| `chat-media-upload-url` | User JWT (Authorization header) | Cloudflare API token from Supabase Vault |
| `chat-media-webhook` | Shared secret (webhook signing) | Webhook signing key from env var |
| `chat-media-signed-url` | User JWT (Authorization header) | Cloudflare API token from Supabase Vault |

Edge Functions use Deno runtime. The `chat-media-upload-url` and `chat-media-signed-url` functions verify the user's JWT, check conversation participation via an RPC call or direct query, then proxy to the Cloudflare API. The `chat-media-webhook` validates the webhook signature header.

**Vault access pattern:**
```typescript
const { data: secrets } = await supabaseAdmin
  .from('vault.decrypted_secrets')
  .select('decrypted_secret')
  .eq('name', 'cloudflare_stream_api_token')
  .single()
```

### TD-3: Supabase Storage Bucket Configuration

Two buckets needed, created via migration:

| Bucket | Public | Max File Size | Allowed MIME Types |
|--------|--------|---------------|--------------------|
| `chat-images` | No (private) | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |
| `chat-files` | No (private) | 25 MB | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`, `text/plain`, `text/csv`, `application/zip`, `application/vnd.ms-excel` |

Both buckets are **private** -- downloads use signed URLs generated client-side via the Supabase SDK's `createSignedUrl()` method. No Edge Function needed for Storage signed URLs because the Supabase client can generate them directly with the user's auth token.

Bucket creation via SQL migration:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat-images', 'chat-images', false, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('chat-files', 'chat-files', false, 26214400,
   ARRAY['application/pdf', 'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel', 'text/plain', 'text/csv', 'application/zip']);
```

Storage RLS policies:
- **Upload (INSERT)**: `auth.uid() IS NOT NULL` (any authenticated user can upload)
- **Download (SELECT)**: Conversation participation check via `media_attachments -> messages -> conversation_participants` join
- **No DELETE** by users (retention cleanup uses `service_role`)

### TD-4: Media Message Rendering Strategy

The `MessageBubble` component currently renders only `message.content` as text. For media messages, we introduce a `MediaMessageContent` component that inspects the attachment's `media_type` and delegates to the appropriate renderer:

```
MessageBubble
  └── if messageType === 'media'
        └── MediaMessageContent
              ├── if mediaType === 'video'
              │     ├── status === 'processing' → MediaStatusIndicator (pulsing placeholder)
              │     ├── status === 'ready'      → video thumbnail + play overlay
              │     └── status === 'failed'     → error icon + retry button
              ├── if mediaType === 'image'
              │     └── inline preview (max-width 280px), tap → ImageLightbox
              └── if mediaType === 'file'
                    └── FileCard (icon + filename + size + download button)
```

**Attachment loading strategy:** The `useMessages` infinite query returns `Message[]` without attachments. A separate `useMediaAttachments` hook fetches attachments for all visible media messages in a single batch query. This avoids N+1 queries while keeping the message query lightweight.

```typescript
// Batch fetch: get attachments for all media messages on the current page
const mediaMessageIds = messages
  .filter(m => m.messageType === 'media')
  .map(m => m.id)
const { data: attachments } = useMediaAttachments(mediaMessageIds)
```

### TD-5: Video Playback with hls.js

Cloudflare Stream delivers video via HLS (HTTP Live Streaming). The `VideoPlayer` component uses `hls.js` for browsers that don't natively support HLS (most browsers except Safari). Safari uses native `<video>` with the HLS manifest URL directly.

```typescript
import Hls from 'hls.js'

if (Hls.isSupported()) {
  const hls = new Hls()
  hls.loadSource(signedPlaybackUrl)
  hls.attachMedia(videoElement)
} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
  videoElement.src = signedPlaybackUrl  // Safari native HLS
}
```

The signed playback URL is obtained from the `chat-media-signed-url` Edge Function, which verifies conversation membership before signing. The URL is cached in a `Map<assetId, { url, expiresAt }>` with 1-hour TTL to avoid redundant Edge Function calls on replay.

### TD-6: Upload Orchestration Service

A `MediaUploadService` class encapsulates the three upload paths (video, image, file) behind a unified interface. This keeps the hook layer thin and the upload logic testable:

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

class MediaUploadService {
  async uploadVideo(file: File, onProgress: (pct: number) => void): Promise<UploadResult>
  async uploadImage(file: File, onProgress: (pct: number) => void): Promise<UploadResult>
  async uploadFile(file: File, onProgress: (pct: number) => void): Promise<UploadResult>
  validateFile(file: File, type: 'video' | 'image' | 'file'): ValidationResult
  cancelUpload(): void
}
```

The service is instantiated per-upload, not as a singleton, so multiple uploads can be tracked independently (though the UI only allows one at a time in the initial release).

### TD-7: Realtime Media Status Updates

When the `chat-media-webhook` Edge Function processes a transcoding completion event, it needs to notify connected participants. The webhook writes the updated status to `media_attachments`, then sends a Broadcast event on the conversation channel:

```typescript
// In chat-media-webhook Edge Function:
await supabaseAdmin.channel(`chat:${conversationId}`).send({
  type: 'broadcast',
  event: 'media_status',
  payload: {
    message_id: messageId,
    attachment_id: attachmentId,
    status: 'ready',           // or 'failed'
    thumbnail_url: thumbnailUrl,
    playback_url: playbackUrl,
  },
})
```

The `RealtimeManager` gains a new event listener for `'media_status'` that updates the local attachment cache, triggering a re-render from processing placeholder to playable thumbnail.

A new schema is added to `realtime-schemas.ts`:

```typescript
export const mediaStatusBroadcastPayloadSchema = z.object({
  message_id: entityId,
  attachment_id: entityId,
  status: mediaStatusSchema,
  thumbnail_url: z.string().url().optional(),
  playback_url: z.string().url().optional(),
})
```

### TD-8: Transcoding Timeout Handling

Cloudflare Stream transcoding for a 60s video typically completes in 30-90 seconds. If no webhook arrives within 5 minutes, the client marks the attachment as failed. This timeout runs client-side via a `setTimeout` started when the upload completes:

```typescript
// After TUS upload succeeds:
const timeoutId = setTimeout(async () => {
  await adapter.updateMediaAttachment(attachmentId, { status: 'failed' })
  // Trigger re-render to show failed state
}, 5 * 60 * 1000)

// Cleared when media_status broadcast arrives:
clearTimeout(timeoutId)
```

This is a fallback -- the webhook path is the primary status update mechanism.

### TD-9: Offline Detection for Media Uploads

Media uploads require connectivity (CH-6). Before initiating any upload, check `navigator.onLine`. In Tauri mode, also check the sync engine's connectivity state. If offline:

- Show toast: "Media uploads require an internet connection"
- Do not open the file picker
- The attachment button can still be tapped (to show the message) but no upload starts

The existing `AttachmentPicker` gains an `isOnline` prop. When offline, all four options show the offline message instead of opening pickers.

### TD-10: Adapter Layer Extensions

Two new methods added to the `DataAdapter` interface:

```typescript
interface DataAdapter {
  // Existing:
  saveMediaAttachment(messageId, attachment): Promise<MediaAttachment>

  // New:
  getMediaAttachments(messageIds: string[]): Promise<MediaAttachment[]>
  updateMediaAttachment(
    attachmentId: string,
    updates: Partial<Pick<MediaAttachment, 'status' | 'thumbnailUrl' | 'playbackUrl' | 'providerAssetId'>>
  ): Promise<MediaAttachment>
}
```

`getMediaAttachments` takes an array of message IDs and returns all attachments for those messages in one query. This supports the batch-fetch pattern from TD-4.

`updateMediaAttachment` supports partial updates for the transcoding lifecycle (processing -> ready with URLs, or processing -> failed).

Both adapters (Supabase and Tauri) implement these methods. The Tauri adapter adds a corresponding `get_media_attachments` Rust command.

### TD-11: File Picker and Camera Access

The `AttachmentPicker` needs platform-appropriate file selection:

| Option | Browser | Tauri (Android) |
|--------|---------|-----------------|
| Video | `<input type="file" accept="video/*" capture="environment">` | Same (WebView handles camera intent) |
| Photo | `<input type="file" accept="image/*" capture="environment">` | Same (WebView handles camera intent) |
| File | `<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip">` | Same |

A hidden `<input>` element is triggered programmatically when the user taps an option. The `capture` attribute on mobile opens the camera directly; without it, the system shows a chooser (camera or gallery). For video, `capture="environment"` opens the rear camera.

File validation runs immediately after selection, before any upload starts. Invalid files show an inline error in the attachment picker sheet and the sheet remains open for the user to try again.

### TD-12: Client-Side Validation Constants

Centralized in `media-constraints.ts`:

```typescript
export const MEDIA_CONSTRAINTS = {
  video: {
    maxSizeBytes: 50 * 1024 * 1024,       // 50 MB
    maxDurationSeconds: 60,
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    allowedExtensions: ['.mp4', '.mov', '.webm'],
  },
  image: {
    maxSizeBytes: 10 * 1024 * 1024,       // 10 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
  },
  file: {
    maxSizeBytes: 25 * 1024 * 1024,       // 25 MB
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.zip'],
    blockedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.msi', '.app', '.dmg',
                        '.jar', '.com', '.scr', '.vbs', '.wsf'],
  },
} as const
```

### TD-13: Migration for Storage Buckets and Missing Index

A single new migration handles:

1. **Storage bucket creation** -- `chat-images` and `chat-files` with size limits and MIME type restrictions
2. **Storage RLS policies** -- upload requires auth, download requires conversation participation
3. **Missing index** -- `CREATE INDEX idx_media_attachments_message ON media_attachments(message_id)`

This migration is the only database change in Step 25. The `media_attachments` table itself already exists from Step 21.

---

## Component File Plan

### New Files

| File | Component(s) | Notes |
|------|-------------|-------|
| `src/components/chat/media-message-content.tsx` | `MediaMessageContent` | Routes to video/image/file renderer by `media_type` |
| `src/components/chat/video-player.tsx` | `VideoPlayer` | hls.js wrapper with signed URL, full-screen toggle |
| `src/components/chat/image-lightbox.tsx` | `ImageLightbox` | Full-screen overlay with pinch-to-zoom |
| `src/components/chat/file-card.tsx` | `FileCard` | Document icon + filename + size + download button |
| `src/components/chat/upload-progress.tsx` | `UploadProgress` | Horizontal bar in `ember`/`surface-steel`, cancel button |
| `src/components/chat/media-status-indicator.tsx` | `MediaStatusIndicator` | Processing (pulsing) and failed (error + retry) states |
| `src/hooks/use-media-upload.ts` | `useMediaUpload` | Orchestrates upload, progress, cancel, retry |
| `src/hooks/use-media-attachments.ts` | `useMediaAttachments` | Batch-fetch attachments for visible media messages |
| `src/lib/media-upload-service.ts` | `MediaUploadService` | Upload logic for all three types |
| `src/lib/media-provider.ts` | `MediaProvider`, `CloudflareStreamProvider` | Interface + Cloudflare implementation |
| `src/lib/media-constraints.ts` | Validation constants + helpers | Constraint definitions, `validateFile()` |
| `supabase/functions/chat-media-upload-url/index.ts` | Edge Function | TUS URL generation |
| `supabase/functions/chat-media-webhook/index.ts` | Edge Function | Transcoding webhook |
| `supabase/functions/chat-media-signed-url/index.ts` | Edge Function | Signed playback URL |
| `supabase/migrations/20260403000001_media_storage.sql` | Migration | Buckets, policies, index |

### Modified Files

| File | Change |
|------|--------|
| `src/components/chat/attachment-picker.tsx` | Replace stubs with file input triggers + validation |
| `src/components/chat/compose-bar.tsx` | Add pending attachment preview strip + upload progress |
| `src/components/chat/message-bubble.tsx` | Route `messageType === 'media'` to `MediaMessageContent` |
| `src/components/chat/message-list.tsx` | Pass attachment data to message bubbles |
| `src/lib/data-adapter.ts` | Add `getMediaAttachments`, `updateMediaAttachment` |
| `src/lib/supabase-adapter.ts` | Implement new adapter methods |
| `src/lib/tauri-adapter.ts` | Implement new adapter methods |
| `src/lib/database.types.ts` | No change needed (MediaAttachmentRow already defined) |
| `src/lib/realtime-manager.ts` | Add `media_status` event listener |
| `src/lib/realtime-schemas.ts` | Add `mediaStatusBroadcastPayloadSchema` |
| `src/hooks/use-chat.ts` | Export media-related query invalidation helpers |
| `src-tauri/src/commands/chat.rs` | Add `get_media_attachments` command |
| `package.json` | Add `tus-js-client`, `hls.js` |

---

## Data Flow

### Video Upload Flow

```
User taps Video in AttachmentPicker
  → <input type="file" accept="video/*" capture>
  → File selected
  → validateFile(file, 'video') -- check size, duration, format
  → FAIL? Show inline error, keep picker open
  → PASS:
      → Close picker
      → ComposeBar shows UploadProgress with file preview
      → useMediaUpload.uploadVideo(file)
        → fetch('/functions/v1/chat-media-upload-url', { auth })
        → Receive { tusUrl, assetId }
        → tus.Upload(file, { endpoint: tusUrl, onProgress })
        → On TUS success:
            → sendMessage(conversationId, 'media')
            → saveMediaAttachment(messageId, {
                provider: 'cloudflare_stream',
                providerAssetId: assetId,
                mediaType: 'video',
                status: 'processing'
              })
            → Start 5-min timeout
            → Clear compose bar upload state
      → Message appears in list with pulsing placeholder
      → Webhook fires → DB update → Broadcast 'media_status'
      → RealtimeManager receives → update attachment cache
      → MediaMessageContent re-renders: placeholder → thumbnail
```

### Image Upload Flow

```
User taps Photo in AttachmentPicker
  → <input type="file" accept="image/*">
  → File selected
  → validateFile(file, 'image')
  → PASS:
      → ComposeBar shows UploadProgress
      → useMediaUpload.uploadImage(file)
        → supabase.storage.from('chat-images').upload(path, file)
        → On success:
            → sendMessage(conversationId, 'media')
            → saveMediaAttachment(messageId, {
                provider: 'supabase_storage',
                providerAssetId: storagePath,
                mediaType: 'image',
                status: 'ready',
                fileSizeBytes: file.size,
                mimeType: file.type,
              })
      → Message appears with inline image preview
```

### File Upload Flow

```
User taps File in AttachmentPicker
  → <input type="file" accept=".pdf,.doc,...">
  → File selected
  → validateFile(file, 'file') -- check size, extension allowlist, blocklist
  → PASS:
      → ComposeBar shows UploadProgress
      → useMediaUpload.uploadFile(file)
        → supabase.storage.from('chat-files').upload(path, file)
        → On success:
            → sendMessage(conversationId, 'media')
            → saveMediaAttachment(messageId, {
                provider: 'supabase_storage',
                providerAssetId: storagePath,
                mediaType: 'file',
                status: 'ready',
                originalFilename: file.name,
                mimeType: file.type,
                fileSizeBytes: file.size,
              })
      → Message appears with FileCard (icon, name, size, download)
```

### Signed URL Playback Flow

```
User taps video thumbnail in MediaMessageContent
  → Check signedUrlCache[assetId]
  → HIT and not expired? Use cached URL
  → MISS or expired:
      → fetch('/functions/v1/chat-media-signed-url', {
            auth, body: { assetId, conversationId }
        })
      → Edge Function:
          1. Verify JWT
          2. Check user is active participant in conversation
          3. Call Cloudflare Stream API: create signed URL (1h TTL)
          4. Return { signedUrl, expiresAt }
      → Cache in signedUrlCache[assetId]
  → Open VideoPlayer with signedUrl
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cloudflare Stream account setup blocks development | Cannot test video uploads without credentials | Image and file upload paths are independent -- build those first. Use mock TUS endpoint for video upload UI development. |
| `backdrop-filter` in Tauri WebView breaks media overlays | Lightbox/player overlays may not render correctly | Test early on Android WebView; fall back to solid dark overlay if needed |
| TUS upload fails to resume after network interruption on Android | Partial uploads waste bandwidth | `tus-js-client` handles retry natively; test with throttled network in dev tools |
| Cloudflare webhook delivery is unreliable or delayed | Videos stuck in "processing" state | 5-minute client-side timeout as fallback; retry button on failed state |
| Supabase Edge Functions cold start latency | Slow upload URL generation on first request | Keep functions minimal; user perceives latency as "connecting" |
| Storage bucket RLS complexity for download authorization | Users cannot download shared media, or non-participants can access it | Test both positive and negative cases; signed URLs as primary access control |
| hls.js bundle size (~200KB) increases app bundle | Slower initial load | Dynamic import: `const Hls = await import('hls.js')` only when video playback is triggered |
| HEIC images not renderable in all browsers | iOS photos may not display | Accept HEIC but note that Supabase Storage serves as-is; browser rendering depends on platform support |

---

## Dependencies

| Package | Already Installed | Purpose |
|---------|-------------------|---------|
| `tus-js-client` | No | Resumable video uploads to Cloudflare Stream |
| `hls.js` | No | HLS video playback in non-Safari browsers |

Both are peer-dependency-free and can be dynamically imported to minimize bundle impact.

No new Supabase packages needed -- `@supabase/supabase-js` already includes the Storage client (`supabase.storage`). Edge Functions use the Deno-native Supabase client (`@supabase/supabase-js` from esm.sh).

---

## ADRs

No new ADRs needed for this step. The relevant architectural decisions were already made:

- **Decision 25** (Cloudflare Stream for video) -- established in implementation plan
- **Decision 32** (images on Supabase Storage, video on Cloudflare) -- established in implementation plan
- **Decision 34** (TUS protocol for video uploads) -- established in implementation plan
- **Decision 35** (Supabase Storage for file sharing) -- established in implementation plan
- **CH-6** (media binaries are cloud-only) -- established in invariants

This step implements those decisions; it does not introduce new architectural choices beyond what was already documented.
