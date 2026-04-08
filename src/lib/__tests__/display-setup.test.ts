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
    it('leaves names under 48 code points unchanged', () => {
      const name = 'A'.repeat(47)
      expect(derivePersonalGymName(name)).toBe(`${name}'s Training`)
    })

    it('leaves names exactly 48 code points unchanged', () => {
      const name = 'A'.repeat(48)
      expect(derivePersonalGymName(name)).toBe(`${name}'s Training`)
    })

    it('clamps a 100-char input to 48 + suffix', () => {
      const name = 'a'.repeat(100)
      const result = derivePersonalGymName(name)
      expect(result).toBe(`${'a'.repeat(48)}'s Training`)
      // 48 + 11 = 59 characters, comfortably under the 60-char gyms.name
      // SQL check constraint.
      expect(result.length).toBeLessThanOrEqual(60)
    })

    it('does not split a surrogate pair at the 48-code-point boundary', () => {
      // Build a name where the 48th and 49th characters form one emoji so
      // naive `.slice(0, 48)` on code units would mangle it.
      const filler = 'a'.repeat(47)
      const emoji = '\u{1F4AA}' // 💪 — 2 code units, 1 code point
      const name = `${filler}${emoji}${emoji}${emoji}`
      const result = derivePersonalGymName(name)
      // The clamp runs on code points: 47 fillers + 1 full emoji = 48 cps
      expect(result).toBe(`${filler}${emoji}'s Training`)
      // And crucially, the first emoji should be intact (no lone surrogate).
      expect(result).not.toContain("\uD83D's")
    })

    it('handles a name that is exactly at the SQL limit after suffixing', () => {
      const name = 'A'.repeat(49)
      const result = derivePersonalGymName(name)
      // 49 trimmed to 48 + 11 char suffix = 59 characters total
      expect(result.length).toBe(59)
      expect(result.startsWith('A'.repeat(48))).toBe(true)
      expect(result.endsWith("'s Training")).toBe(true)
    })
  })
})
