import { describe, expect, it } from 'vitest'
import { formatTypingText } from '../chat-utils'

describe('formatTypingText', () => {
  it('returns empty string when no users are typing', () => {
    expect(formatTypingText([])).toBe('')
  })

  it('returns "[Name] is typing" for a single user', () => {
    expect(
      formatTypingText([{ userId: 'u1', userName: 'Alice' }]),
    ).toBe('Alice is typing')
  })

  it('returns "[Name1] and [Name2] are typing" for two users', () => {
    expect(
      formatTypingText([
        { userId: 'u1', userName: 'Alice' },
        { userId: 'u2', userName: 'Bob' },
      ]),
    ).toBe('Alice and Bob are typing')
  })

  it('returns "[N] people are typing" for three or more users', () => {
    expect(
      formatTypingText([
        { userId: 'u1', userName: 'Alice' },
        { userId: 'u2', userName: 'Bob' },
        { userId: 'u3', userName: 'Charlie' },
      ]),
    ).toBe('3 people are typing')
  })

  it('returns "[N] people are typing" for four users', () => {
    expect(
      formatTypingText([
        { userId: 'u1', userName: 'Alice' },
        { userId: 'u2', userName: 'Bob' },
        { userId: 'u3', userName: 'Charlie' },
        { userId: 'u4', userName: 'Diana' },
      ]),
    ).toBe('4 people are typing')
  })
})
