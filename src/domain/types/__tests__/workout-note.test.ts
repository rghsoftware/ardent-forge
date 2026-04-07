import { describe, expect, it } from 'vitest'
import { STARTER_NOTE_TAGS, normalizeTag, noteTagSchema, noteContentSchema } from '../workout-note'

describe('normalizeTag', () => {
  it('uppercases input', () => {
    expect(normalizeTag('form breakdown')).toBe('FORM BREAKDOWN')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeTag('  pr attempt  ')).toBe('PR ATTEMPT')
  })

  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeTag('felt    heavy')).toBe('FELT HEAVY')
    expect(normalizeTag('low\t\tenergy')).toBe('LOW ENERGY')
    expect(normalizeTag('form\n\nbreakdown')).toBe('FORM BREAKDOWN')
  })

  it('combines trim, collapse, and upper', () => {
    expect(normalizeTag('   felt   light   ')).toBe('FELT LIGHT')
  })
})

describe('STARTER_NOTE_TAGS', () => {
  it('contains the 10 curated starter tags', () => {
    expect(STARTER_NOTE_TAGS).toHaveLength(10)
    expect(STARTER_NOTE_TAGS).toContain('FORM BREAKDOWN')
    expect(STARTER_NOTE_TAGS).toContain('LOW ENERGY')
  })

  it('all starter tags normalize to themselves', () => {
    for (const tag of STARTER_NOTE_TAGS) {
      expect(normalizeTag(tag)).toBe(tag)
    }
  })
})

describe('noteTagSchema', () => {
  it('accepts and normalizes a valid tag', () => {
    const parsed = noteTagSchema.parse('  pr  attempt  ')
    expect(parsed).toBe('PR ATTEMPT')
  })

  it('rejects empty strings', () => {
    expect(noteTagSchema.safeParse('').success).toBe(false)
  })

  it('rejects tags longer than 32 characters', () => {
    const tooLong = 'A'.repeat(33)
    expect(noteTagSchema.safeParse(tooLong).success).toBe(false)
  })

  it('accepts tags at the 32-char boundary', () => {
    const ok = 'A'.repeat(32)
    expect(noteTagSchema.safeParse(ok).success).toBe(true)
  })
})

describe('noteContentSchema', () => {
  it('round-trips text and tags', () => {
    const parsed = noteContentSchema.parse({
      text: 'felt strong today',
      tags: ['pr attempt', 'FAST'],
    })
    expect(parsed.text).toBe('felt strong today')
    expect(parsed.tags).toEqual(['PR ATTEMPT', 'FAST'])
  })

  it('applies defaults for missing fields', () => {
    const parsed = noteContentSchema.parse({})
    expect(parsed.text).toBe('')
    expect(parsed.tags).toEqual([])
  })

  it('rejects more than 16 tags', () => {
    const tags = Array.from({ length: 17 }, (_, i) => `TAG${i}`)
    expect(noteContentSchema.safeParse({ text: '', tags }).success).toBe(false)
  })

  it('accepts exactly 16 tags', () => {
    const tags = Array.from({ length: 16 }, (_, i) => `TAG${i}`)
    expect(noteContentSchema.safeParse({ text: '', tags }).success).toBe(true)
  })
})
