import { useCallback } from 'react'
import { Icon } from '@/components/icon'
import { removeSession } from './builder-state'
import type { SessionDraft, ProgramDraft } from './builder-state'

// ---------------------------------------------------------------------------
// SessionSlot
// ---------------------------------------------------------------------------

interface SessionSlotProps {
  session: SessionDraft | undefined
  dayOfWeek: number
  weekClientId: string
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
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
    // Empty state
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

  // Filled state
  return (
    <div
      className="relative flex min-h-[80px] cursor-pointer flex-col justify-center bg-surface-charcoal p-2 transition-colors hover:bg-surface-iron"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      aria-label={`Session: ${session.templateName ?? 'Unnamed'}`}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemove}
        className="absolute right-1 top-1 p-0.5 text-warm-ash/40 hover:text-warning-flare"
        aria-label="Remove session"
      >
        <Icon name="close" size={14} />
      </button>

      {/* Template name */}
      <span className="line-clamp-2 pr-4 font-body text-xs text-bone-white">
        {session.templateName ?? 'Unnamed'}
      </span>

      {/* Session type badge */}
      <span className="mt-1 inline-block self-start bg-surface-steel px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-warm-ash">
        {session.sessionType}
      </span>
    </div>
  )
}
