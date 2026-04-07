import { useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useGyms } from '@/hooks/use-gyms'
import { readLastGymChoice, type GymPickerChoice } from '@/lib/gym-picker-storage'
import { cn } from '@/lib/utils'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// GymPickerSheet -- workout-start gym picker (F018, Tech.md D10)
//
// A bottom-sheet modal that asks the user which gym they're training at
// before a workout starts. It shows the user's gym memberships plus a
// permanent "Private (don't publish)" row. The sticky default is read from
// localStorage; if the stored value is no longer a valid membership, it
// falls back to 'private' so a stale choice cannot preselect a gym the
// user has since left.
//
// This component is controlled: it doesn't manage its own open state or
// resolve the promise. That's the job of the `useGymPicker` hook (S021),
// which wraps this sheet in an imperative open/resolve/cancel API.
// ---------------------------------------------------------------------------

interface GymPickerSheetProps {
  /** Whether the sheet is open. */
  open: boolean
  /** The authenticated user whose gyms should be shown. */
  userId: string
  /**
   * Fired when the user picks a row. `choice` is either a gym UUID or the
   * literal 'private'. The parent is responsible for closing the sheet and
   * persisting the sticky default.
   */
  onResolve: (choice: GymPickerChoice) => void
  /**
   * Fired when the user dismisses the sheet (tap outside, Escape key, or
   * explicit cancel). The parent should close the sheet and treat the
   * workout start as cancelled.
   */
  onCancel: () => void
}

/**
 * Workout-start gym picker. Shows the user's gyms plus a permanent Private
 * row, preselecting whichever the user picked last time.
 */
export function GymPickerSheet({ open, userId, onResolve, onCancel }: GymPickerSheetProps) {
  const { data: gyms, isLoading, isError } = useGyms(userId)

  // Compute the sticky default, validating any stored UUID against the
  // current membership list. If the user has left the gym referenced by the
  // stored choice, fall back to 'private' (Tech.md D8, TA6).
  const preselected = useMemo<GymPickerChoice>(() => {
    const stored = readLastGymChoice()
    if (!stored) return 'private'
    if (stored === 'private') return 'private'
    const stillMember = gyms?.some((g) => g.id === stored) ?? false
    return stillMember ? stored : 'private'
  }, [gyms])

  // Radix Dialog uses onOpenChange(false) for outside-click + Escape key.
  // We translate that to a cancel because the picker is not self-dismissing.
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onCancel()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] bg-surface-anvil p-0"
        showCloseButton={false}
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
            Select gym
          </SheetTitle>
          <SheetDescription className="font-sans text-sm text-warm-ash/80">
            Choose where you are training. Your workout will broadcast only to that gym's TV.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <GymPickerSkeleton />
          ) : isError ? (
            <GymPickerError />
          ) : (
            <GymPickerRows gyms={gyms ?? []} preselected={preselected} onResolve={onResolve} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

interface GymPickerRowsProps {
  gyms: Gym[]
  preselected: GymPickerChoice
  onResolve: (choice: GymPickerChoice) => void
}

function GymPickerRows({ gyms, preselected, onResolve }: GymPickerRowsProps) {
  return (
    <div className="flex flex-col pb-4">
      {gyms.map((gym) => (
        <GymRow
          key={gym.id}
          gym={gym}
          selected={preselected === gym.id}
          onSelect={() => onResolve(gym.id)}
        />
      ))}

      <PrivateRow selected={preselected === 'private'} onSelect={() => onResolve('private')} />

      {gyms.length === 0 && (
        <p className="px-4 pt-3 pb-2 font-sans text-xs leading-relaxed text-warm-ash/60">
          Join a gym from settings to publish your workouts to a TV.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GymRow -- single gym membership
// ---------------------------------------------------------------------------

interface GymRowProps {
  gym: Gym
  selected: boolean
  onSelect: () => void
}

function GymRow({ gym, selected, onSelect }: GymRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`gym-picker-row-${gym.id}`}
      className={cn(
        // Minimum 48px touch target (gym-floor + gloves requirement)
        'flex min-h-12 w-full items-center gap-3 bg-transparent px-4 py-2 text-left transition-colors',
        selected ? 'bg-surface-charcoal' : 'hover:bg-surface-charcoal/60',
      )}
    >
      <span
        className={cn(
          'material-symbols-outlined text-xl',
          selected ? 'text-ember' : 'text-warm-ash/60',
        )}
        aria-hidden="true"
      >
        fitness_center
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate font-sans text-sm font-medium uppercase tracking-wider',
            selected ? 'text-ember' : 'text-bone-white',
          )}
        >
          {gym.name}
        </span>
      </div>
      {selected && (
        <span className="material-symbols-outlined text-xl text-ember" aria-label="Selected">
          check
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// PrivateRow -- always-present "don't publish" choice
// ---------------------------------------------------------------------------

interface PrivateRowProps {
  selected: boolean
  onSelect: () => void
}

function PrivateRow({ selected, onSelect }: PrivateRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid="gym-picker-row-private"
      className={cn(
        'flex min-h-12 w-full items-center gap-3 bg-transparent px-4 py-2 text-left transition-colors',
        selected ? 'bg-surface-charcoal' : 'hover:bg-surface-charcoal/60',
      )}
    >
      <span
        className={cn(
          'material-symbols-outlined text-xl',
          selected ? 'text-ember' : 'text-warm-ash/60',
        )}
        aria-hidden="true"
      >
        visibility_off
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn('font-sans text-sm font-medium', selected ? 'text-ember' : 'text-warm-ash')}
        >
          Private (don't publish)
        </span>
        <span className="font-sans text-[11px] leading-relaxed text-warm-ash/60">
          This workout will log normally but will not appear on any TV.
        </span>
      </div>
      {selected && (
        <span className="material-symbols-outlined text-xl text-ember" aria-label="Selected">
          check
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Skeleton & error states -- error-handling rules require surfacing isError
// ---------------------------------------------------------------------------

function GymPickerSkeleton() {
  return (
    <div
      data-testid="gym-picker-skeleton"
      className="flex flex-col gap-1 px-4 py-3"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-12 w-full animate-pulse bg-surface-gunmetal" />
      <div className="h-12 w-full animate-pulse bg-surface-gunmetal" />
      <div className="h-12 w-full animate-pulse bg-surface-gunmetal" />
    </div>
  )
}

function GymPickerError() {
  return (
    <div
      data-testid="gym-picker-error"
      className="flex flex-col items-center gap-2 px-4 py-8 text-center"
      role="alert"
    >
      <span className="material-symbols-outlined text-3xl text-warning-flare" aria-hidden="true">
        cloud_off
      </span>
      <p className="font-sans text-sm text-warning-flare">Failed to load gyms</p>
      <p className="font-sans text-xs text-warm-ash/60">Check your connection and try again.</p>
    </div>
  )
}
