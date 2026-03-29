import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// PrCelebrationBanner -- in-app notification for personal records
//
// Displays a molten-gradient banner at the top of the screen with the
// exercise name, weight, and rep count. Auto-dismisses after 5 seconds
// or on tap/click. Industrial vocabulary throughout -- no exclamation
// points, no emoji, no conversational tone.
// ---------------------------------------------------------------------------

interface PrCelebrationBannerProps {
  exerciseName: string
  weight: number
  reps: number
  unit: 'lb' | 'kg'
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 5000

export function PrCelebrationBanner({
  exerciseName,
  weight,
  reps,
  unit,
  onDismiss,
}: PrCelebrationBannerProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const unitLabel = unit.toUpperCase()
  const readout = `${exerciseName.toUpperCase()} \u2014 ${weight}${unitLabel} x ${reps}`

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss personal record notification"
      className="fixed inset-x-0 top-0 z-[100] cursor-pointer border-none p-0"
      style={{ animation: 'pr-slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="molten-gradient px-4 py-3">
        {/* Badge */}
        <span className="inline-block bg-on-forge/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ember">
          NEW PR
        </span>

        {/* Exercise readout */}
        <p className="mt-1 font-display text-lg font-bold leading-tight text-on-forge">{readout}</p>
      </div>
    </button>
  )
}
