import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface WorkoutPausedBarProps {
  isPaused: boolean
  onResume: () => void
  onFinish: () => void
  isFinishing: boolean
  canFinish: boolean
  onDiscard: () => void
  showFinishHelper: boolean
}

export function WorkoutPausedBar({
  isPaused,
  onResume,
  onFinish,
  isFinishing,
  canFinish,
  onDiscard,
  showFinishHelper,
}: WorkoutPausedBarProps) {
  const tabIndex = isPaused ? 0 : -1
  const ariaHidden = !isPaused

  return (
    <div
      data-paused={isPaused}
      aria-hidden={ariaHidden}
      className={cn(
        'overflow-hidden bg-surface-charcoal transition-[max-height,opacity] duration-200 ease-out',
        isPaused ? 'max-h-16 opacity-100' : 'pointer-events-none max-h-0 opacity-0',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <Button
          type="button"
          variant="outline"
          onClick={onResume}
          tabIndex={tabIndex}
          aria-hidden={ariaHidden}
          className="min-h-12"
        >
          <ChevronLeft className="h-4 w-4" />
          Resume
        </Button>

        <div className="ml-auto flex items-center gap-3">
          {showFinishHelper && (
            <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
              Log a set before finishing
            </span>
          )}
          <Button
            type="button"
            variant={canFinish ? 'molten' : 'outline'}
            onClick={onFinish}
            disabled={!canFinish || isFinishing}
            tabIndex={tabIndex}
            aria-hidden={ariaHidden}
            className="min-h-12 px-5 text-sm font-bold uppercase tracking-widest"
          >
            {isFinishing ? 'Saving...' : 'Finish'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            tabIndex={tabIndex}
            aria-hidden={ariaHidden}
            className="min-h-12 text-warning-flare"
          >
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}
