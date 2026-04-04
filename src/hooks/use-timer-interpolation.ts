import { useState, useEffect, useRef } from 'react'
import type { RestTimerState } from '@/domain/types/display-snapshot'

/**
 * Interpolates a rest timer countdown using requestAnimationFrame and the wall
 * clock. React state updates only when the displayed whole-second value changes,
 * so the component re-renders at most once per second rather than every frame.
 *
 * Returns the remaining seconds as an integer >= 0.
 */
export function useTimerInterpolation(restTimer: RestTimerState): number {
  const [seconds, setSeconds] = useState(0)
  const rafRef = useRef<number>(0)
  const lastSecondRef = useRef<number>(-1)

  // Extract stable dependency values outside the effect to avoid conditional
  // expressions in the dependency array.
  const isRunning = restTimer.state === 'running'
  const startedAt = isRunning ? restTimer.started_at : ''
  const totalSecs = isRunning ? restTimer.total_seconds : 0

  useEffect(() => {
    if (!isRunning) {
      setSeconds(0)
      lastSecondRef.current = -1
      return
    }

    const startedAtMs = new Date(startedAt).getTime()

    function tick() {
      const elapsed = (Date.now() - startedAtMs) / 1000
      const remaining = Math.max(0, Math.ceil(totalSecs - elapsed))

      if (remaining !== lastSecondRef.current) {
        lastSecondRef.current = remaining
        setSeconds(remaining)
      }

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    // Kick off the first frame immediately
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, startedAt, totalSecs])

  return seconds
}
