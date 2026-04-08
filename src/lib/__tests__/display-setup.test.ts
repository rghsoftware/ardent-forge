import { describe, it, expect } from 'vitest'

import { derivePersonalGymName } from '../display-setup'

describe('derivePersonalGymName', () => {
  describe('populated display name', () => {
    it('suffixes a simple display name', () => {
      expect(derivePersonalGymName('Alice')).toBe("Alice's Training")
    })

    it('suffixes a display name with spaces', () => {
      expect(derivePersonalGymName('Alice Smith')).toBe("Alice Smith's Training")
    })

    it('trims surrounding whitespace before suffixing', () => {
      expect(derivePersonalGymName('  Bob  ')).toBe("Bob's Training")
    })
  })

  describe('fallback cases', () => {
    it('falls back on null', () => {
      expect(derivePersonalGymName(null)).toBe('My Training')
    })

    it('falls back on undefined', () => {
      expect(derivePersonalGymName(undefined)).toBe('My Training')
    })

    it('falls back on empty string', () => {
      expect(derivePersonalGymName('')).toBe('My Training')
    })

    it('falls back on whitespace-only string', () => {
      expect(derivePersonalGymName('   ')).toBe('My Training')
    })
  })

  describe('length clamping', () => {
    // P15-008: the clamp is now derived from GYM_NAME_MAX (60) minus the
    // suffix length (11), so the maximum input length that survives
    // unchanged is 49 code points (60 - 11 = 49).
    it('leaves names under 49 code points unchanged', () => {
      const name = 'A'.repeat(48)
      expect(derivePersonalGymName(name)).toBe(`${name}'s Training`)
    })

    it('leaves names exactly 49 code points unchanged', () => {
      const name = 'A'.repeat(49)
      expect(derivePersonalGymName(name)).toBe(`${name}'s Training`)
    })

    it('clamps a 100-char input to 49 + suffix', () => {
      const name = 'a'.repeat(100)
      const result = derivePersonalGymName(name)
      expect(result).toBe(`${'a'.repeat(49)}'s Training`)
      // 49 + 11 = 60 characters, exactly at the 60-char gyms.name
      // SQL check constraint.
      expect(result.length).toBeLessThanOrEqual(60)
    })

    it('does not split a surrogate pair at the 49-code-point boundary', () => {
      // Build a name where the 49th and 50th characters form one emoji so
      // naive `.slice(0, 49)` on code units would mangle it.
      const filler = 'a'.repeat(48)
      const emoji = '\u{1F4AA}' // 💪 — 2 code units, 1 code point
      const name = `${filler}${emoji}${emoji}${emoji}`
      const result = derivePersonalGymName(name)
      // The clamp runs on code points: 48 fillers + 1 full emoji = 49 cps
      expect(result).toBe(`${filler}${emoji}'s Training`)
      // And crucially, the first emoji should be intact (no lone surrogate).
      expect(result).not.toContain("\uD83D's")
    })

    it('handles a name that is exactly at the SQL limit after suffixing', () => {
      const name = 'A'.repeat(50)
      const result = derivePersonalGymName(name)
      // 50 trimmed to 49 + 11 char suffix = 60 characters total (the SQL max)
      expect(result.length).toBe(60)
      expect(result.startsWith('A'.repeat(49))).toBe(true)
      expect(result.endsWith("'s Training")).toBe(true)
    })
  })
})
