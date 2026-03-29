import { createFileRoute, Link } from '@tanstack/react-router'
import { useResolveShareLink, useSharedProgram, useSharedWorkout } from '@/hooks/use-share-links'
import { SharedProgramView } from '@/components/sharing/shared-program-view'
import { SharedWorkoutView } from '@/components/sharing/shared-workout-view'
import { CloneProgramButton } from '@/components/sharing/clone-program-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'

export const Route = createFileRoute('/s/$token')({
  component: SharedTokenPage,
})

// ---------------------------------------------------------------------------
// Skeleton loader -- Iron & Ember themed
// ---------------------------------------------------------------------------

function SharedPageSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      {/* Branding skeleton */}
      <div className="flex flex-col items-center gap-2 px-4 pt-8 pb-4">
        <Skeleton className="h-8 w-48 bg-surface-steel" />
        <Skeleton className="h-3 w-32 bg-surface-steel" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-4 px-4 pt-4">
        <Skeleton className="h-8 w-64 bg-surface-iron" />
        <Skeleton className="h-4 w-full bg-surface-iron" />
        <Skeleton className="h-4 w-3/4 bg-surface-iron" />
        <Skeleton className="h-24 w-full bg-surface-iron" />
        <Skeleton className="h-24 w-full bg-surface-iron" />
        <Skeleton className="h-24 w-full bg-surface-iron" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error / expired state
// ---------------------------------------------------------------------------

function SharedPageExpired() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-anvil px-4">
      <Icon name="link_off" size={48} className="mb-4 text-warm-ash/40" />
      <h1 className="font-display text-lg font-medium uppercase tracking-wider text-bone-white">
        Link expired or invalid
      </h1>
      <p className="mt-2 text-sm text-warm-ash/60">
        This share link may have been revoked or does not exist.
      </p>
      <Link
        to="/sign-in"
        search={{ reason: undefined }}
        className="mt-6 text-xs text-ember uppercase tracking-wider"
      >
        Go to Ardent Forge
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Branding header
// ---------------------------------------------------------------------------

function SharedBranding() {
  return (
    <div className="flex flex-col items-center gap-1 px-4 pt-8 pb-4">
      <h1 className="font-display text-2xl font-medium text-bone-white">Ardent Forge</h1>
      <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
        Shared via Ardent Forge
      </span>
      <div className="mt-2 h-px w-16 bg-ember" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function SharedTokenPage() {
  const { token } = Route.useParams()

  // Step 1: Resolve the token to get entity type and ID
  const {
    data: shareLink,
    isLoading: isResolvingLink,
    isError: isResolveError,
  } = useResolveShareLink(token)

  // Step 2: Fetch the entity data based on type
  // The hooks themselves check `enabled` based on the token, but we pass
  // token only when the entity type matches to avoid unnecessary requests.
  const isProgramLink = shareLink?.entity_type === 'PROGRAM'
  const isWorkoutLink = shareLink?.entity_type === 'WORKOUT_LOG'

  const { data: programData, isLoading: isProgramLoading } = useSharedProgram(
    isProgramLink ? token : '',
  )
  const { data: workoutData, isLoading: isWorkoutLoading } = useSharedWorkout(
    isWorkoutLink ? token : '',
  )

  // Loading state
  if (isResolvingLink) {
    return <SharedPageSkeleton />
  }

  // Error or no link found
  if (isResolveError || !shareLink) {
    return <SharedPageExpired />
  }

  // Entity data loading
  if ((isProgramLink && isProgramLoading) || (isWorkoutLink && isWorkoutLoading)) {
    return <SharedPageSkeleton />
  }

  // Program view
  if (isProgramLink && programData) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <SharedBranding />
        <div className="px-4 pb-6">
          <SharedProgramView data={programData} />
        </div>
        <div className="sticky bottom-0 bg-surface-anvil px-4 py-4 border-t border-warm-ash/10">
          <CloneProgramButton programData={programData} />
        </div>
      </div>
    )
  }

  // Workout view
  if (isWorkoutLink && workoutData) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <SharedBranding />
        <SharedWorkoutView data={workoutData} />
      </div>
    )
  }

  // Fallback: entity data missing
  return <SharedPageExpired />
}
