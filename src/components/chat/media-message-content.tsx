import type { MediaAttachment } from '@/domain/types'
import { Icon } from '@/components/icon'
import { MediaStatusIndicator } from './media-status-indicator'
import { FileCard } from './file-card'

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
  // --- Video ---
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

  // --- Image ---
  if (attachment.mediaType === 'image') {
    const imageUrl = attachment.playbackUrl ?? attachment.thumbnailUrl
    if (!imageUrl) return null

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

  // --- File ---
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

  return null
}
