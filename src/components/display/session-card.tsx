import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { formatDuration } from '@/lib/format-duration'
import { RestTimerDisplay } from '@/components/display/rest-timer-display'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'

interface SessionCardProps {
  snapshot: DisplaySnapshot
}

function SessionCard({ snapshot }: SessionCardProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const startMs = new Date(snapshot.workout_started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [snapshot.workout_started_at])

  return (
    <div className="flex h-full flex-col gap-4 bg-surface-iron p-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="font-display text-[1.5rem] uppercase tracking-wider text-bone-white">
          {snapshot.display_name}
        </span>
        <div className="flex items-center gap-4">
          <span className="font-sans text-base uppercase tracking-wider text-warm-ash">
            {snapshot.session_type}
          </span>
          <span className="font-display text-[1.25rem] text-warm-ash">
            {formatDuration(elapsed)}
          </span>
        </div>
      </div>

      {/* Current exercise */}
      <div>
        <p className="font-sans text-[1.25rem] text-bone-white">{snapshot.current_exercise}</p>
        <p className="font-sans text-base text-warm-ash">
          Exercise {snapshot.exercise_index + 1} of {snapshot.total_exercises}
        </p>
      </div>

      {/* Set progress */}
      <div className="flex flex-wrap items-center gap-2">
        {snapshot.sets.map((set) =>
          set.completed ? (
            <CheckCircle2
              key={set.set_number}
              className="h-5 w-5 text-arc"
              aria-label={`Set ${set.set_number} completed`}
            />
          ) : (
            <span
              key={set.set_number}
              className="inline-block h-5 w-5 bg-surface-steel"
              style={{ borderRadius: '50%' }}
              aria-label={`Set ${set.set_number} pending`}
            />
          ),
        )}
      </div>

      {/* Rest timer */}
      {snapshot.rest_timer.state === 'running' && (
        <RestTimerDisplay restTimer={snapshot.rest_timer} variant="compact" />
      )}
    </div>
  )
}

export { SessionCard }
