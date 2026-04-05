// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DurationInput } from '@/components/session-builder/inputs/duration-input'

describe('DurationInput', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- Size variants ---------------------------------------------------------

  it('renders compact labels "M" and "S"', () => {
    render(<DurationInput value={{ seconds: 0 }} label="REST" size="compact" onChange={onChange} />)
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('renders default labels "MIN" and "SEC"', () => {
    render(<DurationInput value={{ seconds: 0 }} label="REST" onChange={onChange} />)
    expect(screen.getByText('MIN')).toBeInTheDocument()
    expect(screen.getByText('SEC')).toBeInTheDocument()
  })

  // -- Non-clearable behavior ------------------------------------------------

  it('emits { seconds: 0 } when non-clearable and both fields are zero', async () => {
    const user = userEvent.setup()
    render(<DurationInput value={{ seconds: 0 }} label="REST" onChange={onChange} />)

    const secondsInput = screen.getByLabelText('REST seconds')

    await user.clear(secondsInput)
    await user.type(secondsInput, '0')

    expect(onChange).toHaveBeenLastCalledWith({ seconds: 0 })
  })

  // -- Clearable behavior ----------------------------------------------------

  it('emits undefined when clearable and both fields are zero', async () => {
    const user = userEvent.setup()
    render(<DurationInput value={{ seconds: 0 }} label="REST" clearable onChange={onChange} />)

    const secondsInput = screen.getByLabelText('REST seconds')

    await user.clear(secondsInput)
    await user.type(secondsInput, '0')

    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('emits Duration (not undefined) when clearable and value is non-zero', async () => {
    const user = userEvent.setup()
    render(<DurationInput value={{ seconds: 0 }} label="REST" clearable onChange={onChange} />)

    const minutesInput = screen.getByLabelText('REST minutes')

    await user.clear(minutesInput)
    await user.type(minutesInput, '1')

    expect(onChange).toHaveBeenLastCalledWith({ seconds: 60 })
  })

  // -- Empty / invalid input -------------------------------------------------

  it('defaults to 0 seconds when input is cleared to empty', async () => {
    const user = userEvent.setup()
    render(<DurationInput value={{ seconds: 30 }} label="REST" onChange={onChange} />)

    const secondsInput = screen.getByLabelText('REST seconds')

    await user.clear(secondsInput)

    expect(onChange).toHaveBeenLastCalledWith({ seconds: 0 })
  })

  // -- Minutes conversion ----------------------------------------------------

  it('converts minutes to correct total seconds', async () => {
    const user = userEvent.setup()
    render(<DurationInput value={{ seconds: 0 }} label="REST" onChange={onChange} />)

    const minutesInput = screen.getByLabelText('REST minutes')

    await user.clear(minutesInput)
    await user.type(minutesInput, '2')

    expect(onChange).toHaveBeenLastCalledWith({ seconds: 120 })
  })
})
