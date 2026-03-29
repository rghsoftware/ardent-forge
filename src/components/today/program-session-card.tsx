import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface ProgramSessionCardProps {
  programName: string
  blockName: string
  weekNumber: number
  totalWeeks: number
  sessionName?: string
  sessionType?: string
  onStartSession: () => void
  isLoading?: boolean
  isRestDay?: boolean
}

// ---------------------------------------------------------------------------
// Session type badge color map -- each type gets a distinct accent
// ---------------------------------------------------------------------------
const SESSION_TYPE_COLORS: Record<string, string> = {
  STRENGTH: 'bg-ember/15 text-ember',
  CONDITIONING: 'bg-arc/15 text-arc',
  SE: 'bg-quenched/15 text-quenched',
  MIXED: 'bg-cooling-bloom/15 text-cooling-bloom',
}

// ---------------------------------------------------------------------------
// Loading skeleton -- matches the card dimensions for zero-shift layout
// ---------------------------------------------------------------------------
function ProgramSessionCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 bg-surface-iron p-5 milled-edge">
      {/* Program header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-36 bg-surface-gunmetal" />
        <Skeleton className="h-3 w-52 bg-surface-gunmetal" />
      </div>
      {/* Session info */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-48 bg-surface-gunmetal" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 bg-surface-gunmetal" />
          <Skeleton className="h-3 w-28 bg-surface-gunmetal" />
        </div>
      </div>
      {/* CTA */}
      <Skeleton className="h-12 w-full bg-surface-gunmetal" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rest day state -- calm visual treatment, no CTA
// ---------------------------------------------------------------------------
function RestDayContent() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <span
        className="material-symbols-outlined text-3xl text-quenched/60"
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 40" }}
      >
        self_improvement
      </span>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-heading text-sm text-bone-white uppercase tracking-widest">
          REST DAY
        </span>
        <span className="text-xs text-warm-ash/50">Recovery is part of the process</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProgramSessionCard -- active program context + today's session CTA
// ---------------------------------------------------------------------------
export function ProgramSessionCard({
  programName,
  blockName,
  weekNumber,
  totalWeeks,
  sessionName,
  sessionType,
  onStartSession,
  isLoading = false,
  isRestDay = false,
}: ProgramSessionCardProps) {
  if (isLoading) {
    return <ProgramSessionCardSkeleton />
  }

  const badgeColor = sessionType
    ? (SESSION_TYPE_COLORS[sessionType] ?? 'bg-surface-gunmetal text-warm-ash')
    : null

  return (
    <div className="flex flex-col gap-4 bg-surface-iron p-5 milled-edge">
      {/* Program header -- program name + block/week context */}
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-xs text-ember">{programName}</span>
        <span className="text-xs text-warm-ash/50">
          {blockName} &middot; Week {weekNumber} of {totalWeeks}
        </span>
      </div>

      {isRestDay ? (
        <RestDayContent />
      ) : (
        <>
          {/* Session info -- name, type badge, exercise count */}
          <div className="flex flex-col gap-2">
            {sessionName && (
              <span className="font-heading text-base text-bone-white">{sessionName}</span>
            )}
            <div className="flex items-center gap-2">
              {badgeColor && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[11px] font-heading uppercase tracking-widest ${badgeColor}`}
                >
                  {sessionType}
                </span>
              )}
            </div>
          </div>

          {/* CTA -- full-width start button */}
          <Button
            variant="molten"
            className="w-full min-h-12 text-xs font-medium"
            onClick={onStartSession}
          >
            Start today&apos;s session
          </Button>
        </>
      )}
    </div>
  )
}
