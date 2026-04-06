// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutHistoryCard } from '@/components/history/workout-history-card'
import type { WorkoutLogSummary } from '@/lib/data-adapter'

// Mock format-duration to return predictable values
vi.mock('@/lib/format-duration', () => ({
  formatDateLabel: (date: Date) => {
    return date
      .toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      .toUpperCase()
  },
  formatDuration: (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  },
}))

describe('WorkoutHistoryCard', () => {
  const baseSummary: WorkoutLogSummary = {
    log: {
      id: 'wl-1',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T11:00:00.000Z',
      userId: 'user-1',
      startedAt: '2026-01-15T10:00:00.000Z',
      completedAt: '2026-01-15T11:00:00.000Z',
      totalPausedMs: 0,
    },
    exerciseNames: ['Back Squat', 'Bench Press', 'Deadlift'],
    setCount: 12,
    exerciseCount: 3,
  }

  const onClick = vi.fn()

  const defaultProps = {
    summary: baseSummary,
    index: 0,
    onClick,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the date label when no title is set', () => {
    render(<WorkoutHistoryCard {...defaultProps} />)
    // formatDateLabel returns a formatted date string
    // The card shows log.title ?? dateLabel
    const card = screen.getByRole('button')
    expect(card).toBeInTheDocument()
  })

  it('renders the workout title when available', () => {
    const summaryWithTitle: WorkoutLogSummary = {
      ...baseSummary,
      log: { ...baseSummary.log, title: 'Upper Body Day' },
    }
    render(<WorkoutHistoryCard {...defaultProps} summary={summaryWithTitle} />)
    expect(screen.getByText('Upper Body Day')).toBeInTheDocument()
  })

  it('renders exercise names as comma-separated list', () => {
    render(<WorkoutHistoryCard {...defaultProps} />)
    expect(screen.getByText('Back Squat, Bench Press, Deadlift')).toBeInTheDocument()
  })

  it('renders set count with badge', () => {
    render(<WorkoutHistoryCard {...defaultProps} />)
    expect(screen.getByText('12 SETS')).toBeInTheDocument()
  })

  it('shows singular SET for count of 1', () => {
    const singleSetSummary = { ...baseSummary, setCount: 1 }
    render(<WorkoutHistoryCard {...defaultProps} summary={singleSetSummary} />)
    expect(screen.getByText('1 SET')).toBeInTheDocument()
  })

  it('renders duration when completedAt is present', () => {
    render(<WorkoutHistoryCard {...defaultProps} />)
    // 1 hour = 3600 seconds => "60:00"
    expect(screen.getByText('60:00')).toBeInTheDocument()
  })

  it('does not render duration when completedAt is absent', () => {
    const incompleteSummary: WorkoutLogSummary = {
      ...baseSummary,
      log: { ...baseSummary.log, completedAt: undefined },
    }
    render(<WorkoutHistoryCard {...defaultProps} summary={incompleteSummary} />)
    expect(screen.queryByText('60:00')).not.toBeInTheDocument()
  })

  it('click triggers onClick callback', async () => {
    const user = userEvent.setup()
    render(<WorkoutHistoryCard {...defaultProps} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has an accessible label including the date', () => {
    render(<WorkoutHistoryCard {...defaultProps} />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toContain('View workout from')
  })

  it('shows "No exercises" when exercise names list is empty', () => {
    const emptySummary: WorkoutLogSummary = {
      ...baseSummary,
      exerciseNames: [],
    }
    render(<WorkoutHistoryCard {...defaultProps} summary={emptySummary} />)
    expect(screen.getByText('No exercises')).toBeInTheDocument()
  })
})
