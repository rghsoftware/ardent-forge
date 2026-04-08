// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetRow } from '@/components/workout/set-row'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import { useRecentTagsStore } from '@/stores/recent-tags-store'
import type { WorkoutLog, LoggedSet } from '@/domain/types'

vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))
vi.mock('@/lib/set-variance', () => ({
  computeVariance: vi.fn().mockReturnValue(null),
}))

const NOW = '2026-03-27T10:00:00Z'

function primeStore(overrides?: { restTimer?: { remaining: number; total: number } | null }) {
  useActiveWorkoutStore.setState({
    workoutLog: {
      id: 'wl-1',
      createdAt: NOW,
      updatedAt: NOW,
      userId: 'u-1',
      startedAt: NOW,
      totalPausedMs: 0,
    } as WorkoutLog,
    loggedGroups: [
      {
        id: 'g-1',
        workoutLogId: 'wl-1',
        groupType: 'STRAIGHT_SETS',
        ordinal: 1,
        activities: [
          {
            id: 'a-1',
            loggedGroupId: 'g-1',
            exerciseId: 'e-1',
            ordinal: 1,
            sets: [
              {
                id: 's-1',
                loggedActivityId: 'a-1',
                setNumber: 1,
                setType: 'WORKING',
                completed: false,
              } as LoggedSet,
            ],
          },
        ],
      },
    ],
    elapsedSeconds: 0,
    restTimer: overrides?.restTimer ?? null,
    undoAction: null,
  })
}

beforeEach(() => {
  useRecentTagsStore.setState({ recent: [] })
})

afterEach(() => {
  useActiveWorkoutStore.getState().cleanup()
  useActiveWorkoutStore.setState({
    workoutLog: null,
    loggedGroups: [],
    elapsedSeconds: 0,
    restTimer: null,
    undoAction: null,
  })
})

describe('set-row note affordance', () => {
  it('opens the note sheet in a single tap (<=2 taps from set row default state)', async () => {
    const user = userEvent.setup()
    primeStore()

    render(<SetRow setNumber={1} confirmed={false} onConfirm={vi.fn()} loggedSetId="s-1" />)

    const trigger = screen.getByRole('button', { name: /add set note/i })
    await user.click(trigger)

    // Sheet opens -- its title is rendered
    expect(screen.getByText(/set note/i)).toBeInTheDocument()
  })

  it('keeps the rest timer running (unchanged) while the note sheet is open', async () => {
    const user = userEvent.setup()
    primeStore({ restTimer: { remaining: 42, total: 60 } })

    render(<SetRow setNumber={1} confirmed={false} onConfirm={vi.fn()} loggedSetId="s-1" />)

    // Sanity: rest timer is armed before interaction
    expect(useActiveWorkoutStore.getState().restTimer).toEqual({ remaining: 42, total: 60 })

    await user.click(screen.getByRole('button', { name: /add set note/i }))

    // Sheet is open
    expect(screen.getByText(/set note/i)).toBeInTheDocument()

    // Rest timer state in the store must be untouched (Spec assertion 7)
    expect(useActiveWorkoutStore.getState().restTimer).toEqual({ remaining: 42, total: 60 })
  })

  it('writes set note text through to the active-workout store on textarea blur', async () => {
    const user = userEvent.setup()
    primeStore()

    render(<SetRow setNumber={1} confirmed={false} onConfirm={vi.fn()} loggedSetId="s-1" />)

    await user.click(screen.getByRole('button', { name: /add set note/i }))
    const textarea = screen.getByLabelText(/set note text/i)
    await user.type(textarea, 'grindy')
    await user.tab() // blur triggers commit

    const set = useActiveWorkoutStore.getState().loggedGroups[0].activities[0].sets[0]
    expect(set.notes).toBe('grindy')
  })
})
