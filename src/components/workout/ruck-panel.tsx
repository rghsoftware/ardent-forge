import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { formatDuration, computePaceFromString } from '@/lib/format-duration'

interface RuckPanelProps {
  onComplete: (data: {
    loadWeight: string
    durationSeconds: number
    distance: string
    elevation?: string
  }) => void
}

export function RuckPanel({ onComplete }: RuckPanelProps) {
  const [load, setLoad] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [distance, setDistance] = useState('')
  const [elevation, setElevation] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning])

  const handleStartStop = useCallback(() => {
    if (isRunning) {
      setIsRunning(false)
      setStopped(true)
    } else if (load) {
      setIsRunning(true)
      setStopped(false)
    }
  }, [isRunning, load])

  const handleConfirm = useCallback(() => {
    onComplete({
      loadWeight: load,
      durationSeconds: elapsedSeconds,
      distance,
      elevation: elevation || undefined,
    })
  }, [load, elapsedSeconds, distance, elevation, onComplete])

  return (
    <section className="bg-surface-iron" aria-label="Ruck session">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-display text-xs font-medium uppercase tracking-widest text-ember">
          RUCK MARCH
        </h3>
      </div>

      {/* Load weight input -- shown before start */}
      {!isRunning && !stopped && (
        <div className="px-4 pb-4">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-warm-ash/60">
            RUCK LOAD (LB)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            placeholder="45"
            className="w-full border-b-2 border-warm-ash/30 bg-transparent py-2 font-display text-2xl tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            aria-label="Ruck load weight"
          />
        </div>
      )}

      {/* Load display when running/stopped */}
      {(isRunning || stopped) && (
        <div className="px-4 pb-2">
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">LOAD</span>
          <span className="ml-2 font-display text-sm tabular-nums text-bone-white">{load} LB</span>
        </div>
      )}

      {/* Timer display */}
      <div className="flex flex-col items-center py-6">
        <span className="font-display text-5xl tabular-nums tracking-tight text-bone-white">
          {formatDuration(elapsedSeconds)}
        </span>
      </div>

      {/* Start/Stop button */}
      {!stopped && (
        <div className="flex justify-center pb-4">
          <Button
            variant={isRunning ? 'secondary' : 'default'}
            size="lg"
            onClick={handleStartStop}
            disabled={!isRunning && !load}
            className="min-h-12 min-w-32"
          >
            {isRunning ? 'STOP' : 'START'}
          </Button>
        </div>
      )}

      {/* Post-stop inputs */}
      {stopped && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* Duration (auto-filled) */}
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-warm-ash/60">
              DURATION
            </span>
            <span className="font-display text-lg tabular-nums text-bone-white">
              {formatDuration(elapsedSeconds)}
            </span>
          </div>

          {/* Distance */}
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-warm-ash/60">
              DISTANCE
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0.0"
              className="w-full border-b border-warm-ash/30 bg-transparent py-2 font-display text-lg tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            />
          </div>

          {/* Pace (calculated) */}
          {distance && (
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-widest text-warm-ash/60">
                PACE
              </span>
              <span className="font-display text-lg tabular-nums text-bone-white">
                {computePaceFromString(elapsedSeconds, distance)} /unit
              </span>
            </div>
          )}

          {/* Elevation (optional) */}
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-warm-ash/60">
              ELEVATION GAIN (OPTIONAL)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              placeholder="--"
              className="w-full border-b border-warm-ash/30 bg-transparent py-2 font-display text-lg tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            />
          </div>

          {/* Confirm -- disabled when timer has not run */}
          <Button
            variant="default"
            size="lg"
            onClick={handleConfirm}
            disabled={elapsedSeconds === 0}
            className="mt-2 min-h-12"
          >
            LOG RUCK
          </Button>
        </div>
      )}
    </section>
  )
}
