import { describe, it, expect } from 'vitest'

import { gymErrorMessage, isPgError } from '../gym-error-messages'

describe('isPgError', () => {
  it('returns true for an object with only a code field', () => {
    expect(isPgError({ code: '23505' })).toBe(true)
  })

  it('returns true for an object with only a message field', () => {
    expect(isPgError({ message: 'boom' })).toBe(true)
  })

  it('returns true for an object with both code and message', () => {
    expect(isPgError({ code: '42501', message: 'denied' })).toBe(true)
  })

  it('returns false for a string', () => {
    expect(isPgError('23505')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isPgError(42)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPgError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPgError(undefined)).toBe(false)
  })

  it('returns false for an object without code or message', () => {
    expect(isPgError({ other: 'thing' })).toBe(false)
  })
})

describe('gymErrorMessage', () => {
  describe('non-PG error fallback', () => {
    it('returns the generic create fallback', () => {
      expect(gymErrorMessage('network exploded', 'create')).toBe(
        'Failed to create gym. Check your connection and try again.',
      )
    })

    it('returns the generic join fallback', () => {
      expect(gymErrorMessage(null, 'join')).toBe(
        'Failed to join gym. Check your connection and try again.',
      )
    })

    it('returns the generic leave fallback', () => {
      expect(gymErrorMessage(42, 'leave')).toBe(
        'Failed to leave gym. Check your connection and try again.',
      )
    })

    it('returns the generic delete fallback', () => {
      expect(gymErrorMessage(undefined, 'delete')).toBe(
        'Failed to delete gym. Check your connection and try again.',
      )
    })
  })

  describe('23505 unique_violation', () => {
    it('uses the duplicate-name message for create', () => {
      expect(gymErrorMessage({ code: '23505' }, 'create')).toBe(
        'A gym with this name already exists. Choose a different name.',
      )
    })

    it('uses the generic duplicate-constraint fallback for join', () => {
      expect(gymErrorMessage({ code: '23505' }, 'join')).toBe(
        'Failed to join gym -- duplicate constraint. Refresh and try again.',
      )
    })

    it('uses the generic duplicate-constraint fallback for leave', () => {
      expect(gymErrorMessage({ code: '23505' }, 'leave')).toBe(
        'Failed to leave gym -- duplicate constraint. Refresh and try again.',
      )
    })

    it('uses the generic duplicate-constraint fallback for delete', () => {
      expect(gymErrorMessage({ code: '23505' }, 'delete')).toBe(
        'Failed to delete gym -- duplicate constraint. Refresh and try again.',
      )
    })
  })

  describe('42501 insufficient_privilege', () => {
    it.each(['create', 'join', 'leave', 'delete'] as const)(
      'uses the permission-denied message for %s',
      (action) => {
        expect(gymErrorMessage({ code: '42501' }, action)).toBe(
          `You don't have permission to ${action} this gym.`,
        )
      },
    )
  })

  describe('PGRST116 no-rows', () => {
    it.each(['create', 'join', 'leave', 'delete'] as const)(
      'uses the deleted-row message for %s',
      (action) => {
        expect(gymErrorMessage({ code: 'PGRST116' }, action)).toBe(
          `Failed to ${action} gym -- it may have been deleted. Refresh the list.`,
        )
      },
    )
  })

  describe('unknown PG codes', () => {
    it('falls back to the generic network message', () => {
      expect(gymErrorMessage({ code: '99999', message: 'who knows' }, 'create')).toBe(
        'Failed to create gym. Check your connection and try again.',
      )
    })

    it('falls back when only a message is present', () => {
      expect(gymErrorMessage({ message: 'no code here' }, 'delete')).toBe(
        'Failed to delete gym. Check your connection and try again.',
      )
    })
  })
})
