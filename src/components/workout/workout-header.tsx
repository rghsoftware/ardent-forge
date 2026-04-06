import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format-duration'
import { cn } from '@/lib/utils'

interface WorkoutHeaderProps {
  elapsedSeconds: number
  onFinish: () => void
  isFinishing?: boolean
  canFinish?: boolean
  isPaused?: boolean
  onPause?: () => void
  onResume?: () => void
}

export function WorkoutHeader({
  elapsedSeconds,
  onFinish,
  isFinishing = false,
  canFinish = false,
  isPaused = false,
  onPause,
  onResume,
}: WorkoutHeaderProps) {
  const handlePauseToggle = () => {
    if (isPaused) {
      onResume?.()
    } else {
      onPause?.()
    }
  }

  return (
    <header className="heat-blur sticky top-0 z-50 flex min-h-14 items-center justify-between px-4 py-2">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onFinish}
          disabled={!canFinish || isFinishing}
          className="min-h-12 text-xs font-medium"
        >
          {isFinishing ? 'SAVING...' : 'FINISH'}
        </Button>
      </div>
    </header>
  )
}
