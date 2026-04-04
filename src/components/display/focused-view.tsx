import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/format-duration'
import { RestTimerDisplay } from '@/components/display/rest-timer-display'
import { SetTable } from '@/components/display/set-table'
import { useDisplayStore } from '@/stores/display-store'

function FocusedView() {
  const focusedUserId = useDisplayStore((s) => s.focusedUserId)
  const sessions = useDisplayStore((s) => s.sessions)

  const snapshot = focusedUserId ? sessions.get(focusedUserId) : undefined

  if (!snapshot) return null

  return <FocusedViewContent key={snapshot.user_id} snapshot={snapshot} />
}

// Separate component so the elapsed timer hook resets properly per user
function FocusedViewContent({
  snapshot,
}: {
  snapshot: ReturnType<typeof useDisplayStore.getState>['sessions'] extends Map<string, infer V>
    ? V
    : never
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const startMs = new Date(snapshot.workout_started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [snapshot.workout_started_at])

  return (
    <div className="flex h-full flex-col items-center justify-center px-12 py-8">
      {/* Header bar */}
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center">
          <span className="font-display text-[2rem] uppercase tracking-wider text-bone-white">
            {snapshot.display_name}
          </span>
          <span className="ml-4 font-sans text-base uppercase tracking-wider text-warm-ash">
            {snapshot.session_type}
          </span>
        </div>
        <span className="font-display text-[1.5rem] text-warm-ash">{formatDuration(elapsed)}</span>
      </div>

      {/* Exercise heading */}
      <div className="mt-6 text-center">
        <p className="font-display text-[2.5rem] text-bone-white">{snapshot.current_exercise}</p>
        <p className="font-sans text-base text-warm-ash">
          Exercise {snapshot.exercise_index + 1} of {snapshot.total_exercises}
        </p>
      </div>

      {/* Set table */}
      <SetTable sets={snapshot.sets} />

      {/* Rest timer */}
      <div className="mt-6">
        <RestTimerDisplay restTimer={snapshot.rest_timer} variant="large" />
      </div>
    </div>
  )
}

export { FocusedView }
