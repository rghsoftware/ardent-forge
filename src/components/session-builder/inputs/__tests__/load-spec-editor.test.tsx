// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoadSpecEditor } from '@/components/session-builder/inputs/load-spec-editor'
import type { LoadSpec, SetScheme } from '@/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderEditor(
  overrides: Partial<{
    value: LoadSpec
    onChange: (spec: LoadSpec) => void
    schemeType: SetScheme['type']
    exerciseSupports1RM: boolean
  }> = {},
) {
  const props = {
    value: overrides.value ?? { type: 'unspecified' as const },
    onChange: overrides.onChange ?? vi.fn(),
    schemeType: overrides.schemeType ?? ('fixedSets' as SetScheme['type']),
    exerciseSupports1RM: overrides.exerciseSupports1RM,
  }
  return { ...render(<LoadSpecEditor {...props} />), props }
}

describe('LoadSpecEditor', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- Null render (allowedLoads === null) ------------------------------------

  it('returns null when scheme manages load internally (percentageSets)', () => {
    const { container } = renderEditor({ schemeType: 'percentageSets', onChange })
    expect(container.innerHTML).toBe('')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('returns null for cardioSteadyState (null visibility)', () => {
    const { container } = renderEditor({ schemeType: 'cardioSteadyState', onChange })
    expect(container.innerHTML).toBe('')
  })

  it('returns null for percentageOfMaxReps (null visibility)', () => {
    const { container } = renderEditor({ schemeType: 'percentageOfMaxReps', onChange })
    expect(container.innerHTML).toBe('')
  })

  // -- useEffect auto-reset: current type no longer allowed ------------------

  it('fires onChange with unspecified when scheme changes and current type is disallowed', () => {
    // fixedSets allows: absolute, rpe, bodyweight, bodyweightPlus, unspecified
    // workToMax allows: absolute, rpe, unspecified
    // Start with fixedSets + bodyweight, then rerender with workToMax
    const { rerender } = render(
      <LoadSpecEditor value={{ type: 'bodyweight' }} onChange={onChange} schemeType="fixedSets" />,
    )

    expect(onChange).not.toHaveBeenCalled()

    // Switch scheme to workToMax -- bodyweight is NOT in its allowed list
    rerender(
      <LoadSpecEditor value={{ type: 'bodyweight' }} onChange={onChange} schemeType="workToMax" />,
    )

    expect(onChange).toHaveBeenCalledWith({ type: 'unspecified' })
  })

  it('resets bodyweightPlus when switching to workToMax', () => {
    const { rerender } = render(
      <LoadSpecEditor
        value={{ type: 'bodyweightPlus', additionalWeight: { value: 25, unit: 'lb' } }}
        onChange={onChange}
        schemeType="fixedSets"
      />,
    )

    rerender(
      <LoadSpecEditor
        value={{ type: 'bodyweightPlus', additionalWeight: { value: 25, unit: 'lb' } }}
        onChange={onChange}
        schemeType="workToMax"
      />,
    )

    expect(onChange).toHaveBeenCalledWith({ type: 'unspecified' })
  })

  // -- useEffect no-op: current type still allowed ---------------------------

  it('does not reset when scheme changes but current type is still allowed', () => {
    // fixedSets allows: absolute, rpe, bodyweight, bodyweightPlus, unspecified
    // emom allows:      absolute, rpe, bodyweight, bodyweightPlus, unspecified
    const { rerender } = render(
      <LoadSpecEditor
        value={{ type: 'absolute', weight: { value: 135, unit: 'lb' } }}
        onChange={onChange}
        schemeType="fixedSets"
      />,
    )

    rerender(
      <LoadSpecEditor
        value={{ type: 'absolute', weight: { value: 135, unit: 'lb' } }}
        onChange={onChange}
        schemeType="emom"
      />,
    )

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not reset unspecified when switching between schemes that both allow it', () => {
    const { rerender } = render(
      <LoadSpecEditor value={{ type: 'unspecified' }} onChange={onChange} schemeType="fixedSets" />,
    )

    rerender(
      <LoadSpecEditor value={{ type: 'unspecified' }} onChange={onChange} schemeType="workToMax" />,
    )

    expect(onChange).not.toHaveBeenCalled()
  })

  // -- useEffect early return: allowedLoads is null --------------------------

  it('does not fire reset when scheme has null visibility (manages load internally)', () => {
    const { rerender } = render(
      <LoadSpecEditor
        value={{ type: 'absolute', weight: { value: 200, unit: 'lb' } }}
        onChange={onChange}
        schemeType="fixedSets"
      />,
    )

    // Switch to percentageSets (null visibility) -- should early return, no reset
    rerender(
      <LoadSpecEditor
        value={{ type: 'absolute', weight: { value: 200, unit: 'lb' } }}
        onChange={onChange}
        schemeType="percentageSets"
      />,
    )

    expect(onChange).not.toHaveBeenCalled()
  })

  // -- handleTypeChange: Select interactions ---------------------------------

  it('calls onChange with absolute defaults when selecting WEIGHT', async () => {
    const user = userEvent.setup()
    renderEditor({ value: { type: 'unspecified' }, onChange, schemeType: 'fixedSets' })

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('WEIGHT'))

    expect(onChange).toHaveBeenCalledWith({
      type: 'absolute',
      weight: { value: 135, unit: 'lb' },
    })
  })

  it('calls onChange with rpe defaults when selecting RPE', async () => {
    const user = userEvent.setup()
    renderEditor({ value: { type: 'unspecified' }, onChange, schemeType: 'fixedSets' })

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('RPE'))

    expect(onChange).toHaveBeenCalledWith({ type: 'rpe', target: 7 })
  })

  it('calls onChange with bodyweight when selecting BW', async () => {
    const user = userEvent.setup()
    renderEditor({ value: { type: 'unspecified' }, onChange, schemeType: 'fixedSets' })

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('BW'))

    expect(onChange).toHaveBeenCalledWith({ type: 'bodyweight' })
  })

  it('calls onChange with bodyweightPlus defaults when selecting BW+', async () => {
    const user = userEvent.setup()
    renderEditor({ value: { type: 'unspecified' }, onChange, schemeType: 'fixedSets' })

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('BW+'))

    expect(onChange).toHaveBeenCalledWith({
      type: 'bodyweightPlus',
      additionalWeight: { value: 25, unit: 'lb' },
    })
  })

  it('calls onChange with unspecified when selecting NONE', async () => {
    const user = userEvent.setup()
    renderEditor({
      value: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
      onChange,
      schemeType: 'fixedSets',
    })

    // absolute type renders WeightInput with its own combobox (unit picker),
    // so target the first combobox which is the load type select
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByText('NONE'))

    expect(onChange).toHaveBeenCalledWith({ type: 'unspecified' })
  })

  it('percentageOf1RM and percentMaxReps are filtered out by scheme visibility', async () => {
    // No scheme includes percentageOf1RM or percentMaxReps in its allowed list,
    // so these options should never appear in the dropdown regardless of exerciseSupports1RM
    const user = userEvent.setup()
    renderEditor({
      value: { type: 'unspecified' },
      onChange,
      schemeType: 'fixedSets',
      exerciseSupports1RM: true,
    })

    await user.click(screen.getByRole('combobox'))

    expect(screen.queryByText('% 1RM')).not.toBeInTheDocument()
    expect(screen.queryByText('% MAX REPS')).not.toBeInTheDocument()
  })

  // -- exerciseSupports1RM filtering -----------------------------------------

  it('does not show % 1RM option when exerciseSupports1RM is false', async () => {
    const user = userEvent.setup()
    renderEditor({
      value: { type: 'unspecified' },
      onChange,
      schemeType: 'fixedSets',
      exerciseSupports1RM: false,
    })

    await user.click(screen.getByRole('combobox'))

    expect(screen.queryByText('% 1RM')).not.toBeInTheDocument()
  })

  it('does not show % 1RM option when exerciseSupports1RM is omitted (defaults false)', async () => {
    const user = userEvent.setup()
    renderEditor({ value: { type: 'unspecified' }, onChange, schemeType: 'fixedSets' })

    await user.click(screen.getByRole('combobox'))

    expect(screen.queryByText('% 1RM')).not.toBeInTheDocument()
  })

  it('exerciseSupports1RM=true still filters out % 1RM when scheme does not allow it', async () => {
    // Even with exerciseSupports1RM=true, the scheme visibility gate takes precedence.
    // fixedSets does not include percentageOf1RM in its allowed list.
    const user = userEvent.setup()
    renderEditor({
      value: { type: 'unspecified' },
      onChange,
      schemeType: 'fixedSets',
      exerciseSupports1RM: true,
    })

    await user.click(screen.getByRole('combobox'))

    expect(screen.queryByText('% 1RM')).not.toBeInTheDocument()
  })

  // -- Scheme-level filtering of load types ----------------------------------

  it('only renders allowed load types for workToMax', async () => {
    // workToMax allows: absolute, rpe, unspecified
    const user = userEvent.setup()
    renderEditor({ value: { type: 'unspecified' }, onChange, schemeType: 'workToMax' })

    await user.click(screen.getByRole('combobox'))

    // Use getAllByRole to count the option items
    const options = screen.getAllByRole('option')
    const optionTexts = options.map((o) => o.textContent)
    expect(optionTexts).toContain('WEIGHT')
    expect(optionTexts).toContain('RPE')
    expect(optionTexts).toContain('NONE')
    expect(optionTexts).not.toContain('BW')
    expect(optionTexts).not.toContain('BW+')
    expect(optionTexts).not.toContain('% MAX REPS')
    expect(optionTexts).not.toContain('% 1RM')
    expect(options).toHaveLength(3)
  })

  // -- Conditional value fields ----------------------------------------------

  it('renders weight input when type is absolute', () => {
    renderEditor({
      value: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
      onChange,
      schemeType: 'fixedSets',
    })
    expect(screen.getByLabelText('WEIGHT value')).toBeInTheDocument()
  })

  it('renders % OF 1RM input when type is percentageOf1RM', () => {
    renderEditor({
      value: { type: 'percentageOf1RM', percentage: 0.75 },
      onChange,
      schemeType: 'fixedSets',
      exerciseSupports1RM: true,
    })
    expect(screen.getByText('% OF 1RM')).toBeInTheDocument()
  })

  it('renders RPE TARGET input when type is rpe', () => {
    renderEditor({
      value: { type: 'rpe', target: 7 },
      onChange,
      schemeType: 'fixedSets',
    })
    expect(screen.getByText('RPE TARGET')).toBeInTheDocument()
  })

  it('renders ADDITIONAL WEIGHT input when type is bodyweightPlus', () => {
    renderEditor({
      value: { type: 'bodyweightPlus', additionalWeight: { value: 25, unit: 'lb' } },
      onChange,
      schemeType: 'fixedSets',
    })
    expect(screen.getByText('ADDITIONAL WEIGHT')).toBeInTheDocument()
  })

  it('renders % OF MAX REPS input when type is percentMaxReps', () => {
    renderEditor({
      value: { type: 'percentMaxReps', percentage: 0.5 },
      onChange,
      schemeType: 'emom',
    })
    expect(screen.getByText('% OF MAX REPS')).toBeInTheDocument()
  })

  it('renders no value field for bodyweight type', () => {
    renderEditor({
      value: { type: 'bodyweight' },
      onChange,
      schemeType: 'fixedSets',
    })
    // Should have the select but no additional inputs
    expect(screen.queryByText('WEIGHT')).not.toBeInTheDocument()
    expect(screen.queryByText('RPE TARGET')).not.toBeInTheDocument()
    expect(screen.queryByText('% OF 1RM')).not.toBeInTheDocument()
    expect(screen.queryByText('ADDITIONAL WEIGHT')).not.toBeInTheDocument()
  })

  it('renders no value field for unspecified type', () => {
    renderEditor({
      value: { type: 'unspecified' },
      onChange,
      schemeType: 'fixedSets',
    })
    expect(screen.queryByText('RPE TARGET')).not.toBeInTheDocument()
    expect(screen.queryByText('% OF 1RM')).not.toBeInTheDocument()
    expect(screen.queryByText('ADDITIONAL WEIGHT')).not.toBeInTheDocument()
  })
})
