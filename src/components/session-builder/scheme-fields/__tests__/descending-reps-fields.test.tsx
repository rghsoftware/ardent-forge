// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DescendingRepsFields } from '../descending-reps-fields'
import type { SetScheme } from '@/domain/types'

vi.mock('../../inputs', () => ({
  LoadSpecEditor: () => <div data-testid="load-spec-editor" />,
}))

function makeValue(repLadder: number[] = [10, 8, 6, 4, 2]): SetScheme & { type: 'descendingReps' } {
  return { type: 'descendingReps', repLadder }
}

describe('DescendingRepsFields', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- Valid comma-separated input -------------------------------------------

  it('parses comma-separated input "10, 8, 6" to [10, 8, 6]', async () => {
    const user = userEvent.setup()
    render(
      <DescendingRepsFields
        value={makeValue([])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder')
    await user.type(input, '10, 8, 6')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.repLadder).toEqual([10, 8, 6])
  })

  // -- Space-separated input -------------------------------------------------

  it('parses space-separated input "10 8 6" to [10, 8, 6]', async () => {
    const user = userEvent.setup()
    render(
      <DescendingRepsFields
        value={makeValue([])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder')
    await user.type(input, '10 8 6')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.repLadder).toEqual([10, 8, 6])
  })

  // -- Mixed separators ------------------------------------------------------

  it('parses mixed separators "10, 8 6,4" correctly', async () => {
    const user = userEvent.setup()
    render(
      <DescendingRepsFields
        value={makeValue([])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder')
    await user.type(input, '10, 8 6,4')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.repLadder).toEqual([10, 8, 6, 4])
  })

  // -- Single number shows warning -------------------------------------------

  it('shows warning when only a single number is entered', async () => {
    const user = userEvent.setup()
    render(
      <DescendingRepsFields
        value={makeValue([])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder')
    await user.type(input, '10')

    expect(screen.getByText('Enter at least 2 numbers separated by commas')).toBeInTheDocument()
  })

  // -- Negative numbers filtered out -----------------------------------------

  it('filters out negative numbers from parsed array', async () => {
    const user = userEvent.setup()
    render(
      <DescendingRepsFields
        value={makeValue([])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder')
    await user.type(input, '10, -3, 6')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.repLadder).toEqual([10, 6])
    expect(lastCall.repLadder).not.toContain(-3)
  })

  // -- Empty input -----------------------------------------------------------

  it('emits empty array and shows no warning for empty input', async () => {
    const user = userEvent.setup()
    render(
      <DescendingRepsFields
        value={makeValue([10, 8, 6])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder')
    await user.clear(input)

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.repLadder).toEqual([])
    expect(
      screen.queryByText('Enter at least 2 numbers separated by commas'),
    ).not.toBeInTheDocument()
  })

  // -- External value sync ---------------------------------------------------

  it('updates ladderText when value.repLadder changes externally', () => {
    const { rerender } = render(
      <DescendingRepsFields
        value={makeValue([10, 8, 6])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    const input = screen.getByLabelText('Rep ladder') as HTMLInputElement
    expect(input.value).toBe('10, 8, 6')

    rerender(
      <DescendingRepsFields
        value={makeValue([5, 3, 1])}
        onChange={onChange}
        exerciseSupports1RM={false}
      />,
    )

    expect(input.value).toBe('5, 3, 1')
  })
})
