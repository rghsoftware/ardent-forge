import { useCallback } from 'react'
import { Icon } from '@/components/icon'
import { SessionSlot } from './session-slot'
import { removeWeekFromBlock } from './builder-state'
import type { WeekDraft, ProgramDraft } from './builder-state'
import { DAY_COLUMNS } from './constants'
import type { DayOfWeek } from './constants'

// ---------------------------------------------------------------------------
// WeekGrid
// ---------------------------------------------------------------------------

interface WeekGridProps {
  week: WeekDraft
  weekIndex: number
  draft: ProgramDraft
  blockClientId: string
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek: (sourceWeekClientId: string) => void
}

export function WeekGrid({
  week,
  weekIndex,
  draft,
  blockClientId,
  onUpdate,
  onPickSession,
  onCopyWeek,
}: WeekGridProps) {
  // Map sessions by dayOfWeek for quick lookup
  const sessionsByDay = new Map(
    week.sessions.filter((s) => s.dayOfWeek !== null).map((s) => [s.dayOfWeek!, s]),
  )

  const handleCopy = useCallback(() => {
    onCopyWeek(week.clientId)
  }, [week.clientId, onCopyWeek])

  const handleRemoveWeek = useCallback(() => {
    onUpdate(removeWeekFromBlock(draft, blockClientId, week.clientId))
  }, [draft, blockClientId, week.clientId, onUpdate])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
          WEEK {weekIndex + 1}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 text-warm-ash/40 hover:text-ember"
          aria-label={`Copy week ${weekIndex + 1}`}
        >
          <Icon name="content_copy" size={14} />
        </button>
        <button
          type="button"
          onClick={handleRemoveWeek}
          className="p-1 text-warm-ash/40 hover:text-warning-flare"
          aria-label={`Remove week ${weekIndex + 1}`}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {DAY_COLUMNS.map((col) => (
          <div
            key={`header-${col.dayOfWeek}`}
            className="text-center text-[10px] font-medium uppercase tracking-widest text-warm-ash/60"
          >
            {col.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {DAY_COLUMNS.map((col) => (
          <SessionSlot
            key={`slot-${col.dayOfWeek}`}
            session={sessionsByDay.get(col.dayOfWeek)}
            dayOfWeek={col.dayOfWeek}
            weekClientId={week.clientId}
            draft={draft}
            onUpdate={onUpdate}
            onPickSession={onPickSession}
          />
        ))}
      </div>
    </div>
  )
}
