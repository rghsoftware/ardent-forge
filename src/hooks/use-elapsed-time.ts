import { useState, useEffect } from 'react'

/**
 * Tracks elapsed seconds since a given ISO timestamp, updating once per second.
 * Returns the elapsed time in whole seconds.
 */
export function useElapsedTime(startedAt: string): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const startMs = new Date(startedAt).getTime()
    if (Number.isNaN(startMs)) return
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}
