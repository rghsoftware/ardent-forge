import { describe, it, expect } from 'vitest'

import { parseDisplayUrlInput, buildDisplayUrl, isDevOrigin } from '../display-url'

// ---------------------------------------------------------------------------
// parseDisplayUrlInput
// ---------------------------------------------------------------------------

const VALID_UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('parseDisplayUrlInput', () => {
  describe('full URL shape', () => {
    it('accepts https origin + /display/gym/{uuid}', () => {
      const result = parseDisplayUrlInput(`https://forge.example.com/display/gym/${VALID_UUID}`)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('accepts http origin with port', () => {
      const result = parseDisplayUrlInput(`http://localhost:5173/display/gym/${VALID_UUID}`)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('accepts a preview deployment URL', () => {
      const result = parseDisplayUrlInput(
        `https://ardent-forge-git-foo.vercel.app/display/gym/${VALID_UUID}`,
      )
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })
  })

  describe('path-only shape', () => {
    it('accepts /display/gym/{uuid}', () => {
      const result = parseDisplayUrlInput(`/display/gym/${VALID_UUID}`)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })
  })

  describe('bare UUID', () => {
    it('accepts a bare UUID with no slashes', () => {
      const result = parseDisplayUrlInput(VALID_UUID)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('accepts a bare UUID with surrounding whitespace', () => {
      const result = parseDisplayUrlInput(`   ${OTHER_UUID}   `)
      expect(result).toEqual({ ok: true, gymId: OTHER_UUID })
    })
  })

  describe('normalization', () => {
    it('trims leading and trailing whitespace', () => {
      const result = parseDisplayUrlInput(`  /display/gym/${VALID_UUID}  `)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('strips a trailing slash from a full URL', () => {
      const result = parseDisplayUrlInput(`https://forge.example.com/display/gym/${VALID_UUID}/`)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('strips a trailing slash from a path-only URL', () => {
      const result = parseDisplayUrlInput(`/display/gym/${VALID_UUID}/`)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('strips a query string', () => {
      const result = parseDisplayUrlInput(
        `https://forge.example.com/display/gym/${VALID_UUID}?clock=12h`,
      )
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('strips a fragment', () => {
      const result = parseDisplayUrlInput(`https://forge.example.com/display/gym/${VALID_UUID}#top`)
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })

    it('strips both a query string and a fragment', () => {
      const result = parseDisplayUrlInput(
        `https://forge.example.com/display/gym/${VALID_UUID}?x=1#frag`,
      )
      expect(result).toEqual({ ok: true, gymId: VALID_UUID })
    })
  })

  describe('rejection cases', () => {
    // P15-010 / P15-035: parseDisplayUrlInput returns only two failure
    // reasons -- 'empty' and 'invalid'. The earlier three-variant API
    // (empty / malformed / not-a-uuid) exposed distinctions the UI could
    // not meaningfully surface to users.
    it('rejects empty input', () => {
      expect(parseDisplayUrlInput('')).toEqual({ ok: false, reason: 'empty' })
    })

    it('rejects whitespace-only input', () => {
      expect(parseDisplayUrlInput('   ')).toEqual({ ok: false, reason: 'empty' })
    })

    it('rejects a URL with the wrong path shape', () => {
      const result = parseDisplayUrlInput(`https://forge.example.com/other/path/${VALID_UUID}`)
      expect(result).toEqual({ ok: false, reason: 'invalid' })
    })

    it('rejects a URL without /display/gym prefix', () => {
      const result = parseDisplayUrlInput(`https://forge.example.com/${VALID_UUID}`)
      expect(result).toEqual({ ok: false, reason: 'invalid' })
    })

    it('rejects a full URL with a non-UUID tail', () => {
      const result = parseDisplayUrlInput('https://forge.example.com/display/gym/not-a-uuid')
      expect(result).toEqual({ ok: false, reason: 'invalid' })
    })

    it('rejects a path-only URL with a non-UUID tail', () => {
      const result = parseDisplayUrlInput('/display/gym/not-a-uuid')
      expect(result).toEqual({ ok: false, reason: 'invalid' })
    })

    it('rejects a bare non-UUID token', () => {
      expect(parseDisplayUrlInput('not-a-uuid')).toEqual({ ok: false, reason: 'invalid' })
    })

    it('rejects a javascript: URL', () => {
      expect(parseDisplayUrlInput('javascript:alert(1)')).toEqual({
        ok: false,
        reason: 'invalid',
      })
    })

    it('rejects a URL missing the UUID entirely', () => {
      expect(parseDisplayUrlInput('/display/gym/')).toEqual({ ok: false, reason: 'invalid' })
    })
  })
})

// ---------------------------------------------------------------------------
// buildDisplayUrl
// ---------------------------------------------------------------------------

describe('buildDisplayUrl', () => {
  it('composes the canonical URL from origin + gym id', () => {
    expect(buildDisplayUrl(VALID_UUID, 'https://forge.example.com')).toEqual({
      ok: true,
      url: `https://forge.example.com/display/gym/${VALID_UUID}`,
    })
  })

  it('returns { ok: false, reason: no-origin } when origin is null', () => {
    expect(buildDisplayUrl(VALID_UUID, null)).toEqual({ ok: false, reason: 'no-origin' })
  })

  it('strips a trailing slash from origin', () => {
    expect(buildDisplayUrl(VALID_UUID, 'https://forge.example.com/')).toEqual({
      ok: true,
      url: `https://forge.example.com/display/gym/${VALID_UUID}`,
    })
  })

  it('handles a dev origin with a port', () => {
    expect(buildDisplayUrl(VALID_UUID, 'http://localhost:5173')).toEqual({
      ok: true,
      url: `http://localhost:5173/display/gym/${VALID_UUID}`,
    })
  })
})

// ---------------------------------------------------------------------------
// isDevOrigin
// ---------------------------------------------------------------------------

describe('isDevOrigin', () => {
  it('matches localhost with a port', () => {
    expect(isDevOrigin('http://localhost:5173')).toBe(true)
  })

  it('matches localhost without a port', () => {
    expect(isDevOrigin('http://localhost')).toBe(true)
  })

  it('matches 127.0.0.1 origin', () => {
    expect(isDevOrigin('http://127.0.0.1')).toBe(true)
  })

  it('matches 127.0.0.1 with a port', () => {
    expect(isDevOrigin('http://127.0.0.1:8080')).toBe(true)
  })

  it('matches IPv6 loopback origin', () => {
    expect(isDevOrigin('http://[::1]:3000')).toBe(true)
  })

  it('rejects a production HTTPS origin', () => {
    expect(isDevOrigin('https://ardent-forge.vercel.app')).toBe(false)
  })

  it('rejects a bare production host', () => {
    expect(isDevOrigin('forge.example.com')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isDevOrigin('')).toBe(false)
  })
})
