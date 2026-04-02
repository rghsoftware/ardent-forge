// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutSummary } from '@/components/workout/workout-summary'
import type { WorkoutLog } from '@/domain/types'
import type {
  LoggedActivityGroupWithActivities,
  LoggedActivityWithSets,
} from '@/stores/active-workout-store'

// Mock formatDuration to return predictable output
vi.mock('@/lib/format-duration', () => ({
  formatDuration: (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
    return `${pad(m)}:${pad(s)}`
  },
}))

describe('WorkoutSummary', () => {
  const baseWorkoutLog: WorkoutLog = {
    id: 'wl-1',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T11:05:00.000Z',
    userId: 'user-1',
    startedAt: '2026-01-15T10:00:00.000Z',
    completedAt: '2026-01-15T11:05:00.000Z',
  }

  const activityWithSets: LoggedActivityWithSets = {
    id: 'la-1',
    loggedGroupId: 'lg-1',
    exerciseId: 'ex-1',
    ordinal: 1,
    sets: [
      {
        id: 'ls-1',
        loggedActivityId: 'la-1',
        setNumber: 1,
        setType: 'WORKING',
        completed: true,
        actualWeight: { value: 225, unit: 'lb' },
        actualReps: 5,
      },
      {
        id: 'ls-2',
        loggedActivityId: 'la-1',
        setNumber: 2,
        setType: 'WORKING',
        completed: true,
        actualWeight: { value: 225, unit: 'lb' },
        actualReps: 5,
      },
    ],
  }

  const activityWithSets2: LoggedActivityWithSets = {
    id: 'la-2',
    loggedGroupId: 'lg-1',
    exerciseId: 'ex-2',
    ordinal: 2,
    sets: [
      {
        id: 'ls-3',
        loggedActivityId: 'la-2',
        setNumber: 1,
        setType: 'WORKING',
        completed: true,
        actualWeight: { value: 135, unit: 'lb' },
        actualReps: 10,
      },
    ],
  }

  const loggedGroups: LoggedActivityGroupWithActivities[] = [
    {
      id: 'lg-1',
      workoutLogId: 'wl-1',
      groupType: 'STRAIGHT_SETS',
      ordinal: 1,
      activities: [activityWithSets, activityWithSets2],
    },
  ]

  const exerciseNames: Record<string, string> = {
    'ex-1': 'Back Squat',
    'ex-2': 'Bench Press',
  }

  const onDone = vi.fn()

  const defaultProps = {
    workoutLog: baseWorkoutLog,
    loggedGroups,
    exerciseNames,
    onDone,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders session complete header', () => {
    render(<WorkoutSummary {...defaultProps} />)
    expect(screen.getByText('Session complete.')).toBeInTheDocument()
  })

  it('renders workout duration', () => {
    // 65 minutes = 01:05:00
    render(<WorkoutSummary {...defaultProps} />)
    expect(screen.getByText('01:05:00')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })

  it('displays exercises section', () => {
    render(<WorkoutSummary {...defaultProps} />)
    // The breakdown section header shows "Exercises"
    expect(screen.getByText('Exercises')).toBeInTheDocument()
  })

  it('displays correct total set count', () => {
    render(<WorkoutSummary {...defaultProps} />)
    // 3 confirmed sets
    const setsLabels = screen.getAllByText('Sets')
    expect(setsLabels.length).toBeGreaterThanOrEqual(1)
    // Stats grid shows total sets as "3"
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
  })

  it('displays total volume', () => {
    // (225*5 + 225*5 + 135*10) = 1125 + 1125 + 1350 = 3,600
    render(<WorkoutSummary {...defaultProps} />)
    expect(screen.getByText('3,600')).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
  })

  it('displays per-exercise breakdown with exercise names', () => {
    render(<WorkoutSummary {...defaultProps} />)
    // Exercise names may appear in both the top set hero and the breakdown
    expect(screen.getAllByText('Back Squat').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bench Press').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Exercises')).toBeInTheDocument()
  })

  it('Done button calls onDone', async () => {
    const user = userEvent.setup()
    render(<WorkoutSummary {...defaultProps} />)
    await user.click(screen.getByText('Done'))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('shows program context when programContext is present', () => {
    const workoutWithProgram: WorkoutLog = {
      ...baseWorkoutLog,
      programContext: {
        programId: 'prog-1',
        blockId: 'block-1',
        weekNumber: 2,
        dayLabel: 'Day 3',
      },
    }
    render(
      <WorkoutSummary
        {...defaultProps}
        workoutLog={workoutWithProgram}
        programName="Tactical Barbell"
        blockName="Base Building"
      />,
    )
    const contextLine = screen.getByText(/Tactical Barbell/)
    expect(contextLine).toBeInTheDocument()
    expect(contextLine).toHaveTextContent(/Base Building/)
    expect(contextLine).toHaveTextContent(/Week 2/)
    expect(contextLine).toHaveTextContent(/Day 3/)
  })
})
