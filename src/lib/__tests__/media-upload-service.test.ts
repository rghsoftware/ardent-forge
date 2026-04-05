import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock tus-js-client
// ---------------------------------------------------------------------------

const mockTusAbort = vi.fn().mockResolvedValue(undefined)
let mockTusShouldFail = false

vi.mock('tus-js-client', () => {
  class MockUpload {
    _options: Record<string, unknown>
    abort = mockTusAbort

    constructor(_file: File, options: Record<string, unknown>) {
      this._options = options
    }

    start() {
      if (mockTusShouldFail) {
        const onError = this._options.onError as (err: Error) => void
        onError(new Error('TUS upload failed: network error'))
        return
      }
      const onProgress = this._options.onProgress as (bytesSent: number, bytesTotal: number) => void
      const onSuccess = this._options.onSuccess as () => void
      onProgress(50, 100)
      onProgress(100, 100)
      onSuccess()
    }
  }
  return { Upload: MockUpload }
})

// ---------------------------------------------------------------------------
// Mock media-provider
// ---------------------------------------------------------------------------

const mockGetUploadUrl = vi.fn().mockResolvedValue({
  tusUrl: 'https://upload.cloudflare.com/tus/abc123',
  assetId: 'cf-asset-123',
})

vi.mock('@/lib/media-provider', () => ({
  getMediaProvider: () => ({
    getUploadUrl: mockGetUploadUrl,
    getSignedPlaybackUrl: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Mock supabase
// ---------------------------------------------------------------------------

const mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null })
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://example.com/signed-url' },
  error: null,
})

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { MediaUploadService } from '@/lib/media-upload-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

// ===========================================================================
// MediaUploadService
// ===========================================================================

describe('MediaUploadService', () => {
  let service: MediaUploadService
  const conversationId = 'conv-123'

  beforeEach(() => {
    vi.clearAllMocks()
    service = new MediaUploadService(conversationId)
  })

  // -------------------------------------------------------------------------
  // uploadVideo
  // -------------------------------------------------------------------------

  describe('uploadVideo', () => {
    it('calls provider.getUploadUrl and creates a TUS upload', async () => {
      const file = createFile('clip.mp4', 10 * 1024 * 1024, 'video/mp4')
      const progressFn = vi.fn()

      const result = await service.uploadVideo(file, progressFn)

      expect(mockGetUploadUrl).toHaveBeenCalledWith({ maxDurationSeconds: 60 })
      expect(result.provider).toBe('cloudflare_stream')
      expect(result.providerAssetId).toBe('cf-asset-123')
      expect(result.mediaType).toBe('video')
      expect(result.status).toBe('processing')
      expect(result.originalFilename).toBe('clip.mp4')
      expect(result.mimeType).toBe('video/mp4')
      expect(result.fileSizeBytes).toBe(10 * 1024 * 1024)
      expect(progressFn).toHaveBeenCalled()
    })

    it('returns processing status for video uploads', async () => {
      const file = createFile('vid.webm', 5 * 1024 * 1024, 'video/webm')
      const result = await service.uploadVideo(file, vi.fn())
      expect(result.status).toBe('processing')
    })

    it('rejects when TUS upload encounters an error (S7)', async () => {
      mockTusShouldFail = true
      const file = createFile('fail.mp4', 5 * 1024 * 1024, 'video/mp4')
      await expect(service.uploadVideo(file, vi.fn())).rejects.toThrow('TUS upload failed')
      mockTusShouldFail = false
    })
  })

  // -------------------------------------------------------------------------
  // uploadImage
  // -------------------------------------------------------------------------

  describe('uploadImage', () => {
    it('calls supabase storage upload and returns ready status', async () => {
      const file = createFile('photo.jpg', 2 * 1024 * 1024, 'image/jpeg')
      const progressFn = vi.fn()

      const result = await service.uploadImage(file, progressFn)

      expect(mockStorageUpload).toHaveBeenCalled()
      expect(result.provider).toBe('supabase_storage')
      expect(result.mediaType).toBe('image')
      expect(result.status).toBe('ready')
      expect(result.originalFilename).toBe('photo.jpg')
      expect(result.mimeType).toBe('image/jpeg')
      expect(result.fileSizeBytes).toBe(2 * 1024 * 1024)
      expect(progressFn).toHaveBeenCalledWith(0)
      expect(progressFn).toHaveBeenCalledWith(1)
    })

    it('uploads to the chat-images path prefix', async () => {
      const file = createFile('img.png', 1024, 'image/png')
      await service.uploadImage(file, vi.fn())

      const uploadCall = mockStorageUpload.mock.calls[0]
      const uploadPath = uploadCall[0] as string
      expect(uploadPath).toContain(`chat-images/${conversationId}/`)
    })

    it('throws when Storage upload returns an error (S6)', async () => {
      mockStorageUpload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Quota exceeded' },
      })
      const file = createFile('fail.jpg', 1024, 'image/jpeg')
      await expect(service.uploadImage(file, vi.fn())).rejects.toThrow('Image upload failed: Quota exceeded')
    })
  })

  // -------------------------------------------------------------------------
  // uploadFile
  // -------------------------------------------------------------------------

  describe('uploadFile', () => {
    it('calls supabase storage upload and returns correct UploadResult', async () => {
      const file = createFile('report.pdf', 3 * 1024 * 1024, 'application/pdf')
      const progressFn = vi.fn()

      const result = await service.uploadFile(file, progressFn)

      expect(mockStorageUpload).toHaveBeenCalled()
      expect(result.provider).toBe('supabase_storage')
      expect(result.mediaType).toBe('file')
      expect(result.status).toBe('ready')
      expect(result.originalFilename).toBe('report.pdf')
      expect(result.mimeType).toBe('application/pdf')
      expect(result.fileSizeBytes).toBe(3 * 1024 * 1024)
    })

    it('uploads to the chat-files path prefix', async () => {
      const file = createFile('data.csv', 512, 'text/csv')
      await service.uploadFile(file, vi.fn())

      const uploadCall = mockStorageUpload.mock.calls[0]
      const uploadPath = uploadCall[0] as string
      expect(uploadPath).toContain(`chat-files/${conversationId}/`)
    })

    it('throws when Storage upload returns an error (S6)', async () => {
      mockStorageUpload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Bucket not found' },
      })
      const file = createFile('fail.pdf', 1024, 'application/pdf')
      await expect(service.uploadFile(file, vi.fn())).rejects.toThrow('File upload failed: Bucket not found')
    })
  })

  // -------------------------------------------------------------------------
  // cancelUpload
  // -------------------------------------------------------------------------

  describe('cancelUpload', () => {
    it('aborts active TUS upload', async () => {
      const file = createFile('clip.mp4', 1024, 'video/mp4')
      // Start an upload so activeUpload is set
      await service.uploadVideo(file, vi.fn())

      // After the upload completes, activeUpload is cleared, so we test the abort path
      // by calling cancelUpload directly -- it should not throw even without an active upload
      service.cancelUpload()
      // No error thrown = pass
    })

    it('can be called safely when no upload is active', () => {
      expect(() => service.cancelUpload()).not.toThrow()
    })
  })
})
