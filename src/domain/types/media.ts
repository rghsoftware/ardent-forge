import { z } from 'zod'
import { entityId, syncableEntitySchema } from './units'

// ---------------------------------------------------------------------------
// MediaProvider -- where the media asset is hosted
// ---------------------------------------------------------------------------

export const mediaProviderSchema = z.enum(['cloudflare_stream', 'supabase_storage'])
export type MediaProvider = z.infer<typeof mediaProviderSchema>

// ---------------------------------------------------------------------------
// MediaType -- classification of the attached media
// ---------------------------------------------------------------------------

export const mediaTypeSchema = z.enum(['video', 'image', 'file'])
export type MediaType = z.infer<typeof mediaTypeSchema>

// ---------------------------------------------------------------------------
// MediaStatus -- processing lifecycle of the media asset
// ---------------------------------------------------------------------------

export const mediaStatusSchema = z.enum(['processing', 'ready', 'failed'])
export type MediaStatus = z.infer<typeof mediaStatusSchema>

// ---------------------------------------------------------------------------
// MediaAttachment -- metadata for a media file attached to a message
// Stores only metadata; binary data lives in the provider (CH-12, TA-12).
// ---------------------------------------------------------------------------

export const mediaAttachmentSchema = syncableEntitySchema.extend({
  messageId: entityId,
  provider: mediaProviderSchema,
  providerAssetId: z.string().optional(),
  mediaType: mediaTypeSchema,
  originalFilename: z.string().optional(),
  mimeType: z.string().optional(),
  thumbnailUrl: z.url().optional(),
  playbackUrl: z.url().optional(),
  durationSeconds: z.number().int().optional(),
  fileSizeBytes: z.number().int().optional(),
  status: mediaStatusSchema,
})
export type MediaAttachment = z.infer<typeof mediaAttachmentSchema>
