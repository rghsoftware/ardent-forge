import { getSupabaseClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// MediaProvider interface -- abstracts media hosting backends (CH-12)
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

    const data = response.data as { tusUrl: string; assetId: string }
    return { tusUrl: data.tusUrl, assetId: data.assetId }
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

    const data = response.data as { url: string; expiresAt: string }
    this.signedUrlCache.set(assetId, data)
    return data
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the expiry timestamp is within 60 seconds of now. */
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
