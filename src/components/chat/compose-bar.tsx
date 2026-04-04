import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { useSendMessage } from '@/hooks/use-chat'
import { getRealtimeManager } from '@/lib/realtime-manager'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useMediaUpload } from '@/hooks/use-media-upload'
import { AttachmentPicker } from './attachment-picker'
import { UploadProgress } from './upload-progress'
import type { MediaType } from '@/domain/types'

interface ComposeBarProps {
  conversationId: string
  onSend: () => void
  disabled?: boolean
}

export function ComposeBar({ conversationId, onSend, disabled }: ComposeBarProps) {
  const [content, setContent] = useState('')
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [uploadFilename, setUploadFilename] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useSendMessage()
  const { user } = useAuth()
  const { data: currentUserProfile } = useUserProfile(user?.id ?? '')
  const {
    upload,
    progress,
    isUploading,
    error: uploadError,
    cancel,
    retry,
  } = useMediaUpload(conversationId)

  const hasContent = content.trim().length > 0
  const isBusy = isUploading || disabled

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleFileSelected = useCallback(
    (file: File, type: MediaType) => {
      setUploadFilename(file.name)
      void upload(file, type)
    },
    [upload],
  )

  const handleCancel = useCallback(() => {
    cancel()
    setUploadFilename(null)
  }, [cancel])

  const handleRetry = useCallback(() => {
    retry()
  }, [retry])

  const resetTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isBusy) return

    setContent('')
    setSendError(false)
    resetTextarea()

    try {
      await sendMessage.mutateAsync({
        conversationId,
        messageType: 'text',
        content: trimmed,
      })
      onSend()
    } catch {
      setContent(trimmed)
      setSendError(true)
    }
  }, [content, conversationId, isBusy, onSend, resetTextarea, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value)

      // Auto-resize textarea
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`

      // Broadcast typing indicator
      if (user?.id) {
        getRealtimeManager()?.broadcastTyping(
          conversationId,
          user.id,
          currentUserProfile?.displayName ?? user.email ?? 'Unknown',
        )
      }
    },
    [conversationId, user, currentUserProfile?.displayName],
  )

  return (
    <>
      {sendError && (
        <div className="bg-surface-anvil px-4 py-1.5 border-t border-ghost-line/15">
          <p className="text-xs text-red-400">Failed to send. Try again.</p>
        </div>
      )}
      {uploadError && !isUploading && (
        <div className="bg-surface-anvil px-4 py-1.5 border-t border-ghost-line/15 flex items-center justify-between">
          <p className="text-xs text-red-400">{uploadError}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs text-ember hover:text-ember/80 transition-colors ml-2 shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      {isUploading && uploadFilename && (
        <div className="border-t border-ghost-line/15">
          <UploadProgress
            progress={progress * 100}
            filename={uploadFilename}
            onCancel={handleCancel}
          />
        </div>
      )}
      <div
        className={cn(
          'sticky bottom-0 flex flex-row items-end gap-2 border-t border-ghost-line/15 bg-surface-anvil px-4 py-3',
          isBusy && 'pointer-events-none opacity-50',
        )}
      >
        <button
          type="button"
          className="shrink-0 pb-0.5 text-warm-ash/50 transition-colors hover:text-warm-ash"
          onClick={() => setAttachmentOpen(true)}
          disabled={isBusy}
          aria-label="Attach file"
        >
          <Icon name="attach_file" size={22} />
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          disabled={isBusy}
          className="min-h-[36px] max-h-[120px] flex-1 resize-none border-b-2 border-surface-steel bg-transparent py-1 font-body text-sm text-bone-white placeholder:text-warm-ash/50 focus:border-ember focus:outline-none"
        />

        <button
          type="button"
          className={cn(
            'shrink-0 pb-0.5 transition-colors',
            hasContent && !isBusy ? 'text-ember hover:text-ember/80' : 'text-warm-ash/30',
          )}
          onClick={() => void handleSubmit()}
          disabled={isBusy || !hasContent}
          aria-label="Send message"
        >
          <Icon name="send" size={22} />
        </button>
      </div>

      <AttachmentPicker
        open={attachmentOpen}
        onOpenChange={setAttachmentOpen}
        onFileSelected={handleFileSelected}
        isOnline={isOnline}
      />
    </>
  )
}
