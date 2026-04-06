// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FixedSetsFields } from '../fixed-sets-fields'
import type { NumberRange, SetScheme } from '@/domain/types'

vi.mock('../../inputs', () => ({
  UnderlineNumberInput: ({
    value,
    onChange,
    label,
  }: {
    value: number | undefined
    onChange: (v: number) => void
    label: string
  }) => (
    <input
      type="number"
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  ),
  NumberRangeInput: ({
    value,
    onChange,
    label,
  }: {
    value: NumberRange
    onChange: (r: NumberRange) => void
    label: string
  }) => (
    <div data-testid={`range-input-${label.toLowerCase()}`}>
      <input
        type="number"
        aria-label={`${label} minimum`}
        value={value.min || ''}
        onChange={(e) => onChange({ ...value, min: parseInt(e.target.value) || 0 })}
      />
      <input
        type="number"
        aria-label={`${label} maximum`}
        value={value.max || ''}
        onChange={(e) => onChange({ ...value, max: parseInt(e.target.value) || 0 })}
      />
    </div>
  ),
  DurationInput: ({ label }: { label: string }) => <div data-testid="duration-input">{label}</div>,
  LoadSpecEditor: () => <div data-testid="load-spec-editor" />,
}))

function makeScalar(
  overrides: Partial<SetScheme & { type: 'fixedSets' }> = {},
): SetScheme & { type: 'fixedSets' } {
  return {
    type: 'fixedSets',
    sets: 3,
    reps: 10,
    load: { type: 'unspecified' },
    ...overrides,
  }
}

function makeRange(
  overrides: Partial<SetScheme & { type: 'fixedSets' }> = {},
): SetScheme & { type: 'fixedSets' } {
  return {
    type: 'fixedSets',
    sets: { min: 3, max: 5 },
    reps: { min: 8, max: 12 },
    load: { type: 'unspecified' },
    ...overrides,
  }
}

describe('FixedSetsFields', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- 1. Scalar sets ---------------------------------------------------------

  it('renders number input for scalar sets value', () => {
    render(<FixedSetsFields value={makeScalar()} onChange={onChange} exerciseSupports1RM={false} />)

    const setsInput = screen.getByLabelText('SETS')
    expect(setsInput).toBeInTheDocument()
    expect(setsInput).toHaveAttribute('type', 'number')
    expect(setsInput).toHaveValue(3)
  })

  // -- 2. Range sets ----------------------------------------------------------

  it('renders range inputs for { min, max } sets value', () => {
    render(<FixedSetsFields value={makeRange()} onChange={onChange} exerciseSupports1RM={false} />)

    expect(screen.getByTestId('range-input-sets')).toBeInTheDocument()
    expect(screen.getByLabelText('SETS minimum')).toHaveValue(3)
    expect(screen.getByLabelText('SETS maximum')).toHaveValue(5)
  })

  // -- 3. Scalar reps ---------------------------------------------------------

  it('renders number input for scalar reps value', () => {
    render(<FixedSetsFields value={makeScalar()} onChange={onChange} exerciseSupports1RM={false} />)

    const repsInput = screen.getByLabelText('REPS')
    expect(repsInput).toBeInTheDocument()
    expect(repsInput).toHaveAttribute('type', 'number')
    expect(repsInput).toHaveValue(10)
  })

  // -- 4. Range reps ----------------------------------------------------------

  it('renders range inputs for { min, max } reps value', () => {
    render(<FixedSetsFields value={makeRange()} onChange={onChange} exerciseSupports1RM={false} />)

    expect(screen.getByTestId('range-input-reps')).toBeInTheDocument()
    expect(screen.getByLabelText('REPS minimum')).toHaveValue(8)
    expect(screen.getByLabelText('REPS maximum')).toHaveValue(12)
  })

  // -- 5. More options defaultOpen when options are set -----------------------

  it('opens "More options" by default when restBetweenSets is set', () => {
    render(
      <FixedSetsFields
        value={makeScalar({ restBetweenSets: { seconds: 90 } })}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    expect(screen.getByText('REST BETWEEN SETS')).toBeInTheDocument()
    expect(screen.getByText('LAST SET AMRAP')).toBeInTheDocument()
  })

  it('opens "More options" by default when lastSetAMRAP is set', () => {
    render(
      <FixedSetsFields
        value={makeScalar({ lastSetAMRAP: true })}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    expect(screen.getByText('REST BETWEEN SETS')).toBeInTheDocument()
    expect(screen.getByText('LAST SET AMRAP')).toBeInTheDocument()
  })

  // -- 6. More options defaultClosed when options are empty -------------------

  it('keeps "More options" closed when restBetweenSets and lastSetAMRAP are unset', () => {
    render(<FixedSetsFields value={makeScalar()} onChange={onChange} exerciseSupports1RM={false} />)

    expect(screen.getByText('More options')).toBeInTheDocument()
    expect(screen.queryByText('REST BETWEEN SETS')).not.toBeInTheDocument()
    expect(screen.queryByText('LAST SET AMRAP')).not.toBeInTheDocument()
  })

  // -- 7. AMRAP checkbox toggle -----------------------------------------------

  it('fires onChange with lastSetAMRAP toggled when checkbox is clicked', async () => {
    const user = userEvent.setup()

    render(
      <FixedSetsFields
        value={makeScalar({ lastSetAMRAP: false, restBetweenSets: { seconds: 60 } })}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lastSetAMRAP: true }))
  })

  it('fires onChange with lastSetAMRAP false when unchecking', async () => {
    const user = userEvent.setup()

    render(
      <FixedSetsFields
        value={makeScalar({ lastSetAMRAP: true })}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lastSetAMRAP: false }))
  })
})
