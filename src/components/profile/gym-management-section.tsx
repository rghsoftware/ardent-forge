import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useGyms,
  useAllGyms,
  useListAllGymsWithCounts,
  useCreateGym,
  useDeleteGym,
} from '@/hooks/use-gyms'
import { useGymMembers, useJoinGym, useLeaveGym } from '@/hooks/use-gym-members'
import { gymSchema } from '@/domain/types/gym'
import { cn } from '@/lib/utils'
import { gymErrorMessage } from '@/lib/gym-error-messages'
import { ShowDisplayPanel } from './show-display-panel'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// GymManagementSection -- profile / settings gym management (F018, Tech.md D13)
//
// A single "GYMS" section for the profile route with three subsections:
//
//   1. My gyms            -- list the user's memberships with leave + delete
//   2. Browse all gyms    -- list every gym on the instance with join
//   3. Create gym         -- text input + validated create button
//
// The section follows the existing profile.tsx conventions: a tonal
// `border-t border-surface-steel` section divider, an ALL-CAPS section
// header in `text-warm-ash`, and mixed-case button copy.
//
// Member counts are a deliberate v1 limitation. The `useGymMembers(gymId)`
// hook returns members per-gym, so calling it per row would be N+1 queries.
// We render `--` as a placeholder and leave a TODO to wire up live counts
// in a follow-up. This keeps Wave 6 bounded without regressing the read
// path for the rest of the section.
// ---------------------------------------------------------------------------

interface GymManagementSectionProps {
  /** The authenticated user whose memberships should be displayed. */
  userId: string
}

export function GymManagementSection({ userId }: GymManagementSectionProps): ReactElement {
  // Hide "Browse all gyms" when there's exactly one gym on the instance and
  // the user is already a member -- in that case the Browse list would just
  // duplicate the My gyms list above. We still render Browse during loading
  // and error states so the user gets feedback (BrowseAllGymsList renders
  // its own loading/error UI). These query calls reuse the TanStack Query
  // cache shared with the children, so they do not trigger extra fetches.
  const { data: myGyms } = useGyms(userId)
  const { data: allGyms } = useAllGyms()
  const hideBrowseAll = allGyms?.length === 1 && (myGyms?.length ?? 0) >= 1

  return (
    <section className="pb-8">
      <div className="border-t border-surface-steel pb-2 pt-4">
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
          GYMS
        </h2>
      </div>

      <div className="mt-4 space-y-8">
        <MyGymsList userId={userId} />
        {!hideBrowseAll && <BrowseAllGymsList userId={userId} />}
        <CreateGymForm />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// My gyms
// ---------------------------------------------------------------------------

interface MyGymsListProps {
  userId: string
}

function MyGymsList({ userId }: MyGymsListProps): ReactElement {
  const { data: gyms, isLoading, isError } = useGyms(userId)
  const leaveGym = useLeaveGym()
  const deleteGym = useDeleteGym()

  const [pendingDelete, setPendingDelete] = useState<Gym | null>(null)
  // F019 D13: single-row-open invariant for the inline ShowDisplayPanel.
  // Only one row's display panel is open at a time; tapping Show display
  // on a second row closes the first.
  const [openDisplayRowId, setOpenDisplayRowId] = useState<string | null>(null)

  const handleLeave = (gym: Gym) => {
    leaveGym.mutate(gym.id, {
      onError: (err) => {
        console.error('[gym-mgmt] leaveGym failed', { gymId: gym.id }, err)
      },
    })
  }

  const handleDeleteRequest = (gym: Gym) => {
    setPendingDelete(gym)
  }

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return
    const gymId = pendingDelete.id
    // Defer dialog close to onSuccess so the user sees the error inside the
    // dialog (not in a banner they may have scrolled away from), and so a
    // failed delete cannot be silently masked by an optimistic close.
    deleteGym.mutate(gymId, {
      onSuccess: () => {
        setPendingDelete(null)
      },
      onError: (err) => {
        console.error('[gym-mgmt] deleteGym failed', { gymId }, err)
      },
    })
  }

  const handleDeleteCancel = () => {
    // Don't allow cancelling while a delete is in flight -- the dialog would
    // disappear and the user would have no idea whether the action succeeded.
    if (deleteGym.isPending) return
    setPendingDelete(null)
  }

  return (
    <div className="space-y-3">
      <h3 className={FORGE_LABEL_CLASS}>My gyms</h3>

      {isLoading && (
        <p data-testid="my-gyms-loading" className="text-xs text-warm-ash">
          Loading...
        </p>
      )}

      {isError && (
        <p data-testid="my-gyms-error" className="text-xs text-warning-flare" role="alert">
          Failed to load your gyms. Check your connection and try again.
        </p>
      )}

      {!isLoading && !isError && (gyms?.length ?? 0) === 0 && (
        <p data-testid="my-gyms-empty" className="text-xs text-warm-ash">
          You haven't joined any gyms yet. Browse below to find one, or create your own.
        </p>
      )}

      {!isLoading && !isError && gyms && gyms.length > 0 && (
        <ul className="flex flex-col gap-1">
          {gyms.map((gym) => (
            <MyGymRow
              key={gym.id}
              gym={gym}
              isOwner={gym.ownerUserId === userId}
              onLeave={() => handleLeave(gym)}
              onDelete={() => handleDeleteRequest(gym)}
              leavePending={leaveGym.isPending && leaveGym.variables === gym.id}
              isDisplayOpen={openDisplayRowId === gym.id}
              onToggleDisplay={() =>
                setOpenDisplayRowId((prev) => (prev === gym.id ? null : gym.id))
              }
            />
          ))}
        </ul>
      )}

      {leaveGym.isError && (
        <p className="text-xs text-warning-flare" role="alert">
          {gymErrorMessage(leaveGym.error, 'leave')} (
          {gyms?.find((g) => g.id === leaveGym.variables)?.name ?? 'gym'})
        </p>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) handleDeleteCancel()
        }}
      >
        <AlertDialogContent
          data-testid="delete-gym-confirm-dialog"
          className="rounded-none bg-surface-iron"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-sans text-sm font-medium uppercase tracking-widest text-bone-white">
              DELETE {pendingDelete?.name.toUpperCase() ?? ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-warm-ash">
              This will end any active TV at this gym.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Error banner lives INSIDE the dialog so the user sees it without
              scrolling. The dialog stays open on failure (handleDeleteConfirm
              only closes on onSuccess) so a failed delete cannot be masked. */}
          {deleteGym.isError && (
            <p
              data-testid="delete-gym-error"
              className="px-1 text-xs text-warning-flare"
              role="alert"
            >
              {gymErrorMessage(deleteGym.error, 'delete')} ({pendingDelete?.name ?? 'gym'})
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="delete-gym-cancel"
              disabled={deleteGym.isPending}
              className="min-h-[48px] rounded-none border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-gym-confirm"
              onClick={handleDeleteConfirm}
              disabled={deleteGym.isPending && deleteGym.variables === pendingDelete?.id}
              className="min-h-[48px] rounded-none bg-warning-flare text-on-forge hover:bg-warning-flare/80"
            >
              {deleteGym.isPending && deleteGym.variables === pendingDelete?.id
                ? 'Deleting...'
                : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface MyGymRowProps {
  gym: Gym
  isOwner: boolean
  onLeave: () => void
  onDelete: () => void
  leavePending: boolean
  /** F019: whether the inline ShowDisplayPanel for this row is open */
  isDisplayOpen: boolean
  /** F019: single-row-open toggle callback */
  onToggleDisplay: () => void
}

function MyGymRow({
  gym,
  isOwner,
  onLeave,
  onDelete,
  leavePending,
  isDisplayOpen,
  onToggleDisplay,
}: MyGymRowProps): ReactElement {
  // Live member count per row. This is N+1 across the My gyms list, but
  // typical users belong to 1-5 gyms so the cost is bounded; revisit with a
  // single aggregated query if member-count UX expands to admin-style views.
  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
    error: membersErrorObj,
  } = useGymMembers(gym.id)
  const memberCountLabel = membersLoading ? '--' : membersError ? '?' : (members?.length ?? 0)

  // P15-013: Log the member-count fetch error so a transient backend hiccup
  // that renders '?' for every row is visible in production traces. Logged
  // at warn level because the rendered UI already communicates degraded
  // state to the user.
  useEffect(() => {
    if (membersError) {
      console.warn(
        '[gym-mgmt] Member count fetch failed for gym',
        { gymId: gym.id },
        membersErrorObj,
      )
    }
  }, [membersError, membersErrorObj, gym.id])

  return (
    <li
      data-testid={`my-gym-row-${gym.id}`}
      className="flex flex-col bg-surface-charcoal/40 px-3 py-2"
    >
      <div className="flex min-h-12 items-center justify-between gap-3">
        <Link
          to="/profile/gyms/$gymId"
          params={{ gymId: gym.id }}
          className="flex min-w-0 flex-1 flex-col hover:bg-surface-gunmetal/20"
          data-testid={`my-gym-row-${gym.id}-link`}
        >
          <span className="truncate font-sans text-sm font-medium uppercase tracking-wider text-bone-white">
            {gym.name}
          </span>
          <span className="font-sans text-[11px] text-warm-ash/60">
            <span data-testid={`my-gym-row-${gym.id}-member-count`}>{memberCountLabel}</span>{' '}
            members
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-testid={`my-gym-row-${gym.id}-show-display`}
            aria-expanded={isDisplayOpen}
            className="min-h-[48px] text-xs text-warm-ash hover:text-bone-white"
            onClick={onToggleDisplay}
          >
            {isDisplayOpen ? 'Hide display' : 'Show display'}
          </Button>
          {!isOwner && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`my-gym-row-${gym.id}-leave`}
              className="min-h-[48px] text-xs text-warm-ash hover:text-bone-white"
              onClick={onLeave}
              disabled={leavePending}
            >
              {leavePending ? 'Leaving...' : 'Leave'}
            </Button>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`my-gym-row-${gym.id}-delete`}
              className="min-h-[48px] text-xs text-warning-flare hover:bg-warning-flare/10 hover:text-warning-flare"
              onClick={onDelete}
            >
              Delete gym
            </Button>
          )}
        </div>
      </div>
      <ShowDisplayPanel gym={gym} isOpen={isDisplayOpen} />
    </li>
  )
}

// ---------------------------------------------------------------------------
// Browse all gyms
// ---------------------------------------------------------------------------

interface BrowseAllGymsListProps {
  userId: string
}

function BrowseAllGymsList({ userId }: BrowseAllGymsListProps): ReactElement {
  // TODO(backlog): paginate when gyms.length > ~50. See
  // Context/Backlog/gym-management-pagination.md and Spec.md S8 / RD-19.
  // The underlying query is index-friendly and shape-compatible with
  // LIMIT/OFFSET per M22 and M24, so adding pagination later is a
  // half-day change.
  const {
    data: allGyms,
    isLoading: allGymsLoading,
    isError: allGymsError,
    error: allGymsErrorObj,
    refetch: refetchAllGyms,
  } = useListAllGymsWithCounts()
  // Surface myGyms error too -- if we don't, joinedSet silently becomes empty
  // and every gym in the browse list appears un-joined, leading the user to
  // tap Join on a gym they already belong to (RLS will block, but the UX
  // affordance was wrong from the start). Treat both queries as required.
  const {
    data: myGyms,
    isLoading: myGymsLoading,
    isError: myGymsError,
    error: myGymsErrorObj,
    refetch: refetchMyGyms,
  } = useGyms(userId)
  const joinGym = useJoinGym()

  // P14-011: log which query failed so production debugging can distinguish
  // RLS/auth failures from network failures. The aggregated banner is fine
  // for users (they don't care which query failed) but operators need to
  // know which one to investigate. Logged via effect so the warning fires
  // on the error transition, not on every re-render.
  useEffect(() => {
    if (allGymsError) {
      console.error('[gym-mgmt] BrowseAllGymsList: useAllGyms failed', allGymsErrorObj)
    }
  }, [allGymsError, allGymsErrorObj])
  useEffect(() => {
    if (myGymsError) {
      console.error('[gym-mgmt] BrowseAllGymsList: useGyms failed', { userId }, myGymsErrorObj)
    }
  }, [myGymsError, myGymsErrorObj, userId])

  const joinedSet = useMemo(() => new Set((myGyms ?? []).map((g) => g.id)), [myGyms])

  const handleJoin = (gymId: string) => {
    joinGym.mutate(gymId, {
      onError: (err) => {
        console.error('[gym-mgmt] joinGym failed', { gymId }, err)
      },
    })
  }

  const handleRetry = () => {
    if (allGymsError) refetchAllGyms()
    if (myGymsError) refetchMyGyms()
  }

  const isLoading = allGymsLoading || myGymsLoading
  const isError = allGymsError || myGymsError

  return (
    <div className="space-y-3">
      <h3 className={FORGE_LABEL_CLASS}>Browse all gyms</h3>

      {isLoading && (
        <p data-testid="browse-gyms-loading" className="text-xs text-warm-ash">
          Loading...
        </p>
      )}

      {isError && (
        <div className="flex items-center gap-2">
          <p data-testid="browse-gyms-error" className="text-xs text-warning-flare" role="alert">
            Failed to load gyms. Check your connection and try again.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="browse-gyms-retry"
            onClick={handleRetry}
            className="min-h-[48px] text-xs text-warm-ash hover:text-bone-white"
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (allGyms?.length ?? 0) === 0 && (
        <p data-testid="browse-gyms-empty" className="text-xs text-warm-ash">
          No gyms exist yet. Create one below to get started.
        </p>
      )}

      {!isLoading && !isError && allGyms && allGyms.length > 0 && (
        <ul className="flex flex-col gap-1">
          {allGyms.map((gym) => (
            <BrowseGymRow
              key={gym.id}
              gym={gym}
              memberCount={gym.memberCount}
              alreadyJoined={joinedSet.has(gym.id)}
              onJoin={() => handleJoin(gym.id)}
              joinPending={joinGym.isPending && joinGym.variables === gym.id}
            />
          ))}
        </ul>
      )}

      {joinGym.isError && (
        <p className="text-xs text-warning-flare" role="alert">
          {gymErrorMessage(joinGym.error, 'join')} (
          {allGyms?.find((g) => g.id === joinGym.variables)?.name ?? 'gym'})
        </p>
      )}
    </div>
  )
}

interface BrowseGymRowProps {
  gym: Gym
  memberCount: number
  alreadyJoined: boolean
  onJoin: () => void
  joinPending: boolean
}

function BrowseGymRow({
  gym,
  memberCount,
  alreadyJoined,
  onJoin,
  joinPending,
}: BrowseGymRowProps): ReactElement {
  return (
    <li
      data-testid={`browse-gym-row-${gym.id}`}
      className="flex min-h-12 items-center justify-between gap-3 bg-surface-charcoal/40 px-3 py-2"
    >
      <Link
        to="/profile/gyms/$gymId"
        params={{ gymId: gym.id }}
        className="flex min-w-0 flex-1 flex-col hover:bg-surface-gunmetal/20"
      >
        <span className="truncate font-sans text-sm font-medium uppercase tracking-wider text-bone-white">
          {gym.name}
        </span>
        <span className="font-sans text-[11px] text-warm-ash/60">
          <span data-testid={`browse-gym-row-${gym.id}-member-count`}>{memberCount}</span> members
        </span>
      </Link>
      <div className="shrink-0">
        {alreadyJoined ? (
          <span
            data-testid={`browse-gym-row-${gym.id}-joined`}
            className={cn(
              'inline-flex min-h-[48px] items-center px-3',
              'font-sans text-xs font-medium uppercase tracking-wider text-warm-ash/60',
            )}
            aria-disabled="true"
          >
            Joined
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            data-testid={`browse-gym-row-${gym.id}-join`}
            className="min-h-[48px] rounded-none border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
            onClick={onJoin}
            disabled={joinPending}
          >
            {joinPending ? 'Joining...' : 'Join'}
          </Button>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Create gym
// ---------------------------------------------------------------------------

function CreateGymForm(): ReactElement {
  const createGym = useCreateGym()
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Inline validation using the zod schema so the input rejects empty and
  // 61+ character values against the exact same rule enforced by the
  // `gyms.name` SQL check constraint (1..60).
  const parsed = gymSchema.shape.name.safeParse(name)
  const isValid = parsed.success
  const showValidationError = name.length > 0 && !isValid

  const handleSubmit = () => {
    const result = gymSchema.shape.name.safeParse(name)
    if (!result.success) {
      setValidationError('Gym name must be 1 to 60 characters.')
      return
    }
    setValidationError(null)
    createGym.mutate(
      { name: result.data },
      {
        onSuccess: () => {
          setName('')
        },
      },
    )
  }

  const handleChange = (next: string) => {
    setName(next)
    if (validationError) setValidationError(null)
  }

  return (
    <div className="space-y-3">
      <h3 className={FORGE_LABEL_CLASS}>Create gym</h3>

      <div className="space-y-1">
        <label htmlFor="create-gym-name" className={FORGE_LABEL_CLASS}>
          Gym name
        </label>
        <ForgeInput
          id="create-gym-name"
          type="text"
          value={name}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Home garage"
          maxLength={120}
          data-testid="create-gym-input"
          aria-invalid={showValidationError || !!validationError}
        />
        {showValidationError && (
          <p className="text-xs text-warning-flare">Gym name must be 1 to 60 characters.</p>
        )}
      </div>

      <Button
        className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={!isValid || createGym.isPending}
        data-testid="create-gym-submit"
      >
        {createGym.isPending ? 'Creating...' : 'Create'}
      </Button>

      {validationError && (
        <p className="text-xs text-warning-flare" role="alert">
          {validationError}
        </p>
      )}
      {createGym.isError && (
        <p className="text-xs text-warning-flare" role="alert">
          {gymErrorMessage(createGym.error, 'create')}
        </p>
      )}
    </div>
  )
}
