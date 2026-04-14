// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RestTimerBanner } from '@/components/workout/rest-timer-banner'
import { formatCountdown } from '@/lib/format-duration'

function makeProps(overrides: Partial<React.ComponentProps<typeof RestTimerBanner>> = {}) {
  return {
    remaining: 60,
    total: 120,
    onExpand: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  }
}

/**
 * The progress bar is the inner <div> with an inline `width` style. It is the
 * first <div> with style.width inside the banner. We locate it by walking the
 * DOM from the container.
 */
function getProgressBarWidth(container: HTMLElement): string {
  const bars = container.querySelectorAll<HTMLDivElement>('div[style*="width"]')
  expect(bars.length).toBeGreaterThan(0)
  return bars[0].style.width
}

describe('RestTimerBanner', () => {
  describe('progress bar clamping', () => {
    it('caps progress at 100% when remaining > total', () => {
      const { container } = render(<RestTimerBanner {...makeProps({ remaining: 200, total: 60 })} />)
      expect(getProgressBarWidth(container)).toBe('100%')
    })

    it('clamps progress to 0% when remaining is negative', () => {
      const { container } = render(<RestTimerBanner {...makeProps({ remaining: -10, total: 60 })} />)
      expect(getProgressBarWidth(container)).toBe('0%')
    })

    it('clamps progress to 0% when remaining is zero', () => {
      const { container } = render(<RestTimerBanner {...makeProps({ remaining: 0, total: 60 })} />)
      expect(getProgressBarWidth(container)).toBe('0%')
    })

    it('computes ~50% progress when remaining is half of total', () => {
      const { container } = render(<RestTimerBanner {...makeProps({ remaining: 30, total: 60 })} />)
      expect(getProgressBarWidth(container)).toBe('50%')
    })
  })

  describe('total = 0 guard', () => {
    it('renders safely with 0% progress when total is 0 (no NaN, no divide-by-zero)', () => {
      const { container } = render(<RestTimerBanner {...makeProps({ remaining: 30, total: 0 })} />)
      const width = getProgressBarWidth(container)
      expect(width).toBe('0%')
      expect(width).not.toMatch(/NaN/i)
      expect(container.innerHTML).not.toMatch(/NaN/i)
    })
  })

  describe('Expand button', () => {
    it('renders an Expand button', () => {
      render(<RestTimerBanner {...makeProps()} />)
      expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument()
    })

    it('fires onExpand when clicked', async () => {
      const user = userEvent.setup()
      const onExpand = vi.fn()
      render(<RestTimerBanner {...makeProps({ onExpand })} />)
      await user.click(screen.getByRole('button', { name: /expand/i }))
      expect(onExpand).toHaveBeenCalledTimes(1)
    })
  })

  describe('Skip button', () => {
    it('renders a Skip button', () => {
      render(<RestTimerBanner {...makeProps()} />)
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    it('fires onSkip when clicked', async () => {
      const user = userEvent.setup()
      const onSkip = vi.fn()
      render(<RestTimerBanner {...makeProps({ onSkip })} />)
      await user.click(screen.getByRole('button', { name: /skip/i }))
      expect(onSkip).toHaveBeenCalledTimes(1)
    })
  })

  describe('countdown text', () => {
    it('renders the formatted countdown from formatCountdown(remaining)', () => {
      render(<RestTimerBanner {...makeProps({ remaining: 90, total: 120 })} />)
      // formatCountdown(90) -> "1:30"
      expect(screen.getByText(formatCountdown(90))).toBeInTheDocument()
      expect(screen.getByText('1:30')).toBeInTheDocument()
    })

    it('renders "0:00" when remaining is 0', () => {
      render(<RestTimerBanner {...makeProps({ remaining: 0, total: 60 })} />)
      expect(screen.getByText('0:00')).toBeInTheDocument()
    })
  })
})
