import { describe, expect, it } from 'vitest'
import { buildDeepLink, buildInviteLink, parseInviteLink } from '../invite-link'

describe('buildDeepLink', () => {
  it('produces ardentforge:// URL format with encoded params', () => {
    const link = buildDeepLink('https://abc.supabase.co', 'eyJhbGciOiJIUzI1NiJ9')
    expect(link).toBe(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=eyJhbGciOiJIUzI1NiJ9',
    )
  })

  it('encodes special characters in params', () => {
    const link = buildDeepLink('https://example.com/path?q=1&r=2', 'key=with+special')
    expect(link).toContain('url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1%26r%3D2')
    expect(link).toContain('key=key%3Dwith%2Bspecial')
  })
})

describe('buildInviteLink', () => {
  it('produces https:// web app URL with encoded params', () => {
    const link = buildInviteLink('https://abc.supabase.co', 'eyJhbGciOiJIUzI1NiJ9')
    expect(link).toBe(
      'https://ardent-forge.vercel.app/connect?url=https%3A%2F%2Fabc.supabase.co&key=eyJhbGciOiJIUzI1NiJ9',
    )
  })

  it('encodes special characters in params', () => {
    const link = buildInviteLink('https://example.com/path?q=1&r=2', 'key=with+special')
    expect(link).toContain('url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1%26r%3D2')
    expect(link).toContain('key=key%3Dwith%2Bspecial')
  })
})

describe('parseInviteLink', () => {
  it('round-trips with buildDeepLink output', () => {
    const url = 'https://abc.supabase.co'
    const key = 'eyJhbGciOiJIUzI1NiJ9'
    const link = buildDeepLink(url, key)
    const parsed = parseInviteLink(link)
    expect(parsed).toEqual({ url, key })
  })

  it('round-trips with buildInviteLink output', () => {
    const url = 'https://abc.supabase.co'
    const key = 'eyJhbGciOiJIUzI1NiJ9'
    const link = buildInviteLink(url, key)
    const parsed = parseInviteLink(link)
    expect(parsed).toEqual({ url, key })
  })

  it('parses https:// web app links', () => {
    const parsed = parseInviteLink(
      'https://ardent-forge.vercel.app/connect?url=https%3A%2F%2Fabc.supabase.co&key=abc123',
    )
    expect(parsed).toEqual({ url: 'https://abc.supabase.co', key: 'abc123' })
  })

  it('parses ardentforge:// deep links', () => {
    const parsed = parseInviteLink(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=abc123',
    )
    expect(parsed).toEqual({ url: 'https://abc.supabase.co', key: 'abc123' })
  })

  it('returns null for empty string', () => {
    expect(parseInviteLink('')).toBeNull()
  })

  it('returns null for random text', () => {
    expect(parseInviteLink('hello world')).toBeNull()
  })

  it('returns null for https:// with wrong path', () => {
    expect(
      parseInviteLink(
        'https://ardent-forge.vercel.app/setup?url=https%3A%2F%2Fabc.supabase.co&key=abc',
      ),
    ).toBeNull()
  })

  it('returns null for missing url param', () => {
    expect(parseInviteLink('ardentforge://connect?key=abc')).toBeNull()
  })

  it('returns null for missing key param', () => {
    expect(parseInviteLink('ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co')).toBeNull()
  })

  it('returns null for wrong protocol (non-ardentforge, non-https)', () => {
    expect(parseInviteLink('not://a://valid://url')).toBeNull()
  })

  it('returns null for genuinely malformed URL', () => {
    expect(parseInviteLink('::bad')).toBeNull()
  })

  it('handles extra whitespace', () => {
    const link = buildDeepLink('https://abc.supabase.co', 'key123')
    const parsed = parseInviteLink(`  ${link}  `)
    expect(parsed).toEqual({ url: 'https://abc.supabase.co', key: 'key123' })
  })

  it('handles trailing newlines', () => {
    const link = buildInviteLink('https://abc.supabase.co', 'key123')
    const parsed = parseInviteLink(`${link}\n`)
    expect(parsed).toEqual({ url: 'https://abc.supabase.co', key: 'key123' })
  })

  it('returns null for empty-valued url param', () => {
    expect(parseInviteLink('ardentforge://connect?url=&key=abc')).toBeNull()
  })

  it('returns null for empty-valued key param', () => {
    expect(
      parseInviteLink('ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key='),
    ).toBeNull()
  })

  it('returns null for wrong deep link host', () => {
    expect(
      parseInviteLink('ardentforge://auth?url=https%3A%2F%2Fabc.supabase.co&key=abc'),
    ).toBeNull()
  })

  it('returns null for non-https supabase url', () => {
    expect(
      parseInviteLink('ardentforge://connect?url=http%3A%2F%2Fabc.supabase.co&key=abc'),
    ).toBeNull()
  })
})
