import { useCallback, useEffect } from 'react'
import { Icon } from '@/components/icon'
import { ExercisePickerPanel } from '@/components/workout/exercise-picker-panel'
import { cn } from '@/lib/utils'
import type { Exercise, GroupType } from '@/domain/types'

interface ExercisePickerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExerciseSelected: (exercise: Exercise, groupType: GroupType) => void
  userId?: string
}

/**
 * Route-local exercise picker drawer used inside the template editor routes.
 *
 * NOT a Sheet, Dialog, or radix portal -- this is a plain `<aside>` fixed to
 * the viewport. Desktop (`lg:`) slides in from the right as a 400px-wide
 * panel; mobile slides up from the bottom as a full-width panel.
 *
 * Desktop behavior: the main form remains interactive while the drawer is
 * open (no modal scrim, no outside-click dismiss). This is intentional per
 * ADR-021-03.
 *
 * Mobile behavior: a dim scrim is rendered behind the drawer to provide
 * visual focus, and tapping the scrim dismisses.
 *
 * Matches the prop surface of `AddExerciseSheet` so it can be swapped in via
 * the `PickerComponent` prop on the session-template form chain.
 */
export function ExercisePickerDrawer({
  open,
  onOpenChange,
  onExerciseSelected,
  userId,
}: ExercisePickerDrawerProps) {
  const handleSelected = useCallback(
    (exercise: Exercise, groupType: GroupType) => {
      onExerciseSelected(exercise, groupType)
      onOpenChange(false)
    },
    [onExerciseSelected, onOpenChange],
  )

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <>
      {/* Mobile-only scrim -- tap to dismiss. Not rendered on lg so the form stays interactive. */}
      <div
        className="fixed inset-0 z-30 bg-black/40 lg:hidden motion-reduce:transition-none"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="Add exercise"
        aria-modal="false"
        className={cn(
          'fixed z-40 flex flex-col bg-surface-gunmetal text-bone-white',
          // Mobile: bottom panel slide-up, full width, 80vh cap
          'inset-x-0 bottom-0 max-h-[80vh] translate-y-0',
          // Desktop: right-docked drawer, full height, fixed width
          // At xl the live-preview column occupies the rightmost 260px --
          // offset the drawer so it docks to the left of the preview column
          // rather than covering it. Both panels stay visible simultaneously.
          'lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:h-[100dvh] lg:max-h-none lg:w-[400px] xl:right-[260px]',
          // Slide transitions (respect reduced-motion)
          'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200',
          'lg:motion-safe:slide-in-from-right',
        )}
      >
        <header className="flex min-h-12 items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs uppercase tracking-widest text-ember">Add Exercise</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60 hover:text-bone-white"
            aria-label="Close exercise picker"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden">
          <ExercisePickerPanel
            userId={userId}
            onExerciseSelected={handleSelected}
            autoFocus={open}
          />
        </div>
      </aside>
    </>
  )
}
