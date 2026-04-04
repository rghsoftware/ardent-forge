// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ClockDisplay } from '../clock-display'

describe('ClockDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-04T14:30:00'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders initial time', () => {
    render(<ClockDisplay format="24h" />)
    expect(screen.getByText(/14:30:00/)).toBeInTheDocument()
  })

  it('advances by 1 second after timer tick', () => {
    render(<ClockDisplay format="24h" />)
    expect(screen.getByText(/14:30:00/)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText(/14:30:01/)).toBeInTheDocument()
  })

  it('24h format renders without AM/PM', () => {
    render(<ClockDisplay format="24h" />)
    const el = screen.getByText(/14:30:00/)
    expect(el.textContent).not.toMatch(/AM|PM/)
  })

  it('12h format renders with AM/PM', () => {
    render(<ClockDisplay format="12h" />)
    const el = screen.getByText(/2:30:00/)
    expect(el.textContent).toMatch(/AM|PM/)
  })

  it('serverTimeCorrection prop change resets displayed time', () => {
    const { rerender } = render(<ClockDisplay format="24h" />)
    const initialEl = screen.getByText(/\d{2}:\d{2}:\d{2}/)
    const initialTime = initialEl.textContent!

    // Apply a server correction 30 minutes ahead of local Date.now()
    const correctedDate = new Date(Date.now() + 30 * 60 * 1000)
    const serverIso = correctedDate.toISOString()

    rerender(<ClockDisplay format="24h" serverTimeCorrection={serverIso} />)

    const updatedTime = screen.getByText(/\d{2}:\d{2}:\d{2}/).textContent!
    expect(updatedTime).not.toBe(initialTime)
  })

  it('clears setInterval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<ClockDisplay format="24h" />)

    unmount()

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
