// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimerInterpolation } from '../use-timer-interpolation'
import type { RestTimerState } from '@/domain/types/display-snapshot'

// ---------------------------------------------------------------------------
// rAF mock -- convert requestAnimationFrame to setTimeout so fake timers work
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Stub rAF/cAF BEFORE installing fake timers so the id space matches.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    clearTimeout(id)
  })

  // Now install fake timers -- this replaces setTimeout/clearTimeout, and
  // our stubs above close over the global names, so they follow the fakes.
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ===========================================================================
// Idle timer
// ===========================================================================

describe('idle timer', () => {
  it('returns 0 for idle timer', () => {
    const idle: RestTimerState = { state: 'idle' }
    const { result } = renderHook(() => useTimerInterpolation(idle))

    expect(result.current).toBe(0)
  })
})

// ===========================================================================
// Running timer
// ===========================================================================

describe('running timer', () => {
  it('returns correct countdown for a running timer', () => {
    const now = new Date()
    const running: RestTimerState = {
      state: 'running',
      started_at: now.toISOString(),
      total_seconds: 60,
    }

    const { result } = renderHook(() => useTimerInterpolation(running))

    // Initially should show 60 (just started, ceil of 60 - ~0 elapsed)
    expect(result.current).toBe(60)

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    // Should be around 50 (ceil of 60 - 10)
    expect(result.current).toBe(50)
  })

  it('clamps to 0 and never goes negative', () => {
    const pastStart = new Date(Date.now() - 120_000).toISOString() // 2 min ago
    const running: RestTimerState = {
      state: 'running',
      started_at: pastStart,
      total_seconds: 60,
    }

    const { result } = renderHook(() => useTimerInterpolation(running))

    // 120s elapsed on a 60s timer: should be clamped to 0
    expect(result.current).toBe(0)
  })
})

// ===========================================================================
// State transitions
// ===========================================================================

describe('state transitions', () => {
  it('updates when timer state changes from running to idle', () => {
    const now = new Date()
    const running: RestTimerState = {
      state: 'running',
      started_at: now.toISOString(),
      total_seconds: 30,
    }
    const idle: RestTimerState = { state: 'idle' }

    const { result, rerender } = renderHook<number, { timer: RestTimerState }>(
      ({ timer }) => useTimerInterpolation(timer),
      { initialProps: { timer: running } },
    )

    expect(result.current).toBe(30)

    // Switch to idle
    rerender({ timer: idle as RestTimerState })

    expect(result.current).toBe(0)
  })
})
