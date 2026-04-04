import { useState, useEffect } from 'react'
import type { MediaAttachment } from '@/domain/types'
import { Icon } from '@/components/icon'
import { getSupabaseClient } from '@/lib/supabase'
import { MediaStatusIndicator } from './media-status-indicator'
import { FileCard } from './file-card'

// ---------------------------------------------------------------------------
// Hook: derive a signed URL from providerAssetId for Supabase Storage assets
// ---------------------------------------------------------------------------

function useStorageSignedUrl(attachment: MediaAttachment): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (attachment.provider !== 'supabase_storage') return
    if (attachment.playbackUrl || attachment.thumbnailUrl) return
    if (!attachment.providerAssetId) return

    const client = getSupabaseClient()
    if (!client) return

    const bucket = attachment.mediaType === 'image' ? 'chat-images' : 'chat-files'

    client.storage
      .from(bucket)
      .createSignedUrl(attachment.providerAssetId, 60 * 60)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to generate signed URL:', error)
          return
        }
        if (data?.signedUrl) setSignedUrl(data.signedUrl)
      })
  }, [attachment.provider, attachment.providerAssetId, attachment.playbackUrl, attachment.thumbnailUrl, attachment.mediaType])

  return signedUrl
}

// ---------------------------------------------------------------------------
// MediaMessageContent -- routes media attachment rendering by type and status
// ---------------------------------------------------------------------------

interface MediaMessageContentProps {
  attachment: MediaAttachment
  isOwn: boolean
  onPlay?: (assetId: string) => void
  onViewFullScreen?: (imageUrl: string) => void
  onDownload?: (providerAssetId: string, filename: string) => void
  onRetry?: () => void
}

export function MediaMessageContent({
  attachment,
  onPlay,
  onViewFullScreen,
  onDownload,
  onRetry,
}: MediaMessageContentProps) {
  const derivedUrl = useStorageSignedUrl(attachment)

  if (attachment.mediaType === 'video') {
    if (attachment.status === 'processing') {
      return <MediaStatusIndicator status="processing" />
    }

    if (attachment.status === 'failed') {
      return <MediaStatusIndicator status="failed" onRetry={onRetry} />
    }

    // ready -- show thumbnail with play overlay
    return (
      <button
        type="button"
        onClick={() => onPlay?.(attachment.providerAssetId ?? attachment.id)}
        className="relative aspect-video w-full overflow-hidden bg-surface-charcoal"
      >
        {attachment.thumbnailUrl ? (
          <img
            src={attachment.thumbnailUrl}
            alt="Video thumbnail"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-surface-steel" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon name="play_circle" size={48} fill className="text-ember drop-shadow-lg" />
        </div>
      </button>
    )
  }

  if (attachment.mediaType === 'image') {
    const imageUrl = attachment.playbackUrl ?? attachment.thumbnailUrl ?? derivedUrl
    if (!imageUrl) {
      return (
        <div className="flex items-center justify-center rounded bg-surface-steel px-4 py-3">
          <span className="text-warm-ash text-xs">Media unavailable</span>
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => onViewFullScreen?.(imageUrl)}
        className="block max-w-[280px] overflow-hidden bg-surface-charcoal"
      >
        <img
          src={imageUrl}
          alt={attachment.originalFilename ?? 'Image'}
          className="w-full object-contain"
        />
      </button>
    )
  }

  if (attachment.mediaType === 'file') {
    return (
      <FileCard
        filename={attachment.originalFilename ?? 'file'}
        mimeType={attachment.mimeType}
        fileSizeBytes={attachment.fileSizeBytes ?? undefined}
        onDownload={() =>
          onDownload?.(
            attachment.providerAssetId ?? attachment.id,
            attachment.originalFilename ?? 'file',
          )
        }
      />
    )
  }

  return (
    <div className="flex items-center justify-center rounded bg-surface-steel px-4 py-3">
      <span className="text-warm-ash text-xs">Media unavailable</span>
    </div>
  )
}
