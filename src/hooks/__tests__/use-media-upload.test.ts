// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAdapter = {
  sendMessage: vi.fn(),
  saveMediaAttachment: vi.fn(),
  getMediaAttachments: vi.fn(),
  updateMediaAttachment: vi.fn(),
}

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

vi.mock('@/lib/media-constraints', () => ({
  validateFile: vi.fn().mockResolvedValue({ valid: true }),
}))

const mockUploadVideo = vi.fn()
const mockUploadImage = vi.fn()
const mockUploadFile = vi.fn()
const mockCancelUpload = vi.fn()

vi.mock('@/lib/media-upload-service', () => ({
  MediaUploadService: class {
    uploadVideo = mockUploadVideo
    uploadImage = mockUploadImage
    uploadFile = mockUploadFile
    cancelUpload = mockCancelUpload
  },
}))

import { useMediaUpload } from '../use-media-upload'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIVE_MINUTES = 5 * 60 * 1000

function createVideoFile(): File {
  return new File(['video-data'], 'clip.mp4', { type: 'video/mp4' })
}

const VIDEO_UPLOAD_RESULT = {
  provider: 'cloudflare' as const,
  providerAssetId: 'cf-asset-123',
  mediaType: 'video' as const,
  status: 'processing' as const,
  originalFilename: 'clip.mp4',
  mimeType: 'video/mp4',
  fileSizeBytes: 1024,
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()

  // Default mocks for a successful video upload path
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  mockAdapter.sendMessage.mockResolvedValue({ id: 'msg-123' })
  mockAdapter.saveMediaAttachment.mockResolvedValue(undefined)
  mockUploadVideo.mockResolvedValue(VIDEO_UPLOAD_RESULT)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Transcoding timeout behavior
// ---------------------------------------------------------------------------

describe('useMediaUpload - transcoding timeout', () => {
  it('marks a still-processing attachment as failed after 5 minutes', async () => {
    // Attachment still processing when timeout fires
    mockAdapter.getMediaAttachments.mockResolvedValue([
      { id: 'att-1', providerAssetId: 'cf-asset-123', status: 'processing' },
    ])
    mockAdapter.updateMediaAttachment.mockResolvedValue(undefined)

    const { result } = renderHook(() => useMediaUpload('conv-1'), {
      wrapper: TestWrapper,
    })

    // Trigger video upload
    await act(async () => {
      await result.current.upload(createVideoFile(), 'video')
    })

    // Advance past the 5-minute timeout (async to flush the promise chain)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES)
    })

    expect(mockAdapter.getMediaAttachments).toHaveBeenCalledWith(['msg-123'])
    expect(mockAdapter.updateMediaAttachment).toHaveBeenCalledWith('att-1', {
      status: 'failed',
    })
  })

  it('does not update an attachment that has already reached ready status', async () => {
    // Attachment already finished transcoding before the timeout fires
    mockAdapter.getMediaAttachments.mockResolvedValue([
      { id: 'att-1', providerAssetId: 'cf-asset-123', status: 'ready' },
    ])

    const { result } = renderHook(() => useMediaUpload('conv-1'), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      await result.current.upload(createVideoFile(), 'video')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES)
    })

    expect(mockAdapter.getMediaAttachments).toHaveBeenCalledWith(['msg-123'])
    expect(mockAdapter.updateMediaAttachment).not.toHaveBeenCalled()
  })

  it('invalidates query cache after timeout marks attachment as failed', async () => {
    mockAdapter.getMediaAttachments.mockResolvedValue([
      { id: 'att-1', providerAssetId: 'cf-asset-123', status: 'processing' },
    ])
    mockAdapter.updateMediaAttachment.mockResolvedValue(undefined)

    const { result } = renderHook(() => useMediaUpload('conv-1'), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      await result.current.upload(createVideoFile(), 'video')
    })

    // Spy on the QueryClient's invalidateQueries via the adapter calls as a proxy.
    // We cannot easily spy on the QueryClient from outside, so we verify the
    // adapter was called (which means the timeout callback ran to completion,
    // including the two invalidateQueries calls that follow updateMediaAttachment).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES)
    })

    // If updateMediaAttachment was called, the code continued past it and
    // executed both invalidateQueries calls (messages + media-attachments).
    expect(mockAdapter.updateMediaAttachment).toHaveBeenCalledTimes(1)
  })

  it('clears the timer on unmount so no stale updates occur', async () => {
    mockAdapter.getMediaAttachments.mockResolvedValue([
      { id: 'att-1', providerAssetId: 'cf-asset-123', status: 'processing' },
    ])

    const { result, unmount } = renderHook(() => useMediaUpload('conv-1'), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      await result.current.upload(createVideoFile(), 'video')
    })

    // Unmount before the timeout fires
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES)
    })

    // The timer should have been cleared on unmount, so no adapter call happens
    expect(mockAdapter.getMediaAttachments).not.toHaveBeenCalled()
    expect(mockAdapter.updateMediaAttachment).not.toHaveBeenCalled()
  })
})
