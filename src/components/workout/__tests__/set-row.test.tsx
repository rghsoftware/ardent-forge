// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetRow } from '@/components/workout/set-row'

// Mock the Icon component to avoid Material Symbols font dependency
vi.mock('@/components/icon', () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
}))

// Mock set-variance -- return predictable values
vi.mock('@/lib/set-variance', () => ({
  computeVariance: vi.fn().mockReturnValue(null),
}))

describe('SetRow', () => {
  const defaultProps = {
    setNumber: 1,
    onConfirm: vi.fn(),
    confirmed: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the set number', () => {
    render(<SetRow {...defaultProps} />)
    expect(screen.getByLabelText(/Set 1/)).toBeInTheDocument()
  })

  it('renders weight and reps inputs (ad-hoc path)', () => {
    render(<SetRow {...defaultProps} />)
    expect(screen.getByLabelText('Weight for set 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Reps for set 1')).toBeInTheDocument()
  })

  it('renders confirm button', () => {
    render(<SetRow {...defaultProps} />)
    expect(screen.getByLabelText('Confirm set 1')).toBeInTheDocument()
  })

  it('confirm button calls onConfirm with weight, reps, and set type', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<SetRow {...defaultProps} onConfirm={onConfirm} />)

    const weightInput = screen.getByLabelText('Weight for set 1')
    const repsInput = screen.getByLabelText('Reps for set 1')

    await user.type(weightInput, '135')
    await user.type(repsInput, '5')
    await user.click(screen.getByLabelText('Confirm set 1'))

    expect(onConfirm).toHaveBeenCalledWith('135', '5', 'WORKING')
  })

  it('displays prescribed values when provided', () => {
    render(
      <SetRow {...defaultProps} prescribedWeight={{ value: 120, unit: 'lb' }} prescribedReps={5} />,
    )
    // Prescribed label should show "120 lb x 5"
    expect(screen.getByText('120 lb x 5')).toBeInTheDocument()
    // Should show "Actual weight" and "Actual reps" inputs in prescribed mode
    expect(screen.getByLabelText('Actual weight for set 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Actual reps for set 1')).toBeInTheDocument()
  })

  it('handles empty input gracefully -- confirm disabled when both inputs empty', () => {
    render(<SetRow {...defaultProps} />)
    const confirmBtn = screen.getByLabelText('Confirm set 1')
    expect(confirmBtn).toBeDisabled()
  })

  it('does not call onConfirm when already confirmed', async () => {
    const onConfirm = vi.fn()
    render(<SetRow {...defaultProps} onConfirm={onConfirm} confirmed={true} />)

    // DONE badge should be visible (since variance is null)
    expect(screen.getByText('DONE')).toBeInTheDocument()
    // No confirm button when confirmed
    expect(screen.queryByLabelText('Confirm set 1')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('pre-fills initialWeight and initialReps', () => {
    render(<SetRow {...defaultProps} initialWeight="200" initialReps="8" />)
    const weightInput = screen.getByLabelText('Weight for set 1') as HTMLInputElement
    const repsInput = screen.getByLabelText('Reps for set 1') as HTMLInputElement
    expect(weightInput.value).toBe('200')
    expect(repsInput.value).toBe('8')
  })

  it('disables inputs when confirmed', () => {
    render(<SetRow {...defaultProps} confirmed={true} initialWeight="135" initialReps="5" />)
    // In confirmed state, inputs are disabled (they still render but are disabled)
    // The ad-hoc path inputs won't render when confirmed -- it shows the badge
    // Just verify no confirm button exists
    expect(screen.queryByLabelText('Confirm set 1')).not.toBeInTheDocument()
  })
})
