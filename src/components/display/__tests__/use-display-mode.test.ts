// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDisplayMode } from '../use-display-mode'
import type { DisplaySnapshot, IdleSnapshot } from '@/domain/types'

// ---------------------------------------------------------------------------
// Helpers -- minimal valid fixtures
// ---------------------------------------------------------------------------

function makeSnapshot(userId: string): DisplaySnapshot {
  return {
    user_id: userId,
    display_name: 'Test User',
    session_name: 'Push Day',
    workout_started_at: '2026-04-04T10:00:00Z',
    current_exercise: 'Bench Press',
    exercise_index: 0,
    total_exercises: 3,
    sets: [],
    rest_timer: { state: 'idle' },
    session_type: 'STRENGTH',
    is_visible: true,
  } as DisplaySnapshot
}

// ---------------------------------------------------------------------------
// useDisplayMode
// ---------------------------------------------------------------------------

describe('useDisplayMode', () => {
  it('returns idle mode when session map is empty', () => {
    const { result } = renderHook(
      ({ sessionMap, focusedUserId, idleSnapshot }) =>
        useDisplayMode(sessionMap, focusedUserId, idleSnapshot),
      {
        initialProps: {
          sessionMap: new Map<string, DisplaySnapshot>(),
          focusedUserId: null as string | null,
          idleSnapshot: null as IdleSnapshot | null,
        },
      },
    )

    expect(result.current.mode).toBe('idle')
    expect(result.current.previousMode).toBeNull()
    expect(result.current.focusedSnapshot).toBeNull()
  })

  it('returns board mode when map has one entry', () => {
    const map = new Map<string, DisplaySnapshot>([['user-1', makeSnapshot('user-1')]])

    const { result } = renderHook(
      ({ sessionMap, focusedUserId, idleSnapshot }) =>
        useDisplayMode(sessionMap, focusedUserId, idleSnapshot),
      {
        initialProps: {
          sessionMap: map,
          focusedUserId: null as string | null,
          idleSnapshot: null as IdleSnapshot | null,
        },
      },
    )

    expect(result.current.mode).toBe('board')
  })

  it('returns focused mode when focusedUserId matches an entry in the map', () => {
    const snapshot = makeSnapshot('user-1')
    const map = new Map<string, DisplaySnapshot>([['user-1', snapshot]])

    const { result } = renderHook(
      ({ sessionMap, focusedUserId, idleSnapshot }) =>
        useDisplayMode(sessionMap, focusedUserId, idleSnapshot),
      {
        initialProps: {
          sessionMap: map,
          focusedUserId: 'user-1' as string | null,
          idleSnapshot: null as IdleSnapshot | null,
        },
      },
    )

    expect(result.current.mode).toBe('focused')
    expect(result.current.focusedSnapshot).toBe(snapshot)
  })

  it('returns board mode when focusedUserId does not match any entry', () => {
    const map = new Map<string, DisplaySnapshot>([['user-1', makeSnapshot('user-1')]])

    const { result } = renderHook(
      ({ sessionMap, focusedUserId, idleSnapshot }) =>
        useDisplayMode(sessionMap, focusedUserId, idleSnapshot),
      {
        initialProps: {
          sessionMap: map,
          focusedUserId: 'user-999' as string | null,
          idleSnapshot: null as IdleSnapshot | null,
        },
      },
    )

    expect(result.current.mode).toBe('board')
    expect(result.current.focusedSnapshot).toBeNull()
  })

  it('returns idle mode when map empties after having entries', () => {
    const map = new Map<string, DisplaySnapshot>([['user-1', makeSnapshot('user-1')]])

    const { result, rerender } = renderHook(
      ({ sessionMap, focusedUserId, idleSnapshot }) =>
        useDisplayMode(sessionMap, focusedUserId, idleSnapshot),
      {
        initialProps: {
          sessionMap: map,
          focusedUserId: null as string | null,
          idleSnapshot: null as IdleSnapshot | null,
        },
      },
    )

    expect(result.current.mode).toBe('board')

    rerender({
      sessionMap: new Map<string, DisplaySnapshot>(),
      focusedUserId: null,
      idleSnapshot: null,
    })

    expect(result.current.mode).toBe('idle')
  })

  it('tracks previousMode correctly across transitions', () => {
    const { result, rerender } = renderHook(
      ({ sessionMap, focusedUserId, idleSnapshot }) =>
        useDisplayMode(sessionMap, focusedUserId, idleSnapshot),
      {
        initialProps: {
          sessionMap: new Map<string, DisplaySnapshot>(),
          focusedUserId: null as string | null,
          idleSnapshot: null as IdleSnapshot | null,
        },
      },
    )

    // Start: idle, previousMode: null
    expect(result.current.mode).toBe('idle')
    expect(result.current.previousMode).toBeNull()

    // Transition to board
    const snapshot = makeSnapshot('user-1')
    const map = new Map<string, DisplaySnapshot>([['user-1', snapshot]])
    rerender({ sessionMap: map, focusedUserId: null, idleSnapshot: null })

    expect(result.current.mode).toBe('board')
    expect(result.current.previousMode).toBe('idle')

    // Transition to focused
    rerender({ sessionMap: map, focusedUserId: 'user-1', idleSnapshot: null })

    expect(result.current.mode).toBe('focused')
    expect(result.current.previousMode).toBe('board')

    // Transition back to board (remove focus)
    rerender({ sessionMap: map, focusedUserId: null, idleSnapshot: null })

    expect(result.current.mode).toBe('board')
    expect(result.current.previousMode).toBe('focused')

    // Transition to idle (clear map)
    rerender({
      sessionMap: new Map<string, DisplaySnapshot>(),
      focusedUserId: null,
      idleSnapshot: null,
    })

    expect(result.current.mode).toBe('idle')
    expect(result.current.previousMode).toBe('board')
  })
})
