import type { MediaAttachment, Message } from '@/domain/types'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { MediaMessageContent } from './media-message-content'
import { MediaStatusIndicator } from './media-status-indicator'

// ---------------------------------------------------------------------------
// MessageBubble -- renders a single chat message with own/other styling
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showSender: boolean
  isPending: boolean
  attachment?: MediaAttachment
  onVideoPlay?: (assetId: string) => void
  onImageView?: (imageUrl: string) => void
  onFileDownload?: (providerAssetId: string, filename: string) => void
  onRetry?: () => void
}

export function MessageBubble({
  message,
  isOwn,
  showSender,
  isPending,
  attachment,
  onVideoPlay,
  onImageView,
  onFileDownload,
  onRetry,
}: MessageBubbleProps) {
  const { data: senderProfile } = useUserProfile(showSender ? (message.senderId ?? '') : '')
  const senderName = senderProfile?.displayName ?? 'Unknown'

  const isMedia = message.messageType === 'media'

  return (
    <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[75%] flex flex-col">
        {showSender && !isOwn && <span className="text-xs text-ember mb-1 px-3">{senderName}</span>}

        <div className="flex items-end gap-1.5">
          {isOwn && isPending && (
            <Icon name="schedule" size={16} className="text-warm-ash/50 shrink-0 mb-0.5" />
          )}

          {isMedia ? (
            <div className={cn('overflow-hidden', isOwn ? 'bg-surface-steel' : 'bg-surface-iron')}>
              {attachment ? (
                <MediaMessageContent
                  attachment={attachment}
                  isOwn={isOwn}
                  onPlay={onVideoPlay}
                  onViewFullScreen={onImageView}
                  onDownload={onFileDownload}
                  onRetry={onRetry}
                />
              ) : (
                <MediaStatusIndicator status="processing" />
              )}
            </div>
          ) : (
            <div className={cn('px-3 py-2', isOwn ? 'bg-surface-steel' : 'bg-surface-iron')}>
              <p className="text-sm text-bone-white whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SystemMessage -- centered, non-bubble message for system events
// ---------------------------------------------------------------------------

interface SystemMessageProps {
  message: Message
}

export function SystemMessage({ message }: SystemMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <p className="text-xs text-warm-ash/60">{message.content}</p>
    </div>
  )
}
