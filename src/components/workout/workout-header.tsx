import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import { NoteAffordance } from '@/components/workout/notes/note-affordance'
import type { NoteContent } from '@/domain/types'

interface WorkoutHeaderProps {
  elapsedSeconds: number
  isPaused?: boolean
  onPause?: () => void
  onResume?: () => void
  actions?: React.ReactNode
}

export function WorkoutHeader({
  elapsedSeconds,
  isPaused = false,
  onPause,
  onResume,
  actions,
}: WorkoutHeaderProps) {
  const handlePauseToggle = () => {
    if (isPaused) {
      onResume?.()
    } else {
      onPause?.()
    }
  }

  const workoutLog = useActiveWorkoutStore((s) => s.workoutLog)
  const setSessionNote = useActiveWorkoutStore((s) => s.setSessionNote)
  const sessionNote = useMemo<NoteContent>(
    () => ({ text: workoutLog?.overallNotes ?? '', tags: workoutLog?.noteTags ?? [] }),
    [workoutLog?.overallNotes, workoutLog?.noteTags],
  )

  return (
    <header className="heat-blur flex min-h-14 items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-ember text-xl">timer</span>
        <span
          className={cn(
            'font-display text-2xl tabular-nums tracking-tight',
            isPaused ? 'text-ember' : 'text-bone-white',
          )}
        >
          {formatDuration(elapsedSeconds)}
        </span>
        {isPaused && (
          <span className="bg-ember px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-surface-pit">
            Paused
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {workoutLog && (
          <NoteAffordance
            value={sessionNote}
            onChange={setSessionNote}
            level="session"
            variant="inline"
          />
        )}
        {actions}
        {(onPause || onResume) && (
          <button
            type="button"
            onClick={handlePauseToggle}
            aria-label={isPaused ? 'Resume workout' : 'Pause workout'}
            className="flex h-12 w-12 items-center justify-center text-bone-white active:bg-surface-forge"
          >
            <span className="material-symbols-outlined text-2xl">
              {isPaused ? 'play_arrow' : 'pause'}
            </span>
          </button>
        )}
      </div>
    </header>
  )
}
