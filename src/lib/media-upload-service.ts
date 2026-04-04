import { Upload } from 'tus-js-client'
import type { MediaProvider as MediaProviderType, MediaType, MediaStatus } from '@/domain/types'
import { getMediaProvider } from '@/lib/media-provider'
import { getSupabaseClient } from '@/lib/supabase'
import { MEDIA_CONSTRAINTS } from '@/lib/media-constraints'

// ---------------------------------------------------------------------------
// UploadResult -- contract consumed by useMediaUpload (S010) and other hooks
// ---------------------------------------------------------------------------

export interface UploadResult {
  provider: MediaProviderType
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

// ---------------------------------------------------------------------------
// MediaUploadService
// ---------------------------------------------------------------------------

export class MediaUploadService {
  private conversationId: string
  private activeUpload: Upload | null = null
  private abortController: AbortController | null = null

  constructor(conversationId: string) {
    this.conversationId = conversationId
  }

  // -------------------------------------------------------------------------
  // Video -- TUS upload to Cloudflare Stream via Edge Function
  // -------------------------------------------------------------------------

  async uploadVideo(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
    const provider = getMediaProvider()
    const { tusUrl, assetId } = await provider.getUploadUrl({
      maxDurationSeconds: MEDIA_CONSTRAINTS.video.maxDurationSeconds,
    })

    return new Promise<UploadResult>((resolve, reject) => {
      const upload = new Upload(file, {
        uploadUrl: tusUrl,
        chunkSize: 5 * 1024 * 1024, // 5 MB
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onProgress: (bytesSent, bytesTotal) => {
          onProgress(bytesTotal > 0 ? bytesSent / bytesTotal : 0)
        },
        onSuccess: () => {
          this.activeUpload = null
          resolve({
            provider: 'cloudflare_stream',
            providerAssetId: assetId,
            mediaType: 'video',
            status: 'processing',
            fileSizeBytes: file.size,
            originalFilename: file.name,
            mimeType: file.type,
          })
        },
        onError: (err) => {
          this.activeUpload = null
          reject(err)
        },
      })

      this.activeUpload = upload
      upload.start()
    })
  }

  // -------------------------------------------------------------------------
  // Image -- Supabase Storage
  // -------------------------------------------------------------------------

  async uploadImage(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not initialized')

    const ext = extractExtension(file.name)
    const path = `chat-images/${this.conversationId}/${crypto.randomUUID()}${ext}`

    this.abortController = new AbortController()

    // Supabase storage does not expose granular progress; report 0 -> 1 on completion.
    onProgress(0)

    const { error } = await client.storage.from('chat-images').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

    this.abortController = null

    if (error) throw new Error(`Image upload failed: ${error.message}`)

    onProgress(1)

    return {
      provider: 'supabase_storage',
      providerAssetId: path,
      mediaType: 'image',
      status: 'ready',
      fileSizeBytes: file.size,
      originalFilename: file.name,
      mimeType: file.type,
    }
  }

  // -------------------------------------------------------------------------
  // File -- Supabase Storage
  // -------------------------------------------------------------------------

  async uploadFile(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not initialized')

    const sanitized = sanitizeFilename(file.name)
    const path = `chat-files/${this.conversationId}/${crypto.randomUUID()}_${sanitized}`

    this.abortController = new AbortController()

    onProgress(0)

    const { error } = await client.storage.from('chat-files').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

    this.abortController = null

    if (error) throw new Error(`File upload failed: ${error.message}`)

    onProgress(1)

    return {
      provider: 'supabase_storage',
      providerAssetId: path,
      mediaType: 'file',
      status: 'ready',
      fileSizeBytes: file.size,
      originalFilename: file.name,
      mimeType: file.type,
    }
  }

  // -------------------------------------------------------------------------
  // Cancel any active upload
  // -------------------------------------------------------------------------

  cancelUpload(): void {
    if (this.activeUpload) {
      this.activeUpload.abort(true).catch(() => {})
      this.activeUpload = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filename.slice(dotIndex).toLowerCase()
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}
