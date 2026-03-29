// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '../use-debounced-value'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300))

    expect(result.current).toBe('hello')
  })

  it('updates the value after the debounce period', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'hello', delay: 300 },
    })

    expect(result.current).toBe('hello')

    rerender({ value: 'world', delay: 300 })

    // Before debounce period, value should still be old
    expect(result.current).toBe('hello')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('world')
  })

  it('emits only the last value when changes happen rapidly', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'a', delay: 200 },
    })

    rerender({ value: 'b', delay: 200 })
    act(() => {
      vi.advanceTimersByTime(50)
    })

    rerender({ value: 'c', delay: 200 })
    act(() => {
      vi.advanceTimersByTime(50)
    })

    rerender({ value: 'd', delay: 200 })

    // Still the initial value since no full debounce period has passed
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Only the last value is emitted
    expect(result.current).toBe('d')
  })

  it('uses the default delay of 200ms when none specified', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'start' },
    })

    rerender({ value: 'end' })

    // Before default 200ms
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(result.current).toBe('start')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('end')
  })

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 42 },
    })

    expect(result.current).toBe(42)

    rerender({ value: 99 })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe(99)
  })

  it('resets the timer when value changes before debounce expires', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'first', delay: 300 },
    })

    // Change value at 200ms -- should reset the timer
    rerender({ value: 'second', delay: 300 })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('first')

    // Change again at 400ms total -- resets again
    rerender({ value: 'third', delay: 300 })

    // At 600ms total (200ms after last change), not yet debounced
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('first')

    // At 700ms total (300ms after last change), should be debounced
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('third')
  })
})
