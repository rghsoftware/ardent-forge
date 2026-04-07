import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/icon'
import { removeSession } from './builder-state'
import type { SessionDraft, ProgramDraft } from './builder-state'
import { SESSION_BORDER, SESSION_TINT, SESSION_TYPE_BADGE } from './constants'
import type { DayOfWeek } from './constants'

// ---------------------------------------------------------------------------
// SessionSlot
// ---------------------------------------------------------------------------

interface SessionSlotProps {
  session: SessionDraft | undefined
  dayOfWeek: DayOfWeek
  weekClientId: string
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onPreview?: (sessionTemplateId: string) => void
}

export function SessionSlot({
  session,
  dayOfWeek,
  weekClientId,
  draft,
  onUpdate,
  onPickSession,
  onPreview,
}: SessionSlotProps) {
  const [animating, setAnimating] = useState(false)
  const [prevSessionId, setPrevSessionId] = useState(session?.clientId)

  if (session?.clientId !== prevSessionId) {
    setPrevSessionId(session?.clientId)
    if (session && !prevSessionId) setAnimating(true)
  }

  useEffect(() => {
    if (animating) {
      const t = setTimeout(() => setAnimating(false), 250)
      return () => clearTimeout(t)
    }
  }, [animating])

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (session) {
        const previousDraft = draft
        onUpdate(removeSession(draft, weekClientId, session.clientId))
        toast('Session removed', {
          action: {
            label: 'Undo',
            onClick: () => onUpdate(previousDraft),
          },
          duration: 5000,
        })
      }
    },
    [session, draft, weekClientId, onUpdate],
  )

  const handleClick = useCallback(() => {
    if (!session) {
      onPickSession(weekClientId, dayOfWeek)
    }
  }, [session, weekClientId, dayOfWeek, onPickSession])

  const handlePreview = useCallback(() => {
    if (session && onPreview) {
      onPreview(session.sessionTemplateId)
    }
  }, [session, onPreview])

  const handlePreviewKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handlePreview()
      }
    },
    [handlePreview],
  )

  if (!session) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group flex min-h-[68px] w-full cursor-pointer flex-col items-center justify-center bg-surface-gunmetal/40 transition-colors hover:bg-surface-steel"
        aria-label={`Assign session to day ${dayOfWeek}`}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-warm-ash/25 transition-opacity group-hover:opacity-0">
          Rest
        </span>
        <Icon
          name="add"
          size={18}
          className="absolute text-warm-ash/50 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    )
  }

  const isEvent = session.sessionType === 'EVENT'

  return (
    <div
      role={onPreview ? 'button' : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onClick={onPreview ? handlePreview : undefined}
      onKeyDown={onPreview ? handlePreviewKey : undefined}
      className={`group relative flex min-h-[68px] cursor-pointer flex-col justify-center p-2 transition-colors ${
        SESSION_BORDER[session.sessionType] ?? ''
      } ${
        isEvent ? 'bg-surface-iron' : 'bg-surface-charcoal'
      } ${SESSION_TINT[session.sessionType] ?? ''}`}
      style={animating ? { animation: 'slot-fill 0.2s ease-out both' } : undefined}
      aria-label={`Session: ${session.templateName ?? 'Unnamed'}`}
      title={session.templateName ?? 'Unnamed'}
    >
      {/* Hover-reveal remove overlay */}
      <button
        type="button"
        onClick={handleRemove}
        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-alarm-red/90 py-1 text-[11px] font-medium text-on-alarm opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Remove session"
      >
        <Icon name="close" size={12} />
        Remove
      </button>

      <div className="flex items-start gap-1">
        {isEvent && <Icon name="flag" size={10} fill className="mt-0.5 shrink-0 text-ember" />}
        <span
          className={`line-clamp-2 text-xs leading-tight ${
            isEvent
              ? 'font-display uppercase tracking-wider text-bone-white'
              : 'font-body text-bone-white'
          }`}
        >
          {session.templateName ?? 'Unnamed'}
        </span>
      </div>

      <span
        className={`mt-1 inline-block self-start px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
          SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'
        }`}
      >
        {session.sessionType}
      </span>
    </div>
  )
}
