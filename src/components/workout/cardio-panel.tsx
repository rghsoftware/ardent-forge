import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import type { Exercise } from '@/domain/types'

type CardioMode = 'RUN' | 'CYCLE' | 'SWIM' | 'ROW'

const CARDIO_MODES: { mode: CardioMode; icon: string; label: string }[] = [
  { mode: 'RUN', icon: 'directions_run', label: 'RUN' },
  { mode: 'CYCLE', icon: 'pedal_bike', label: 'CYCLE' },
  { mode: 'SWIM', icon: 'pool', label: 'SWIM' },
  { mode: 'ROW', icon: 'rowing', label: 'ROW' },
]

interface CardioPanelProps {
  loggedActivityId: string
  exercise: Exercise
  onComplete: (data: {
    durationSeconds: number
    distance: string
    modality: CardioMode
    heartRate?: string
  }) => void
}

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

function computePace(durationSeconds: number, distanceStr: string): string {
  const dist = parseFloat(distanceStr)
  if (!dist || dist <= 0 || durationSeconds <= 0) return '--'
  const minutesPerUnit = durationSeconds / 60 / dist
  const paceMin = Math.floor(minutesPerUnit)
  const paceSec = Math.round((minutesPerUnit - paceMin) * 60)
  return `${paceMin}:${String(paceSec).padStart(2, '0')}`
}

export function CardioPanel({
  loggedActivityId: _loggedActivityId,
  exercise,
  onComplete,
}: CardioPanelProps) {
  const [modality, setModality] = useState<CardioMode>('RUN')
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [distance, setDistance] = useState('')
  const [heartRate, setHeartRate] = useState('')
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
    } else {
      setIsRunning(true)
      setStopped(false)
    }
  }, [isRunning])

  const handleConfirm = useCallback(() => {
    onComplete({
      durationSeconds: elapsedSeconds,
      distance,
      modality,
      heartRate: heartRate || undefined,
    })
  }, [elapsedSeconds, distance, modality, heartRate, onComplete])

  return (
    <section className="bg-surface-iron" aria-label={`${exercise.name} cardio session`}>
      {/* Exercise name */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-display text-xs font-medium uppercase tracking-widest text-ember">
          {exercise.name}
        </h3>
      </div>

      {/* Modality selector chips */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
        {CARDIO_MODES.map(({ mode, icon, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => !isRunning && !stopped && setModality(mode)}
            disabled={isRunning || stopped}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
              modality === mode
                ? 'bg-forge text-on-forge'
                : 'bg-surface-steel text-bone-white/70 disabled:opacity-40'
            }`}
          >
            <Icon name={icon} size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center py-6">
        <span className="font-display text-5xl tabular-nums tracking-tight text-bone-white">
          {formatTimer(elapsedSeconds)}
        </span>
      </div>

      {/* Start/Stop button */}
      {!stopped && (
        <div className="flex justify-center pb-4">
          <Button
            variant={isRunning ? 'secondary' : 'default'}
            size="lg"
            onClick={handleStartStop}
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
              {formatTimer(elapsedSeconds)}
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
                {computePace(elapsedSeconds, distance)} /unit
              </span>
            </div>
          )}

          {/* Heart rate (optional) */}
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-warm-ash/60">
              AVG HEART RATE (OPTIONAL)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="--"
              className="w-full border-b border-warm-ash/30 bg-transparent py-2 font-display text-lg tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            />
          </div>

          {/* Confirm button */}
          <Button variant="default" size="lg" onClick={handleConfirm} className="mt-2 min-h-12">
            LOG CARDIO
          </Button>
        </div>
      )}
    </section>
  )
}
