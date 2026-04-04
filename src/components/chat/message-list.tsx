import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMessages } from '@/hooks/use-chat'
import { useMediaAttachments } from '@/hooks/use-media-attachments'
import { getMediaProvider } from '@/lib/media-provider'
import { getSupabaseClient } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { MessageBubble, SystemMessage } from './message-bubble'
import { VideoPlayer } from './video-player'
import { ImageLightbox } from './image-lightbox'
import type { ConversationType, Message } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageListItem =
  | { type: 'date-separator'; key: string; date: string }
  | { type: 'timestamp'; key: string; time: string }
  | { type: 'message'; key: string; message: Message; showSender: boolean }

interface MessageListProps {
  conversationId: string
  conversationType: ConversationType
  blockedUserIds: Set<string>
  currentUserId: string
  onNewMessageAtBottom?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIVE_MINUTES_MS = 5 * 60 * 1000

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDateLabel(date: Date): string {
  const now = new Date()
  if (isSameDay(date, now)) return 'TODAY'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'YESTERDAY'

  return date
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase()
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Derive the heterogeneous item list from flat messages
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function deriveItems(
  messages: Message[],
  blockedUserIds: Set<string>,
  conversationType: ConversationType,
): MessageListItem[] {
  const filtered = messages.filter((m) => !m.senderId || !blockedUserIds.has(m.senderId))

  const items: MessageListItem[] = []
  let prevDate: Date | null = null
  let prevTime: Date | null = null
  let prevSenderId: string | null = null

  for (const msg of filtered) {
    const msgDate = new Date(msg.createdAt)

    // Date separator at day boundaries
    if (!prevDate || !isSameDay(prevDate, msgDate)) {
      items.push({
        type: 'date-separator',
        key: `date-${msg.createdAt}`,
        date: formatDateLabel(msgDate),
      })
      prevSenderId = null
      prevTime = null
    }

    // Timestamp cluster when gap > 5 minutes
    if (prevTime && msgDate.getTime() - prevTime.getTime() > FIVE_MINUTES_MS) {
      items.push({
        type: 'timestamp',
        key: `ts-${msg.createdAt}`,
        time: formatTime(msgDate),
      })
      prevSenderId = null
    }

    // Show sender on first message after gap or sender change (group only)
    const showSender =
      conversationType === 'group' &&
      msg.messageType !== 'system' &&
      (prevSenderId !== msg.senderId || prevSenderId === null)

    items.push({
      type: 'message',
      key: msg.id,
      message: msg,
      showSender,
    })

    prevDate = msgDate
    prevTime = msgDate
    prevSenderId = msg.senderId ?? null
  }

  return items
}

// ---------------------------------------------------------------------------
// Date separator
// ---------------------------------------------------------------------------

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-3">
      <span className="bg-surface-charcoal px-3 py-1 text-xs text-warm-ash/60 tracking-wider">
        {date}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timestamp cluster
// ---------------------------------------------------------------------------

function TimestampCluster({ time }: { time: string }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className="text-xs text-warm-ash/40">{time}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageList
// ---------------------------------------------------------------------------

export function MessageList({
  conversationId,
  conversationType,
  blockedUserIds,
  currentUserId,
  onNewMessageAtBottom,
}: MessageListProps) {
  const { data, fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage, isLoading, isError } =
    useMessages(conversationId)

  const allMessages = useMemo(() => data?.allMessages ?? [], [data])

  const items = useMemo(
    () => deriveItems(allMessages, blockedUserIds, conversationType),
    [allMessages, blockedUserIds, conversationType],
  )

  // ---- Media attachments ----
  const mediaMessageIds = useMemo(
    () => allMessages.filter((m) => m.messageType === 'media').map((m) => m.id),
    [allMessages],
  )
  const { attachments, error: mediaError } = useMediaAttachments(mediaMessageIds)

  if (mediaError) {
    console.error('[media] Failed to load media attachments:', mediaError)
  }

  // ---- Media overlay state ----
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // ---- Media action handlers ----
  const handleVideoPlay = useCallback(
    async (assetId: string) => {
      try {
        const { url } = await getMediaProvider().getSignedPlaybackUrl(assetId, conversationId)
        setVideoUrl(url)
      } catch (err) {
        console.error('[media] Failed to get video playback URL:', err)
      }
    },
    [conversationId],
  )

  const handleImageView = useCallback((imageUrl: string) => {
    setLightboxUrl(imageUrl)
  }, [])

  const handleFileDownload = useCallback(async (providerAssetId: string, _filename: string) => {
    try {
      const client = getSupabaseClient()
      if (!client) return
      const { data: signedData } = await client.storage
        .from('chat-files')
        .createSignedUrl(providerAssetId, 3600)
      if (signedData?.signedUrl) {
        window.open(signedData.signedUrl, '_blank')
      }
    } catch (err) {
      console.error('[media] Failed to generate download URL:', err)
    }
  }, [])

  const parentRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const prevCountRef = useRef(items.length)
  const didInitialScroll = useRef(false)

  // ---- Virtualizer ----
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = items[index]
      if (!item) return 64
      if (item.type === 'date-separator') return 32
      if (item.type === 'timestamp') return 24
      return 64
    },
    overscan: 10,
  })

  // ---- Helpers ----
  const isNearBottom = useCallback(() => {
    const el = parentRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const scrollToBottom = useCallback(() => {
    if (items.length === 0) return
    virtualizer.scrollToIndex(items.length - 1, { align: 'end' })
  }, [items.length, virtualizer])

  // ---- Initial scroll to bottom ----
  useEffect(() => {
    if (items.length > 0 && !didInitialScroll.current) {
      didInitialScroll.current = true
      // Small delay so virtualizer has measured
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [items.length, scrollToBottom])

  // ---- Auto-scroll on new messages ----
  useEffect(() => {
    if (items.length > prevCountRef.current) {
      if (isNearBottom()) {
        requestAnimationFrame(() => scrollToBottom())
        onNewMessageAtBottom?.()
      } else {
        setShowScrollButton(true)
      }
    }
    prevCountRef.current = items.length
  }, [items.length, isNearBottom, scrollToBottom, onNewMessageAtBottom])

  // ---- Scroll listener for button visibility + infinite scroll ----
  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    const handleScroll = () => {
      // Hide scroll button when near bottom
      if (isNearBottom()) {
        setShowScrollButton(false)
      }

      // Infinite scroll: fetch older messages when near top
      if (el.scrollTop < 200 && hasPreviousPage && !isFetchingPreviousPage) {
        void fetchPreviousPage()
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage, isNearBottom])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Icon name="progress_activity" size={24} className="animate-spin text-warm-ash/40" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <Icon name="cloud_off" size={32} className="text-warm-ash/30" />
        <p className="text-sm text-warm-ash/60">Failed to load messages</p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={parentRef} className="h-full overflow-y-auto">
        {/* Loading older messages spinner */}
        {isFetchingPreviousPage && (
          <div className="flex items-center justify-center py-4">
            <Icon name="progress_activity" size={20} className="animate-spin text-warm-ash/40" />
          </div>
        )}

        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index]
            if (!item) return null

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.type === 'date-separator' && <DateSeparator date={item.date} />}
                {item.type === 'timestamp' && <TimestampCluster time={item.time} />}
                {item.type === 'message' && (
                  <div className="px-4">
                    {item.message.messageType === 'system' ? (
                      <SystemMessage message={item.message} />
                    ) : (
                      <MessageBubble
                        message={item.message}
                        isOwn={item.message.senderId === currentUserId}
                        showSender={item.showSender}
                        isPending={item.message.syncStatus === 'pending'}
                        attachment={attachments.get(item.message.id)}
                        onVideoPlay={handleVideoPlay}
                        onImageView={handleImageView}
                        onFileDownload={handleFileDownload}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollButton && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom()
            setShowScrollButton(false)
          }}
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
            'flex items-center gap-1 bg-surface-steel px-3 py-1.5',
            'text-xs text-bone-white hover:bg-surface-iron transition-colors',
          )}
        >
          <Icon name="keyboard_arrow_down" size={16} />
          New messages
        </button>
      )}

      {/* Media overlays */}
      {videoUrl && <VideoPlayer signedUrl={videoUrl} onClose={() => setVideoUrl(null)} />}
      {lightboxUrl && <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}
