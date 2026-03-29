// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetSchemeEditor } from '@/components/session-builder/set-scheme-editor'
import { defaultScheme } from '@/components/session-builder/set-scheme-defaults'

describe('SetSchemeEditor', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- Type selector grid ---------------------------------------------------

  it('renders all scheme type buttons', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    // Strength group
    expect(screen.getByText('Fixed')).toBeInTheDocument()
    expect(screen.getByText('% 1RM')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument()
    // Endurance group
    expect(screen.getByText('Reps')).toBeInTheDocument()
    expect(screen.getByText('Hold')).toBeInTheDocument()
    expect(screen.getByText('% Reps')).toBeInTheDocument()
    // Cardio group
    expect(screen.getByText('Steady')).toBeInTheDocument()
    expect(screen.getByText('Interval')).toBeInTheDocument()
    expect(screen.getByText('Ruck')).toBeInTheDocument()
    // Metcon group
    expect(screen.getByText('EMOM')).toBeInTheDocument()
    expect(screen.getByText('AMRAP')).toBeInTheDocument()
    expect(screen.getByText('Descend')).toBeInTheDocument()
  })

  it('renders group labels', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getByText('STRENGTH')).toBeInTheDocument()
    expect(screen.getByText('ENDURANCE')).toBeInTheDocument()
    expect(screen.getByText('CARDIO')).toBeInTheDocument()
    expect(screen.getByText('METCON')).toBeInTheDocument()
  })

  // -- fixedSets fields -----------------------------------------------------

  it('renders SETS and REPS fields for fixedSets', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getByLabelText('SETS')).toBeInTheDocument()
    expect(screen.getByLabelText('REPS')).toBeInTheDocument()
  })

  it('renders LOAD section for fixedSets', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getByText('LOAD')).toBeInTheDocument()
  })

  it('renders REST BETWEEN SETS for fixedSets', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getByText('REST BETWEEN SETS')).toBeInTheDocument()
  })

  it('renders LAST SET AMRAP checkbox for fixedSets', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getByText('LAST SET AMRAP')).toBeInTheDocument()
  })

  // -- switching types changes fields ---------------------------------------

  it('switching to percentageSets calls onChange with correct type', async () => {
    const user = userEvent.setup()
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    await user.click(screen.getByText('% 1RM'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'percentageSets' }))
  })

  // -- percentageSets fields ------------------------------------------------

  it('renders % OF 1RM field for percentageSets', () => {
    render(<SetSchemeEditor value={defaultScheme('percentageSets')} onChange={onChange} />)
    expect(screen.getByLabelText('% OF 1RM')).toBeInTheDocument()
  })

  // -- workToMax fields -----------------------------------------------------

  it('renders TARGET REP RANGE for workToMax', () => {
    render(<SetSchemeEditor value={defaultScheme('workToMax')} onChange={onChange} />)
    expect(screen.getByLabelText('TARGET REP RANGE minimum')).toBeInTheDocument()
    expect(screen.getByLabelText('TARGET REP RANGE maximum')).toBeInTheDocument()
  })

  // -- timedHold fields -----------------------------------------------------

  it('renders HOLD DURATION for timedHold', () => {
    render(<SetSchemeEditor value={defaultScheme('timedHold')} onChange={onChange} />)
    expect(screen.getByText('HOLD DURATION')).toBeInTheDocument()
  })

  // -- cardioSteadyState fields ---------------------------------------------

  it('renders MODALITY for cardioSteadyState', () => {
    render(<SetSchemeEditor value={defaultScheme('cardioSteadyState')} onChange={onChange} />)
    expect(screen.getByText('MODALITY')).toBeInTheDocument()
  })

  // -- emom fields ----------------------------------------------------------

  it('renders REPS / MIN and TOTAL MIN for emom', () => {
    render(<SetSchemeEditor value={defaultScheme('emom')} onChange={onChange} />)
    expect(screen.getByLabelText('REPS / MIN')).toBeInTheDocument()
    expect(screen.getByLabelText('TOTAL MIN')).toBeInTheDocument()
  })

  // -- amrapTimed fields ----------------------------------------------------

  it('renders TIME CAP for amrapTimed', () => {
    render(<SetSchemeEditor value={defaultScheme('amrapTimed')} onChange={onChange} />)
    expect(screen.getByText('TIME CAP')).toBeInTheDocument()
  })

  // -- descendingReps fields ------------------------------------------------

  it('renders REP LADDER input for descendingReps', () => {
    render(<SetSchemeEditor value={defaultScheme('descendingReps')} onChange={onChange} />)
    expect(screen.getByLabelText('Rep ladder')).toBeInTheDocument()
  })

  // -- validation errors ----------------------------------------------------

  it('displays validation errors when provided', () => {
    render(
      <SetSchemeEditor
        value={defaultScheme('fixedSets')}
        onChange={onChange}
        errors={{ sets: 'Sets must be at least 1' }}
      />,
    )
    expect(screen.getByText('Sets must be at least 1')).toBeInTheDocument()
  })
})
