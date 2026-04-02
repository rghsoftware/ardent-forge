// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RestTimerOverlay } from '@/components/workout/rest-timer-overlay'

// Mock formatCountdown to return a predictable string
vi.mock('@/lib/format-duration', () => ({
  formatCountdown: (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  },
}))

describe('RestTimerOverlay', () => {
  const onSkip = vi.fn()
  const onAdjust = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when restTimer is null', () => {
    const { container } = render(
      <RestTimerOverlay restTimer={null} onSkip={onSkip} onAdjust={onAdjust} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('displays countdown when restTimer is active', () => {
    render(
      <RestTimerOverlay
        restTimer={{ remaining: 90, total: 120 }}
        onSkip={onSkip}
        onAdjust={onAdjust}
      />,
    )
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })

  it('displays the REST label', () => {
    render(
      <RestTimerOverlay
        restTimer={{ remaining: 60, total: 90 }}
        onSkip={onSkip}
        onAdjust={onAdjust}
      />,
    )
    expect(screen.getByText('REST')).toBeInTheDocument()
  })

  it('skip button calls onSkip', async () => {
    const user = userEvent.setup()
    render(
      <RestTimerOverlay
        restTimer={{ remaining: 45, total: 90 }}
        onSkip={onSkip}
        onAdjust={onAdjust}
      />,
    )
    await user.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('-30s button calls onAdjust with -30', async () => {
    const user = userEvent.setup()
    render(
      <RestTimerOverlay
        restTimer={{ remaining: 60, total: 90 }}
        onSkip={onSkip}
        onAdjust={onAdjust}
      />,
    )
    await user.click(screen.getByText('-30s'))
    expect(onAdjust).toHaveBeenCalledWith(-30)
  })

  it('+30s button calls onAdjust with 30', async () => {
    const user = userEvent.setup()
    render(
      <RestTimerOverlay
        restTimer={{ remaining: 60, total: 90 }}
        onSkip={onSkip}
        onAdjust={onAdjust}
      />,
    )
    await user.click(screen.getByText('+30s'))
    expect(onAdjust).toHaveBeenCalledWith(30)
  })
})
