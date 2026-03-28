import { useCallback } from 'react'
import { Icon } from '@/components/icon'
import { SessionSlot } from './session-slot'
import { removeWeekFromBlock } from './builder-state'
import type { WeekDraft, ProgramDraft } from './builder-state'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Day columns: Mon(1) through Sun(0)
const DAY_COLUMNS = [
  { dayOfWeek: 1, label: 'M' },
  { dayOfWeek: 2, label: 'T' },
  { dayOfWeek: 3, label: 'W' },
  { dayOfWeek: 4, label: 'T' },
  { dayOfWeek: 5, label: 'F' },
  { dayOfWeek: 6, label: 'S' },
  { dayOfWeek: 0, label: 'S' },
]

// ---------------------------------------------------------------------------
// WeekGrid
// ---------------------------------------------------------------------------

interface WeekGridProps {
  week: WeekDraft
  weekIndex: number
  draft: ProgramDraft
  blockClientId: string
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
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
      {/* Week header */}
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

      {/* Day column headers */}
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

      {/* Session slots */}
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
