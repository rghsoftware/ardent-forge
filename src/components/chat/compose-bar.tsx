import { useCallback, useRef, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { useSendMessage } from '@/hooks/use-chat'
import { getRealtimeManager } from '@/lib/realtime-manager'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { AttachmentPicker } from './attachment-picker'

interface ComposeBarProps {
  conversationId: string
  onSend: () => void
  disabled?: boolean
}

export function ComposeBar({ conversationId, onSend, disabled }: ComposeBarProps) {
  const [content, setContent] = useState('')
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [sendError, setSendError] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useSendMessage()
  const { user } = useAuth()
  const { data: currentUserProfile } = useUserProfile(user?.id ?? '')

  const hasContent = content.trim().length > 0

  const resetTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || disabled) return

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
  }, [content, conversationId, disabled, onSend, resetTextarea, sendMessage])

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
      <div
        className={cn(
          'sticky bottom-0 flex flex-row items-end gap-2 border-t border-ghost-line/15 bg-surface-anvil px-4 py-3',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <button
          type="button"
          className="shrink-0 pb-0.5 text-warm-ash/50 transition-colors hover:text-warm-ash"
          onClick={() => setAttachmentOpen(true)}
          disabled={disabled}
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
          disabled={disabled}
          className="min-h-[36px] max-h-[120px] flex-1 resize-none border-b-2 border-surface-steel bg-transparent py-1 font-body text-sm text-bone-white placeholder:text-warm-ash/50 focus:border-ember focus:outline-none"
        />

        <button
          type="button"
          className={cn(
            'shrink-0 pb-0.5 transition-colors',
            hasContent ? 'text-ember hover:text-ember/80' : 'text-warm-ash/30',
          )}
          onClick={() => void handleSubmit()}
          disabled={disabled || !hasContent}
          aria-label="Send message"
        >
          <Icon name="send" size={22} />
        </button>
      </div>

      <AttachmentPicker open={attachmentOpen} onOpenChange={setAttachmentOpen} />
    </>
  )
}
