import { z } from 'zod'
import { getSupabaseClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// MediaProvider interface -- abstracts media hosting backends (CH-6)
// ---------------------------------------------------------------------------

export interface MediaProvider {
  getUploadUrl(metadata: {
    maxDurationSeconds: number
  }): Promise<{ tusUrl: string; assetId: string }>

  getSignedPlaybackUrl(
    assetId: string,
    conversationId: string,
  ): Promise<{ url: string; expiresAt: string }>
}

// ---------------------------------------------------------------------------
// Cloudflare Stream implementation
// ---------------------------------------------------------------------------

interface CachedSignedUrl {
  url: string
  expiresAt: string
}

const uploadUrlResponseSchema = z.object({
  tusUrl: z.string(),
  assetId: z.string(),
})

const signedUrlResponseSchema = z.object({
  signedUrl: z.string(),
  expiresAt: z.string(),
})

class CloudflareStreamProvider implements MediaProvider {
  private signedUrlCache = new Map<string, CachedSignedUrl>()

  async getUploadUrl(metadata: {
    maxDurationSeconds: number
  }): Promise<{ tusUrl: string; assetId: string }> {
    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not initialized')

    const {
      data: { session },
    } = await client.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await client.functions.invoke('chat-media-upload-url', {
      body: { maxDurationSeconds: metadata.maxDurationSeconds },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (response.error) {
      throw new Error(`Failed to get upload URL: ${response.error.message ?? 'Unknown error'}`)
    }

    const parsed = uploadUrlResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(`Invalid upload URL response: ${parsed.error.message}`)
    }
    return { tusUrl: parsed.data.tusUrl, assetId: parsed.data.assetId }
  }

  async getSignedPlaybackUrl(
    assetId: string,
    conversationId: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const cached = this.signedUrlCache.get(assetId)
    if (cached && !isExpired(cached.expiresAt)) {
      return cached
    }

    const client = getSupabaseClient()
    if (!client) throw new Error('Supabase client not initialized')

    const {
      data: { session },
    } = await client.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await client.functions.invoke('chat-media-signed-url', {
      body: { assetId, conversationId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (response.error) {
      throw new Error(`Failed to get signed URL: ${response.error.message ?? 'Unknown error'}`)
    }

    const parsed = signedUrlResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(`Invalid signed URL response: ${parsed.error.message}`)
    }
    const result: CachedSignedUrl = { url: parsed.data.signedUrl, expiresAt: parsed.data.expiresAt }
    this.signedUrlCache.set(assetId, result)
    return result
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the expiry timestamp will expire within the next 60 seconds. */
function isExpired(expiresAt: string): boolean {
  const expiryMs = new Date(expiresAt).getTime()
  const bufferMs = 60 * 1000
  return Date.now() >= expiryMs - bufferMs
}

// ---------------------------------------------------------------------------
// Factory (singleton)
// ---------------------------------------------------------------------------

let _provider: MediaProvider | null = null

export function getMediaProvider(): MediaProvider {
  if (!_provider) {
    _provider = new CloudflareStreamProvider()
  }
  return _provider
}
