import { cn } from '@/lib/utils'

interface GhostSessionPreviewProps {
  className?: string
}

const GHOST_SESSIONS = [
  {
    title: 'Upper Push A',
    exercises: 'Bench Press, OHP, Lateral Raises',
    duration: '48:22',
    sets: 18,
    even: true,
  },
  {
    title: 'Lower B — Squat',
    exercises: 'Back Squat, Romanian Deadlift, Leg Press',
    duration: '55:10',
    sets: 15,
    even: false,
  },
  {
    title: 'Pull — Back & Biceps',
    exercises: 'Deadlift, Barbell Row, Pull-up',
    duration: '42:00',
    sets: 14,
    even: true,
  },
] as const

export function GhostSessionPreview({ className }: GhostSessionPreviewProps) {
  return (
    <div className={cn('flex flex-col opacity-25 pointer-events-none select-none', className)}>
      {GHOST_SESSIONS.map((row) => (
        <div
          key={row.title}
          className={`flex min-h-[60px] items-center justify-between px-4 py-3 ${row.even ? 'bg-surface-iron' : 'bg-surface-charcoal'}`}
        >
          <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
            <span className="font-heading text-sm text-bone-white uppercase tracking-wider">
              {row.title}
            </span>
            <span className="text-xs text-warm-ash/60 truncate">{row.exercises}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-display text-sm text-warm-ash tabular-nums">{row.duration}</span>
            <span className="inline-flex items-center bg-surface-gunmetal text-bone-white text-[11px] px-2 py-0.5 uppercase tracking-widest">
              {row.sets} SETS
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
