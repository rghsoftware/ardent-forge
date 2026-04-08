// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import {
  buildWorkoutLog,
  buildLoggedActivityGroup,
  buildLoggedActivity,
  buildLoggedSet,
  buildExercise,
  buildUserProfile,
  resetFactoryCounters,
} from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import type { Exercise } from '@/domain/types'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Mock the AddExerciseSheet so tests can pick an exercise via a single button
// instead of driving the whole picker UI.
vi.mock('@/components/workout/add-exercise-sheet', () => ({
  AddExerciseSheet: ({
    open,
    onExerciseSelected,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onExerciseSelected: (exercise: Exercise) => void
    userId: string
  }) => {
    if (!open) return null
    return (
      <button
        type="button"
        data-testid="mock-pick-exercise"
        onClick={() =>
          onExerciseSelected({
            id: 'exercise-pick-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            name: 'Back Squat',
            aliases: [],
            category: 'BARBELL',
            movementPattern: 'SQUAT',
            muscleGroups: { primary: ['QUADS'], secondary: [] },
            isBilateral: true,
            supports1RM: true,
            equipmentRequired: ['BARBELL'],
            isCustom: false,
            isPublic: false,
          })
        }
      >
        pick exercise
      </button>
    )
  },
}))

import { ManualWorkoutForm, type WorkoutLogFull } from '../manual-workout-form'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
  vi.mocked(mockAdapter.getExercises).mockResolvedValue([
    buildExercise({ id: 'exercise-pick-1', name: 'Back Squat' }),
  ])
  vi.mocked(mockAdapter.getUserProfile).mockResolvedValue(
    buildUserProfile({ preferredUnits: 'IMPERIAL' }),
  )
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function setDateTimeLocal(
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  value: string,
) {
  // happy-dom datetime-local doesn't fully accept .type(); use clear + type fallback
  await user.clear(input)
  await user.type(input, value)
}

async function fillValidTimes(user: ReturnType<typeof userEvent.setup>) {
  const start = new Date(Date.now() - 60 * 60 * 1000) // 1h ago
  const end = new Date(Date.now() - 30 * 60 * 1000) // 30m ago
  await setDateTimeLocal(user, screen.getByLabelText('Started at'), toLocalInput(start))
  await setDateTimeLocal(user, screen.getByLabelText('Completed at'), toLocalInput(end))
  return { start, end }
}

async function addBlockWithExerciseAndOneSet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(await screen.findByRole('button', { name: 'Add exercise' }))
  await user.click(await screen.findByTestId('mock-pick-exercise'))
  // The picker auto-appends an activity with one completed set already.
}

function buildEditFixture(): WorkoutLogFull {
  const log = buildWorkoutLog({
    id: 'wl-edit-1',
    userId: 'user-1',
    title: 'Old Title',
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  })
  const group = buildLoggedActivityGroup({
    id: 'lag-edit-1',
    workoutLogId: 'wl-edit-1',
    ordinal: 1,
  })
  const activity = buildLoggedActivity({
    id: 'la-edit-1',
    loggedGroupId: 'lag-edit-1',
    exerciseId: 'exercise-pick-1',
    ordinal: 1,
  })
  const set1 = buildLoggedSet({
    id: 'ls-edit-1',
    loggedActivityId: 'la-edit-1',
    setNumber: 1,
    setType: 'WORKING',
    completed: true,
    actualReps: 5,
    actualWeight: { value: 135, unit: 'lb' },
  })
  const set2 = buildLoggedSet({
    id: 'ls-edit-2',
    loggedActivityId: 'la-edit-1',
    setNumber: 2,
    setType: 'WORKING',
    completed: true,
    actualReps: 5,
    actualWeight: { value: 135, unit: 'lb' },
  })
  return { log, groups: [group], activities: [activity], sets: [set1, set2] }
}

function renderForm(props?: Partial<React.ComponentProps<typeof ManualWorkoutForm>>) {
  const onSaved = vi.fn()
  const utils = renderWithProviders(
    <ManualWorkoutForm mode="create" userId="user-1" onSaved={onSaved} {...props} />,
  )
  return { ...utils, onSaved }
}

// ---------------------------------------------------------------------------
// CREATE FLOW
// ---------------------------------------------------------------------------

describe('ManualWorkoutForm -- create flow', () => {
  it('blocks submit when startedAt is empty and shows error', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await user.clear(screen.getByLabelText('Started at'))

    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(screen.getByText(/start time is required/i)).toBeInTheDocument()
    })
    expect(mockAdapter.createWorkoutLog).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('blocks submit when completedAt is empty and shows error', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await user.clear(screen.getByLabelText('Completed at'))
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(screen.getByText(/completion time is required/i)).toBeInTheDocument()
    })
    expect(mockAdapter.createWorkoutLog).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('errors when completedAt is before startedAt', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    const start = new Date(Date.now() - 60 * 60 * 1000)
    const end = new Date(Date.now() - 2 * 60 * 60 * 1000)
    await setDateTimeLocal(user, screen.getByLabelText('Started at'), toLocalInput(start))
    await setDateTimeLocal(user, screen.getByLabelText('Completed at'), toLocalInput(end))

    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(screen.getByText(/completion time must be after start time/i)).toBeInTheDocument()
    })
    expect(mockAdapter.createWorkoutLog).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('errors when completedAt is in the future', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    const start = new Date(Date.now() - 60 * 60 * 1000)
    const end = new Date(Date.now() + 60 * 60 * 1000)
    await setDateTimeLocal(user, screen.getByLabelText('Started at'), toLocalInput(start))
    await setDateTimeLocal(user, screen.getByLabelText('Completed at'), toLocalInput(end))

    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(screen.getByText(/completion time cannot be in the future/i)).toBeInTheDocument()
    })
    expect(mockAdapter.createWorkoutLog).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('errors when no completed set exists', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await fillValidTimes(user)
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(screen.getByText(/at least one completed set/i)).toBeInTheDocument()
    })
    expect(mockAdapter.createWorkoutLog).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('happy-path: creates workout log, group, activity, and set, then calls onSaved', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(
      buildWorkoutLog({ id: 'new-wl-1', userId: 'user-1' }),
    )
    vi.mocked(mockAdapter.createLoggedActivityGroup).mockResolvedValue(
      buildLoggedActivityGroup({ id: 'new-lag-1', workoutLogId: 'new-wl-1' }),
    )
    vi.mocked(mockAdapter.createLoggedActivity).mockResolvedValue(
      buildLoggedActivity({ id: 'new-la-1', loggedGroupId: 'new-lag-1' }),
    )
    vi.mocked(mockAdapter.createLoggedSet).mockResolvedValue(
      buildLoggedSet({ id: 'new-ls-1', loggedActivityId: 'new-la-1' }),
    )

    const { onSaved } = renderForm()

    const { start, end } = await fillValidTimes(user)
    await addBlockWithExerciseAndOneSet(user)

    // Enter reps in the first (and only) set row
    const repsInputs = screen
      .getAllByRole('spinbutton')
      .filter((el) => !el.id || (el.id !== 'rpe' && el.id !== 'bodyweight'))
    // The first reps input belongs to the set row (set row inputs come after meta).
    // Find by column structure: reps input is the first set-row spinbutton without an id.
    const setRowReps = repsInputs.find((el) => !(el as HTMLInputElement).id)
    expect(setRowReps).toBeDefined()
    await user.clear(setRowReps!)
    await user.type(setRowReps!, '5')

    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('new-wl-1')
    })

    expect(mockAdapter.createWorkoutLog).toHaveBeenCalledTimes(1)
    const logArg = vi.mocked(mockAdapter.createWorkoutLog).mock.calls[0][0]
    expect(logArg.userId).toBe('user-1')
    expect(new Date(logArg.startedAt).getMinutes()).toBe(start.getMinutes())
    expect(new Date(logArg.completedAt!).getMinutes()).toBe(end.getMinutes())

    expect(mockAdapter.createLoggedActivityGroup).toHaveBeenCalledTimes(1)
    const groupArg = vi.mocked(mockAdapter.createLoggedActivityGroup).mock.calls[0][0]
    expect(groupArg.workoutLogId).toBe('new-wl-1')

    expect(mockAdapter.createLoggedActivity).toHaveBeenCalledTimes(1)
    const activityArg = vi.mocked(mockAdapter.createLoggedActivity).mock.calls[0][0]
    expect(activityArg.loggedGroupId).toBe('new-lag-1')
    expect(activityArg.exerciseId).toBe('exercise-pick-1')

    expect(mockAdapter.createLoggedSet).toHaveBeenCalledTimes(1)
    const setArg = vi.mocked(mockAdapter.createLoggedSet).mock.calls[0][0]
    expect(setArg.loggedActivityId).toBe('new-la-1')
    expect(setArg.actualReps).toBe(5)
  })

  it('renders save error and does not call onSaved when createWorkoutLog rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.createWorkoutLog).mockRejectedValue(new Error('boom'))

    const { onSaved } = renderForm()

    await fillValidTimes(user)
    await addBlockWithExerciseAndOneSet(user)

    // Fill reps in the new set so the schema's "completed set needs a measurement" rule passes
    const repsCells = screen.getAllByRole('spinbutton').filter((el) => !(el as HTMLInputElement).id)
    await user.type(repsCells[0], '5')

    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/boom/i)
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// EDIT FLOW
// ---------------------------------------------------------------------------

describe('ManualWorkoutForm -- edit flow', () => {
  it('hydrates form fields from initialValue', async () => {
    const initial = buildEditFixture()
    renderForm({ mode: 'edit', initialValue: initial })

    expect(await screen.findByDisplayValue('Old Title')).toBeInTheDocument()
    // Two set rows should appear (reps inputs prefilled with 5)
    const repsInputs = screen.getAllByDisplayValue('5')
    expect(repsInputs.length).toBeGreaterThanOrEqual(2)
  })

  it('updates an existing set and updates top-level workout log', async () => {
    const user = userEvent.setup()
    const initial = buildEditFixture()
    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue(initial.log)
    vi.mocked(mockAdapter.updateLoggedActivityGroup).mockResolvedValue(initial.groups[0])
    vi.mocked(mockAdapter.updateLoggedActivity).mockResolvedValue(initial.activities[0])
    vi.mocked(mockAdapter.updateLoggedSet).mockResolvedValue(initial.sets[0])

    const { onSaved } = renderForm({ mode: 'edit', initialValue: initial })

    // Find first set's reps input (display value 5) and bump to 7.
    // happy-dom's userEvent.clear can be flaky on controlled number inputs;
    // select-all + type is the most reliable path.
    const repsInputs = screen.getAllByDisplayValue('5') as HTMLInputElement[]
    repsInputs[0].focus()
    repsInputs[0].select()
    await user.keyboard('7')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('wl-edit-1')
    })

    expect(mockAdapter.updateWorkoutLog).toHaveBeenCalledTimes(1)
    expect(mockAdapter.updateLoggedSet).toHaveBeenCalled()
    const updatedSet = vi
      .mocked(mockAdapter.updateLoggedSet)
      .mock.calls.find((call) => call[0].id === 'ls-edit-1')
    expect(updatedSet).toBeDefined()
    expect(updatedSet![0].actualReps).toBe(7)
  })

  it('deletes an existing set when removed from the UI', async () => {
    const user = userEvent.setup()
    const initial = buildEditFixture()
    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue(initial.log)
    vi.mocked(mockAdapter.updateLoggedActivityGroup).mockResolvedValue(initial.groups[0])
    vi.mocked(mockAdapter.updateLoggedActivity).mockResolvedValue(initial.activities[0])
    vi.mocked(mockAdapter.updateLoggedSet).mockResolvedValue(initial.sets[0])

    const { onSaved } = renderForm({ mode: 'edit', initialValue: initial })

    // Two "Remove set" buttons present; click the second one to remove ls-edit-2
    const removeSetButtons = await screen.findAllByRole('button', { name: 'Remove set' })
    expect(removeSetButtons).toHaveLength(2)
    await user.click(removeSetButtons[1])

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('wl-edit-1')
    })

    expect(mockAdapter.deleteLoggedSet).toHaveBeenCalledWith('ls-edit-2')
  })

  it('adds a new set in edit mode and creates it under the existing activity', async () => {
    const user = userEvent.setup()
    const initial = buildEditFixture()
    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue(initial.log)
    vi.mocked(mockAdapter.updateLoggedActivityGroup).mockResolvedValue(initial.groups[0])
    vi.mocked(mockAdapter.updateLoggedActivity).mockResolvedValue(initial.activities[0])
    vi.mocked(mockAdapter.updateLoggedSet).mockResolvedValue(initial.sets[0])
    vi.mocked(mockAdapter.createLoggedSet).mockResolvedValue(
      buildLoggedSet({ id: 'ls-new-1', loggedActivityId: 'la-edit-1' }),
    )

    const { onSaved } = renderForm({ mode: 'edit', initialValue: initial })

    await user.click(await screen.findByRole('button', { name: 'Add set' }))

    // The newly added set has empty reps; the third "Remove set" row exists now.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove set' })).toHaveLength(3)
    })

    // Find the last (newly added) reps input. It will have empty value; rps
    // inputs are spinbuttons without an id (id'd ones are bodyweight/rpe meta).
    const allSpin = screen
      .getAllByRole('spinbutton')
      .filter((el) => !(el as HTMLInputElement).id) as HTMLInputElement[]
    // Each set row has 3 spinbuttons (reps, weight, rpe). For 3 sets that's 9.
    // The 7th (index 6) is reps for set 3.
    const newReps = allSpin[6]
    expect(newReps).toBeDefined()
    await user.type(newReps, '8')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('wl-edit-1')
    })

    expect(mockAdapter.createLoggedSet).toHaveBeenCalledTimes(1)
    const newSetArg = vi.mocked(mockAdapter.createLoggedSet).mock.calls[0][0]
    expect(newSetArg.loggedActivityId).toBe('la-edit-1')
  })

  it('deletes an existing activity when removed', async () => {
    const user = userEvent.setup()
    const initial = buildEditFixture()
    // Add a second activity so we still have a completed set after removing one
    const secondActivity = buildLoggedActivity({
      id: 'la-edit-2',
      loggedGroupId: 'lag-edit-1',
      exerciseId: 'exercise-pick-1',
      ordinal: 2,
    })
    const secondSet = buildLoggedSet({
      id: 'ls-edit-3',
      loggedActivityId: 'la-edit-2',
      setNumber: 1,
      completed: true,
      actualReps: 5,
      actualWeight: { value: 135, unit: 'lb' },
    })
    initial.activities.push(secondActivity)
    initial.sets.push(secondSet)

    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue(initial.log)
    vi.mocked(mockAdapter.updateLoggedActivityGroup).mockResolvedValue(initial.groups[0])
    vi.mocked(mockAdapter.updateLoggedActivity).mockResolvedValue(initial.activities[0])
    vi.mocked(mockAdapter.updateLoggedSet).mockResolvedValue(initial.sets[0])

    const { onSaved } = renderForm({ mode: 'edit', initialValue: initial })

    const removeExerciseButtons = await screen.findAllByRole('button', { name: 'Remove exercise' })
    expect(removeExerciseButtons.length).toBeGreaterThanOrEqual(2)
    // Remove the second activity (la-edit-2)
    await user.click(removeExerciseButtons[1])

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('wl-edit-1')
    })

    expect(mockAdapter.deleteLoggedActivity).toHaveBeenCalledWith('la-edit-2')
  })

  it('deletes an existing group when removed', async () => {
    const user = userEvent.setup()
    const initial = buildEditFixture()
    // Add a second group with its own completed set, so removing one group still leaves a valid workout
    const secondGroup = buildLoggedActivityGroup({
      id: 'lag-edit-2',
      workoutLogId: 'wl-edit-1',
      ordinal: 2,
    })
    const secondActivity = buildLoggedActivity({
      id: 'la-edit-2',
      loggedGroupId: 'lag-edit-2',
      exerciseId: 'exercise-pick-1',
      ordinal: 1,
    })
    const secondSet = buildLoggedSet({
      id: 'ls-edit-3',
      loggedActivityId: 'la-edit-2',
      setNumber: 1,
      completed: true,
      actualReps: 5,
      actualWeight: { value: 135, unit: 'lb' },
    })
    initial.groups.push(secondGroup)
    initial.activities.push(secondActivity)
    initial.sets.push(secondSet)

    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue(initial.log)
    vi.mocked(mockAdapter.updateLoggedActivityGroup).mockResolvedValue(initial.groups[0])
    vi.mocked(mockAdapter.updateLoggedActivity).mockResolvedValue(initial.activities[0])
    vi.mocked(mockAdapter.updateLoggedSet).mockResolvedValue(initial.sets[0])

    const { onSaved } = renderForm({ mode: 'edit', initialValue: initial })

    const removeBlockButtons = await screen.findAllByRole('button', { name: 'Remove block' })
    expect(removeBlockButtons).toHaveLength(2)
    // Remove the second block (lag-edit-2)
    await user.click(removeBlockButtons[1])

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('wl-edit-1')
    })

    expect(mockAdapter.deleteLoggedActivityGroup).toHaveBeenCalledWith('lag-edit-2')
  })
})
