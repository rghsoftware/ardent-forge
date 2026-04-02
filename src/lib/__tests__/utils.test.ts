import { cn, formatLabel } from '@/lib/utils'

// ===========================================================================
// cn
// ===========================================================================

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('p-4')).toBe('p-4')
  })

  it('merges multiple classes', () => {
    expect(cn('p-4', 'mt-2')).toBe('p-4 mt-2')
  })

  it('strips falsy values from conditional classes', () => {
    const condition = false
    expect(cn('a', condition && 'b', 'c')).toBe('a c')
  })

  it('strips undefined and null values', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('resolves Tailwind conflicts so the last class wins', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('resolves conflicting text colors', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles array input from clsx', () => {
    expect(cn(['a', 'b'])).toBe('a b')
  })

  it('handles object input from clsx', () => {
    expect(cn({ 'p-4': true, 'mt-2': false })).toBe('p-4')
  })
})

// ===========================================================================
// formatLabel
// ===========================================================================

describe('formatLabel', () => {
  it('replaces underscores with spaces', () => {
    expect(formatLabel('FIXED_SETS')).toBe('FIXED SETS')
  })

  it('leaves single-word values unchanged', () => {
    expect(formatLabel('RUNNING')).toBe('RUNNING')
  })

  it('handles multiple underscores', () => {
    expect(formatLabel('SOME_LONG_NAME')).toBe('SOME LONG NAME')
  })

  it('returns empty string for empty input', () => {
    expect(formatLabel('')).toBe('')
  })

  it('leaves lowercase values as-is except underscore replacement', () => {
    expect(formatLabel('loaded_carry')).toBe('loaded carry')
  })
})
