import { describe, it, expect } from 'vitest'
import { camelizeKeys, parseJsonOrValue } from '../adapter-utils'

// ===========================================================================
// camelizeKeys
// ===========================================================================

describe('camelizeKeys', () => {
  it('converts standard snake_case keys to camelCase', () => {
    expect(camelizeKeys({ created_at: 'x' })).toEqual({ createdAt: 'x' })
  })

  it('passes through already-camelCase keys unchanged', () => {
    expect(camelizeKeys({ createdAt: 'x' })).toEqual({ createdAt: 'x' })
  })

  it('converts multiple underscores (foo_bar_baz)', () => {
    expect(camelizeKeys({ foo_bar_baz: 1 })).toEqual({ fooBarBaz: 1 })
  })

  it('transforms leading underscore because regex /_([a-z])/g matches _p in _private', () => {
    // The regex /_([a-z])/g matches the `_p` in `_private`, turning it into `Private`
    expect(camelizeKeys({ _private: 'x' })).toEqual({ Private: 'x' })
  })

  it('does not transform underscores adjacent to digits', () => {
    // known limitation: underscores adjacent to digits are not transformed
    // /_([a-z])/g does not match `_1` because `1` is not [a-z]
    expect(camelizeKeys({ supports_1rm: true })).toEqual({ supports_1rm: true })
  })

  it('does not deep-transform nested object values', () => {
    // Only top-level keys are converted; nested keys are left as-is
    expect(camelizeKeys({ foo_bar: { nested_key: 1 } })).toEqual({
      fooBar: { nested_key: 1 },
    })
  })

  it('returns an empty object unchanged', () => {
    expect(camelizeKeys({})).toEqual({})
  })
})

// ===========================================================================
// parseJsonOrValue
// ===========================================================================

describe('parseJsonOrValue', () => {
  it('parses a valid JSON string into an object', () => {
    expect(parseJsonOrValue('{"a":1}', 'col')).toEqual({ a: 1 })
  })

  it('returns a pre-parsed object unchanged (passthrough)', () => {
    const obj = { foo: 'bar' }
    expect(parseJsonOrValue(obj, 'col')).toEqual(obj)
  })

  it('returns an array input unchanged (not a string)', () => {
    const arr = [1, 2, 3]
    expect(parseJsonOrValue(arr as unknown as object, 'col')).toEqual(arr)
  })

  it('throws an error on malformed JSON whose message contains the column name', () => {
    expect(() => parseJsonOrValue('{bad json}', 'overrides')).toThrow(/overrides/)
  })

  it('throws an error on malformed JSON whose message contains the raw value', () => {
    expect(() => parseJsonOrValue('{bad json}', 'overrides')).toThrow(/\{bad json\}/)
  })
})
