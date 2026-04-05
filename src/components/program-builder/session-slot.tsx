import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/icon'
import { removeSession } from './builder-state'
import type { SessionDraft, ProgramDraft } from './builder-state'
import { SESSION_TINT, SESSION_TYPE_BADGE } from './constants'
import type { DayOfWeek } from './constants'

const SESSION_BORDER: Record<string, string> = {
  STRENGTH: 'border-l-2 border-ember',
  CONDITIONING: 'border-l-2 border-quenched',
  SE: 'border-l-2 border-arc',
  MIXED: 'border-l-2 border-bone-white/40',
  EVENT: 'border-l-2 border-ember',
}

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
  onEditSession?: (weekClientId: string, session: SessionDraft) => void
}

export function SessionSlot({
  session,
  dayOfWeek,
  weekClientId,
  draft,
  onUpdate,
  onPickSession,
  onEditSession,
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
    if (session && onEditSession) {
      onEditSession(weekClientId, session)
    } else {
      onPickSession(weekClientId, dayOfWeek)
    }
  }, [session, weekClientId, dayOfWeek, onPickSession, onEditSession])

  if (!session) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group flex min-h-[56px] w-full cursor-pointer flex-col items-center justify-center bg-surface-gunmetal/40 transition-colors hover:bg-surface-steel"
        aria-label={`Assign session to day ${dayOfWeek}`}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/25 transition-opacity group-hover:opacity-0">
          Rest
        </span>
        <Icon
          name="add"
          size={16}
          className="absolute text-warm-ash/40 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    )
  }

  const isEvent = session.sessionType === 'EVENT'
  const hasCustomizations =
    !!session.notes ||
    (session.overrides?.activityOverrides &&
      Object.keys(session.overrides.activityOverrides).length > 0)

  return (
    <div
      className={`relative flex min-h-[56px] cursor-pointer flex-col justify-center p-1.5 transition-colors ${
        SESSION_BORDER[session.sessionType] ?? ''
      } ${
        isEvent
          ? 'bg-surface-iron hover:bg-surface-steel'
          : 'bg-surface-charcoal hover:bg-surface-iron'
      } ${SESSION_TINT[session.sessionType] ?? ''}`}
      style={animating ? { animation: 'slot-fill 0.2s ease-out both' } : undefined}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      aria-label={`Session: ${session.templateName ?? 'Unnamed'}`}
      title={session.templateName ?? 'Unnamed'}
    >
      <button
        type="button"
        onClick={handleRemove}
        className="absolute right-0.5 top-0.5 p-0.5 text-warm-ash/40 hover:text-warning-flare"
        aria-label="Remove session"
      >
        <Icon name="close" size={12} />
      </button>

      <div className="flex items-start gap-1 pr-4">
        {isEvent && <Icon name="flag" size={10} fill className="mt-0.5 shrink-0 text-ember" />}
        <span
          className={`line-clamp-2 text-[11px] leading-tight ${
            isEvent
              ? 'font-display uppercase tracking-wider text-bone-white'
              : 'font-body text-bone-white'
          }`}
        >
          {session.templateName ?? 'Unnamed'}
        </span>
      </div>

      <div className="mt-0.5 flex items-center gap-1">
        <span
          className={`inline-block self-start px-1 py-px text-[9px] font-medium uppercase tracking-wider ${
            SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'
          }`}
        >
          {session.sessionType}
        </span>
        {hasCustomizations && <Icon name="edit_note" size={12} className="text-arc/70" />}
      </div>
    </div>
  )
}
