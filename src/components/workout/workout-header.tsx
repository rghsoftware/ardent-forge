import { Button } from '@/components/ui/button'

interface WorkoutHeaderProps {
  elapsedSeconds: number
  onFinish: () => void
  isFinishing?: boolean
  canFinish?: boolean
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

export function WorkoutHeader({
  elapsedSeconds,
  onFinish,
  isFinishing = false,
  canFinish = false,
}: WorkoutHeaderProps) {
  return (
    <header className="heat-blur sticky top-0 z-50 flex min-h-14 items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-ember text-xl">timer</span>
        <span className="font-display text-2xl tabular-nums tracking-tight text-bone-white">
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onFinish}
        disabled={!canFinish || isFinishing}
        className="text-xs font-medium"
      >
        {isFinishing ? 'SAVING...' : 'FINISH'}
      </Button>
    </header>
  )
}
