// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WorkoutPausedBar } from '@/components/workout/workout-paused-bar'

function makeProps(overrides: Partial<React.ComponentProps<typeof WorkoutPausedBar>> = {}) {
  return {
    isPaused: true,
    onResume: vi.fn(),
    onFinish: vi.fn(),
    isFinishing: false,
    canFinish: true,
    onDiscard: vi.fn(),
    showFinishHelper: false,
    ...overrides,
  }
}

describe('WorkoutPausedBar', () => {
  it('renders Resume, Finish, and Discard buttons when paused', () => {
    render(<WorkoutPausedBar {...makeProps()} />)
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
  })

  it('disables Finish when canFinish is false', () => {
    render(<WorkoutPausedBar {...makeProps({ canFinish: false })} />)
    expect(screen.getByRole('button', { name: /finish/i })).toBeDisabled()
  })

  it('enables Finish when canFinish is true', () => {
    render(<WorkoutPausedBar {...makeProps({ canFinish: true })} />)
    expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled()
  })

  it('shows helper text only when showFinishHelper is true', () => {
    const { rerender } = render(
      <WorkoutPausedBar {...makeProps({ showFinishHelper: true, canFinish: false })} />,
    )
    expect(screen.getByText(/log a set before finishing/i)).toBeInTheDocument()

    rerender(<WorkoutPausedBar {...makeProps({ showFinishHelper: false })} />)
    expect(screen.queryByText(/log a set before finishing/i)).not.toBeInTheDocument()
  })

  it('fires callbacks on click', async () => {
    const user = userEvent.setup()
    const onResume = vi.fn()
    const onFinish = vi.fn()
    const onDiscard = vi.fn()
    render(<WorkoutPausedBar {...makeProps({ onResume, onFinish, onDiscard, canFinish: true })} />)
    await user.click(screen.getByRole('button', { name: /resume/i }))
    await user.click(screen.getByRole('button', { name: /finish/i }))
    await user.click(screen.getByRole('button', { name: /discard/i }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('marks contained controls as inert when not paused', () => {
    render(<WorkoutPausedBar {...makeProps({ isPaused: false })} />)
    // Buttons remain in DOM (always-mounted pattern) but are aria-hidden + tabIndex=-1
    const buttons = screen.getAllByRole('button', { hidden: true })
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('tabIndex', '-1')
      expect(btn).toHaveAttribute('aria-hidden', 'true')
    }
  })
})
