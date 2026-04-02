import { useCallback } from 'react'
import { Icon } from '@/components/icon'
import { removeSession } from './builder-state'
import type { SessionDraft, ProgramDraft } from './builder-state'
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
}

export function SessionSlot({
  session,
  dayOfWeek,
  weekClientId,
  draft,
  onUpdate,
  onPickSession,
}: SessionSlotProps) {
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (session) {
        onUpdate(removeSession(draft, weekClientId, session.clientId))
      }
    },
    [session, draft, weekClientId, onUpdate],
  )

  const handleClick = useCallback(() => {
    onPickSession(weekClientId, dayOfWeek)
  }, [weekClientId, dayOfWeek, onPickSession])

  if (!session) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex min-h-[80px] w-full cursor-pointer items-center justify-center border border-dashed border-warm-ash/20 bg-surface-gunmetal transition-colors hover:border-warm-ash/40 hover:bg-surface-steel"
        aria-label={`Assign session to day ${dayOfWeek}`}
      >
        <Icon name="add" size={20} className="text-warm-ash/40" />
      </button>
    )
  }

  const isEvent = session.sessionType === 'EVENT'

  return (
    <div
      className={`relative flex min-h-[80px] cursor-pointer flex-col justify-center p-2 transition-colors ${
        isEvent
          ? 'border-l-2 border-ember bg-surface-iron hover:bg-surface-steel'
          : 'bg-surface-charcoal hover:bg-surface-iron'
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      aria-label={`Session: ${session.templateName ?? 'Unnamed'}`}
    >
      <button
        type="button"
        onClick={handleRemove}
        className="absolute right-1 top-1 p-0.5 text-warm-ash/40 hover:text-warning-flare"
        aria-label="Remove session"
      >
        <Icon name="close" size={14} />
      </button>

      <div className="flex items-start gap-1 pr-4">
        {isEvent && <Icon name="flag" size={12} fill className="mt-0.5 shrink-0 text-ember" />}
        <span
          className={`line-clamp-2 text-xs ${
            isEvent
              ? 'font-display uppercase tracking-wider text-bone-white'
              : 'font-body text-bone-white'
          }`}
        >
          {session.templateName ?? 'Unnamed'}
        </span>
      </div>

      <span
        className={`mt-1 inline-block self-start px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
          isEvent ? 'bg-ember/15 text-ember' : 'bg-surface-steel text-warm-ash'
        }`}
      >
        {session.sessionType}
      </span>
    </div>
  )
}
