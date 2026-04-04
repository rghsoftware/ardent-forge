import { describe, expect, it } from 'vitest'
import { buildInviteLink, parseInviteLink } from '../invite-link'

describe('buildInviteLink', () => {
  it('produces correct URL format with encoded params', () => {
    const link = buildInviteLink('https://abc.supabase.co', 'eyJhbGciOiJIUzI1NiJ9')
    expect(link).toBe(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=eyJhbGciOiJIUzI1NiJ9',
    )
  })

  it('encodes special characters in params', () => {
    const link = buildInviteLink('https://example.com/path?q=1&r=2', 'key=with+special')
    expect(link).toContain('url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1%26r%3D2')
    expect(link).toContain('key=key%3Dwith%2Bspecial')
  })
})

describe('parseInviteLink', () => {
  it('round-trips with buildInviteLink output', () => {
    const url = 'https://abc.supabase.co'
    const key = 'eyJhbGciOiJIUzI1NiJ9'
    const link = buildInviteLink(url, key)
    const parsed = parseInviteLink(link)
    expect(parsed).toEqual({ url, key })
  })

  it('returns null for empty string', () => {
    expect(parseInviteLink('')).toBeNull()
  })

  it('returns null for random text', () => {
    expect(parseInviteLink('hello world')).toBeNull()
  })

  it('returns null for wrong scheme', () => {
    expect(parseInviteLink('https://connect?url=https%3A%2F%2Fabc.supabase.co&key=abc')).toBeNull()
  })

  it('returns null for missing url param', () => {
    expect(parseInviteLink('ardentforge://connect?key=abc')).toBeNull()
  })

  it('returns null for missing key param', () => {
    expect(parseInviteLink('ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parseInviteLink('not://a://valid://url')).toBeNull()
  })

  it('handles extra whitespace', () => {
    const link = buildInviteLink('https://abc.supabase.co', 'key123')
    const parsed = parseInviteLink(`  ${link}  `)
    expect(parsed).toEqual({ url: 'https://abc.supabase.co', key: 'key123' })
  })

  it('handles trailing newlines', () => {
    const link = buildInviteLink('https://abc.supabase.co', 'key123')
    const parsed = parseInviteLink(`${link}\n`)
    expect(parsed).toEqual({ url: 'https://abc.supabase.co', key: 'key123' })
  })

  it('returns null for wrong host/path', () => {
    expect(
      parseInviteLink('ardentforge://auth?url=https%3A%2F%2Fabc.supabase.co&key=abc'),
    ).toBeNull()
  })
})
