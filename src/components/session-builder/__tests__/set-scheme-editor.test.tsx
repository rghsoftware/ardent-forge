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

  it('renders active group type buttons and group selector', async () => {
    const user = userEvent.setup()
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    // Default group is STRENGTH -- its types visible (may appear in summary too)
    expect(screen.getAllByText('Fixed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('% 1RM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Max').length).toBeGreaterThanOrEqual(1)
    // Group selector buttons are visible
    expect(screen.getAllByText('STRENGTH').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ENDURANCE').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('CARDIO').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('METCON').length).toBeGreaterThanOrEqual(1)
    // Switch to ENDURANCE group to see its types
    await user.click(screen.getAllByText('ENDURANCE')[0])
    expect(screen.getByText('Reps')).toBeInTheDocument()
    expect(screen.getByText('Hold')).toBeInTheDocument()
    expect(screen.getByText('% Reps')).toBeInTheDocument()
  })

  it('renders group selector labels', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getAllByText('STRENGTH').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ENDURANCE').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('CARDIO').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('METCON').length).toBeGreaterThanOrEqual(1)
  })

  // -- fixedSets fields -----------------------------------------------------

  it('renders SETS and REPS fields for fixedSets', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    expect(screen.getByLabelText('SETS')).toBeInTheDocument()
    expect(screen.getByLabelText('REPS')).toBeInTheDocument()
  })

  it('renders load type selector for fixedSets', () => {
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    // Load type is now a Select dropdown; check for the trigger
    expect(screen.getByText('NONE')).toBeInTheDocument()
  })

  it('renders REST and AMRAP in More options for fixedSets', async () => {
    const user = userEvent.setup()
    render(<SetSchemeEditor value={defaultScheme('fixedSets')} onChange={onChange} />)
    // REST and AMRAP are behind "More options" collapsible
    const moreBtn = screen.getByText('More options')
    expect(moreBtn).toBeInTheDocument()
    await user.click(moreBtn)
    expect(screen.getByText('REST BETWEEN SETS')).toBeInTheDocument()
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
