import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock supabase -- controllable per-test
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn()
const mockGetSession = vi.fn()

let mockClient: object | null = {
  auth: { getSession: mockGetSession },
  functions: { invoke: mockInvoke },
}

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockClient,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getMediaProvider, type MediaProvider } from '@/lib/media-provider'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validSession(token = 'test-token') {
  return { data: { session: { access_token: token } } }
}

function noSession() {
  return { data: { session: null } }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CloudflareStreamProvider (via getMediaProvider)', () => {
  let provider: MediaProvider

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = {
      auth: { getSession: mockGetSession },
      functions: { invoke: mockInvoke },
    }
    // Each test file gets its own module scope, so the singleton is fresh.
    // But we still call getMediaProvider() to get a stable reference.
    provider = getMediaProvider()
  })

  // -------------------------------------------------------------------------
  // getUploadUrl
  // -------------------------------------------------------------------------

  describe('getUploadUrl', () => {
    it('returns tusUrl and assetId on success', async () => {
      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: { tusUrl: 'https://upload.cloudflare.com/tus/abc', assetId: 'asset-1' },
        error: null,
      })

      const result = await provider.getUploadUrl({ maxDurationSeconds: 60 })

      expect(result).toEqual({
        tusUrl: 'https://upload.cloudflare.com/tus/abc',
        assetId: 'asset-1',
      })
      expect(mockInvoke).toHaveBeenCalledWith('chat-media-upload-url', {
        body: { maxDurationSeconds: 60 },
        headers: { Authorization: 'Bearer test-token' },
      })
    })

    it('throws when supabase client is null', async () => {
      mockClient = null

      await expect(provider.getUploadUrl({ maxDurationSeconds: 60 })).rejects.toThrow(
        'Supabase client not initialized',
      )
    })

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValue(noSession())

      await expect(provider.getUploadUrl({ maxDurationSeconds: 60 })).rejects.toThrow(
        'Not authenticated',
      )
    })

    it('throws on function invoke error', async () => {
      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Rate limited' },
      })

      await expect(provider.getUploadUrl({ maxDurationSeconds: 60 })).rejects.toThrow(
        'Failed to get upload URL: Rate limited',
      )
    })

    it('throws when response fails Zod validation (T1-R4)', async () => {
      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: { wrongField: 'bad-data' },
        error: null,
      })

      await expect(provider.getUploadUrl({ maxDurationSeconds: 60 })).rejects.toThrow(
        'Invalid upload URL response',
      )
    })
  })

  // -------------------------------------------------------------------------
  // getSignedPlaybackUrl
  // -------------------------------------------------------------------------

  describe('getSignedPlaybackUrl', () => {
    it('returns signed URL on success', async () => {
      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: { signedUrl: 'https://signed.example.com/video', expiresAt: '2099-01-01T00:00:00Z' },
        error: null,
      })

      const result = await provider.getSignedPlaybackUrl('asset-1', 'conv-1')

      expect(result).toEqual({
        url: 'https://signed.example.com/video',
        expiresAt: '2099-01-01T00:00:00Z',
      })
      expect(mockInvoke).toHaveBeenCalledWith('chat-media-signed-url', {
        body: { assetId: 'asset-1', conversationId: 'conv-1' },
        headers: { Authorization: 'Bearer test-token' },
      })
    })

    it('throws when supabase client is null (T1-R3)', async () => {
      // First call to populate cache would fail, but let's test the null path directly
      mockClient = null

      await expect(provider.getSignedPlaybackUrl('asset-x', 'conv-1')).rejects.toThrow(
        'Supabase client not initialized',
      )
    })

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValue(noSession())

      await expect(provider.getSignedPlaybackUrl('asset-x', 'conv-1')).rejects.toThrow(
        'Not authenticated',
      )
    })

    it('throws on function invoke error', async () => {
      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Internal error' },
      })

      await expect(provider.getSignedPlaybackUrl('asset-x', 'conv-1')).rejects.toThrow(
        'Failed to get signed URL: Internal error',
      )
    })

    it('throws when response fails Zod validation (T1-R4)', async () => {
      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: { notSignedUrl: 'nope' },
        error: null,
      })

      await expect(provider.getSignedPlaybackUrl('asset-x', 'conv-1')).rejects.toThrow(
        'Invalid signed URL response',
      )
    })
  })

  // -------------------------------------------------------------------------
  // Signed URL caching + isExpired TTL logic
  // -------------------------------------------------------------------------

  describe('signed URL cache', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns cached URL on second call without API call (T1-R5)', async () => {
      // Set time to a known point
      vi.setSystemTime(new Date('2025-06-01T12:00:00Z'))

      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: {
          signedUrl: 'https://signed.example.com/cached',
          expiresAt: '2025-06-01T13:00:00Z', // expires in 1 hour
        },
        error: null,
      })

      // First call -- hits the API
      const first = await provider.getSignedPlaybackUrl('asset-cache', 'conv-1')
      expect(first.url).toBe('https://signed.example.com/cached')
      expect(mockInvoke).toHaveBeenCalledTimes(1)

      // Second call with same assetId -- should return from cache
      const second = await provider.getSignedPlaybackUrl('asset-cache', 'conv-1')
      expect(second.url).toBe('https://signed.example.com/cached')
      // invoke should NOT have been called again
      expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('returns cache hit when URL is before expiry window (T1-R1)', async () => {
      vi.setSystemTime(new Date('2025-06-01T12:00:00Z'))

      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValue({
        data: {
          signedUrl: 'https://signed.example.com/ttl-ok',
          expiresAt: '2025-06-01T13:00:00Z', // 1 hour from now
        },
        error: null,
      })

      await provider.getSignedPlaybackUrl('asset-ttl', 'conv-1')
      expect(mockInvoke).toHaveBeenCalledTimes(1)

      // Advance 30 minutes -- still 30 minutes before expiry, well outside the 60s buffer
      vi.advanceTimersByTime(30 * 60 * 1000)

      const cached = await provider.getSignedPlaybackUrl('asset-ttl', 'conv-1')
      expect(cached.url).toBe('https://signed.example.com/ttl-ok')
      // Still no second API call
      expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('triggers new fetch when cached URL is expired (T1-R2)', async () => {
      vi.setSystemTime(new Date('2025-06-01T12:00:00Z'))

      mockGetSession.mockResolvedValue(validSession())
      mockInvoke.mockResolvedValueOnce({
        data: {
          signedUrl: 'https://signed.example.com/first',
          expiresAt: '2025-06-01T12:05:00Z', // expires in 5 minutes
        },
        error: null,
      })

      await provider.getSignedPlaybackUrl('asset-expire', 'conv-1')
      expect(mockInvoke).toHaveBeenCalledTimes(1)

      // Advance past the expiry minus 60s buffer (5 min - 60s = 4 min).
      // Advancing 4.5 minutes puts us past the buffer threshold.
      vi.advanceTimersByTime(4.5 * 60 * 1000)

      mockInvoke.mockResolvedValueOnce({
        data: {
          signedUrl: 'https://signed.example.com/refreshed',
          expiresAt: '2025-06-01T13:00:00Z',
        },
        error: null,
      })

      const refreshed = await provider.getSignedPlaybackUrl('asset-expire', 'conv-1')
      expect(refreshed.url).toBe('https://signed.example.com/refreshed')
      // Second API call was made
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
})
