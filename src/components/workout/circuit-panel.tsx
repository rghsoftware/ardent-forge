import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCountdown } from '@/lib/format-duration'

type CircuitPhase = 'overview' | 'exercise' | 'interExerciseRest' | 'interRoundRest' | 'done'

interface CircuitExercise {
  name: string
  targetReps: number
}

interface CircuitPanelProps {
  exercises: CircuitExercise[]
  rounds: number
  interExerciseRestSeconds?: number
  interRoundRestSeconds?: number
  onComplete: (completedRounds: number) => void
}

export function CircuitPanel({
  exercises,
  rounds,
  interExerciseRestSeconds = 90,
  interRoundRestSeconds = 180,
  onComplete,
}: CircuitPanelProps) {
  const [phase, setPhase] = useState<CircuitPhase>('overview')
  const [currentRound, setCurrentRound] = useState(1)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [completedRounds, setCompletedRounds] = useState(0)
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rest countdown effect
  useEffect(() => {
    if (phase !== 'interExerciseRest' && phase !== 'interRoundRest') {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current)
      return
    }

    restIntervalRef.current = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          // Rest complete: advance to next state
          if (phase === 'interExerciseRest') {
            setCurrentExerciseIndex((idx) => idx + 1)
            setPhase('exercise')
          } else if (phase === 'interRoundRest') {
            setCurrentRound((r) => r + 1)
            setCurrentExerciseIndex(0)
            setPhase('exercise')
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current)
    }
  }, [phase])

  const handleStart = useCallback(() => {
    setPhase('exercise')
    setCurrentRound(1)
    setCurrentExerciseIndex(0)
    setCompletedRounds(0)
  }, [])

  const handleExerciseDone = useCallback(() => {
    const isLastExercise = currentExerciseIndex >= exercises.length - 1
    const isLastRound = currentRound >= rounds

    if (isLastExercise && isLastRound) {
      // Circuit complete -- all rounds finished
      setCompletedRounds(currentRound)
      setPhase('done')
      return
    }

    if (isLastExercise) {
      // End of round, increment completed count and go to inter-round rest
      setCompletedRounds(currentRound)
      setRestSeconds(interRoundRestSeconds)
      setPhase('interRoundRest')
    } else {
      // Inter-exercise rest
      setRestSeconds(interExerciseRestSeconds)
      setPhase('interExerciseRest')
    }
  }, [
    currentExerciseIndex,
    currentRound,
    exercises.length,
    rounds,
    interExerciseRestSeconds,
    interRoundRestSeconds,
  ])

  const handleSkipRest = useCallback(() => {
    if (phase === 'interExerciseRest') {
      setCurrentExerciseIndex((idx) => idx + 1)
      setPhase('exercise')
    } else if (phase === 'interRoundRest') {
      setCurrentRound((r) => r + 1)
      setCurrentExerciseIndex(0)
      setPhase('exercise')
    }
  }, [phase])

  const currentExercise = exercises[currentExerciseIndex]

  return (
    <section className="bg-surface-iron" aria-label="SE circuit">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-display text-xs font-medium uppercase tracking-widest text-ember">
          SE CIRCUIT
        </h3>
      </div>

      {/* Overview phase */}
      {phase === 'overview' && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {/* Round info */}
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl tabular-nums text-bone-white">{rounds}</span>
            <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">ROUNDS</span>
          </div>

          {/* Exercise table */}
          <div className="flex flex-col gap-[0.4rem]">
            {/* Column headers */}
            <div className="flex items-center gap-2 py-1">
              <span className="flex-1 text-[10px] uppercase tracking-widest text-warm-ash/60">
                EXERCISE
              </span>
              <span className="w-16 text-center text-[10px] uppercase tracking-widest text-warm-ash/60">
                REPS
              </span>
            </div>

            {exercises.map((ex, idx) => (
              <div key={idx} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 text-sm text-bone-white">{ex.name}</span>
                <span className="w-16 text-center font-display text-sm tabular-nums text-bone-white">
                  {ex.targetReps}
                </span>
              </div>
            ))}
          </div>

          {/* Start button */}
          <Button variant="default" size="lg" onClick={handleStart} className="mt-2 min-h-12">
            Start circuit
          </Button>
        </div>
      )}

      {/* Exercise phase */}
      {phase === 'exercise' && currentExercise && (
        <div className="flex flex-col items-center gap-4 px-4 py-8">
          {/* Round indicator */}
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">
            ROUND {currentRound} / {rounds}
          </span>

          {/* Exercise name */}
          <span className="font-display text-2xl text-bone-white">{currentExercise.name}</span>

          {/* Target reps */}
          <span className="font-display text-5xl tabular-nums text-ember">
            {currentExercise.targetReps}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">REPS</span>

          {/* Done button */}
          <Button
            variant="default"
            size="lg"
            onClick={handleExerciseDone}
            className="mt-4 min-h-12 min-w-32"
          >
            Done
          </Button>

          {/* Progress */}
          <span className="text-xs tabular-nums text-warm-ash/60">
            {currentExerciseIndex + 1} / {exercises.length}
          </span>
        </div>
      )}

      {/* Inter-exercise rest */}
      {phase === 'interExerciseRest' && (
        <div className="flex flex-col items-center gap-3 px-4 py-8">
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">REST</span>
          <span className="font-display text-5xl tabular-nums tracking-tight text-bone-white">
            {formatCountdown(restSeconds)}
          </span>

          {/* Next exercise preview */}
          {exercises[currentExerciseIndex + 1] && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">NEXT</span>
              <span className="text-sm text-bone-white">
                {exercises[currentExerciseIndex + 1].name}
              </span>
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={handleSkipRest} className="mt-2 text-xs">
            Skip rest
          </Button>
        </div>
      )}

      {/* Inter-round rest */}
      {phase === 'interRoundRest' && (
        <div className="flex flex-col items-center gap-3 px-4 py-8">
          <Badge variant="pending">
            ROUND {currentRound} / {rounds} COMPLETE
          </Badge>
          <span className="mt-2 text-[10px] uppercase tracking-widest text-warm-ash/60">REST</span>
          <span className="font-display text-5xl tabular-nums tracking-tight text-bone-white">
            {formatCountdown(restSeconds)}
          </span>

          <Button variant="ghost" size="sm" onClick={handleSkipRest} className="mt-2 text-xs">
            Skip rest
          </Button>
        </div>
      )}

      {/* Done phase -- reports actual completedRounds, not the rounds prop */}
      {phase === 'done' && (
        <div className="flex flex-col items-center gap-4 px-4 py-8">
          <Badge variant="complete">CIRCUIT COMPLETE</Badge>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl tabular-nums text-bone-white">
              {completedRounds}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">
              ROUNDS COMPLETED
            </span>
          </div>
          <Button
            variant="default"
            size="lg"
            onClick={() => onComplete(completedRounds)}
            className="mt-2 min-h-12"
          >
            Done
          </Button>
        </div>
      )}
    </section>
  )
}
