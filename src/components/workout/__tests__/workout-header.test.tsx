// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WorkoutHeader } from '@/components/workout/workout-header'

describe('WorkoutHeader', () => {
  it('renders the elapsed timer', () => {
    render(<WorkoutHeader elapsedSeconds={65} />)
    expect(screen.getByText(/1:05|01:05/)).toBeInTheDocument()
  })

  it('does not render any Finish element', () => {
    const { rerender } = render(<WorkoutHeader elapsedSeconds={0} />)
    expect(screen.queryByText(/finish/i)).not.toBeInTheDocument()

    rerender(<WorkoutHeader elapsedSeconds={0} isPaused />)
    expect(screen.queryByText(/finish/i)).not.toBeInTheDocument()
  })

  it('renders the pause button and fires onPause when not paused', async () => {
    const onPause = vi.fn()
    const onResume = vi.fn()
    const user = userEvent.setup()
    render(<WorkoutHeader elapsedSeconds={0} onPause={onPause} onResume={onResume} />)
    await user.click(screen.getByRole('button', { name: /pause workout/i }))
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onResume).not.toHaveBeenCalled()
  })

  it('fires onResume when paused and pause toggle clicked', async () => {
    const onPause = vi.fn()
    const onResume = vi.fn()
    const user = userEvent.setup()
    render(<WorkoutHeader elapsedSeconds={0} isPaused onPause={onPause} onResume={onResume} />)
    await user.click(screen.getByRole('button', { name: /resume workout/i }))
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(onPause).not.toHaveBeenCalled()
  })

  it('renders provided actions slot children', () => {
    render(<WorkoutHeader elapsedSeconds={0} actions={<button type="button">cast-slot</button>} />)
    expect(screen.getByRole('button', { name: 'cast-slot' })).toBeInTheDocument()
  })

  it('shows the Paused badge when isPaused is true', () => {
    render(<WorkoutHeader elapsedSeconds={0} isPaused />)
    expect(screen.getByText(/paused/i)).toBeInTheDocument()
  })
})
