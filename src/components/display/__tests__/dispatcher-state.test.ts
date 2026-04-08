import { describe, it, expect, vi } from 'vitest'

import { computeDispatcherState } from '../dispatcher-state'
import type { Gym } from '@/domain/types'
import { makeGym } from '@/test/fixtures/gym'

const refetch = vi.fn()

const baseInputs = {
  authLoading: false,
  user: { id: 'user-1' },
  gymsLoading: false,
  gymsError: false,
  gyms: [] as Gym[],
  refetch,
}

describe('computeDispatcherState', () => {
  it('returns loading while auth is resolving', () => {
    const state = computeDispatcherState({ ...baseInputs, authLoading: true, user: null })
    expect(state).toEqual({ kind: 'loading' })
  })

  it('auth-loading beats gyms-loading', () => {
    const state = computeDispatcherState({
      ...baseInputs,
      authLoading: true,
      gymsLoading: true,
      user: null,
    })
    expect(state.kind).toBe('loading')
  })

  it('returns unauthenticated when user is null and auth has resolved', () => {
    const state = computeDispatcherState({ ...baseInputs, user: null })
    expect(state).toEqual({ kind: 'unauthenticated' })
  })

  it('unauthenticated beats gyms-error', () => {
    const state = computeDispatcherState({
      ...baseInputs,
      user: null,
      gymsError: true,
      gyms: undefined,
    })
    expect(state.kind).toBe('unauthenticated')
  })

  it('returns error with the refetch callback when gyms query failed and no cached data', () => {
    const state = computeDispatcherState({ ...baseInputs, gymsError: true, gyms: undefined })
    expect(state.kind).toBe('error')
    if (state.kind === 'error') {
      expect(state.retry).toBe(refetch)
    }
  })

  it('P15-028: falls through to many() on refetch error with stale cached data', () => {
    // Transient error on refetch should not blow away the chooser when
    // stale data is still cached. The dispatcher logs the error via a
    // separate useEffect in display-dispatcher.tsx.
    const gyms = [makeGym({ id: 'a' }), makeGym({ id: 'b' })]
    const state = computeDispatcherState({ ...baseInputs, gymsError: true, gyms })
    expect(state.kind).toBe('many')
  })

  it('P15-028: falls through to single() on refetch error with stale cached data', () => {
    const state = computeDispatcherState({
      ...baseInputs,
      gymsError: true,
      gyms: [makeGym({ id: 'g1' })],
    })
    expect(state).toEqual({ kind: 'single', gymId: 'g1' })
  })

  it('returns loading while gyms query is loading', () => {
    const state = computeDispatcherState({ ...baseInputs, gymsLoading: true, gyms: undefined })
    expect(state).toEqual({ kind: 'loading' })
  })

  it('returns loading when gyms is undefined (cache cold)', () => {
    const state = computeDispatcherState({ ...baseInputs, gyms: undefined })
    expect(state).toEqual({ kind: 'loading' })
  })

  it('returns zero when the gyms array is empty', () => {
    const state = computeDispatcherState({ ...baseInputs, gyms: [] })
    expect(state).toEqual({ kind: 'zero' })
  })

  it('returns single(gymId) when exactly one membership', () => {
    const state = computeDispatcherState({
      ...baseInputs,
      gyms: [makeGym({ id: 'gym-solo' })],
    })
    expect(state).toEqual({ kind: 'single', gymId: 'gym-solo' })
  })

  it('returns many(gyms) when 2+ memberships', () => {
    const gyms = [makeGym({ id: 'a' }), makeGym({ id: 'b' }), makeGym({ id: 'c' })]
    const state = computeDispatcherState({ ...baseInputs, gyms })
    expect(state.kind).toBe('many')
    if (state.kind === 'many') {
      expect(state.gyms).toEqual(gyms)
    }
  })

  it('gyms-error beats gyms-loading when no cached data (operator can retry)', () => {
    const state = computeDispatcherState({
      ...baseInputs,
      gymsLoading: true,
      gymsError: true,
      gyms: undefined,
    })
    expect(state.kind).toBe('error')
  })
})
