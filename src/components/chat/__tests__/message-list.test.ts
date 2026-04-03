import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deriveItems, type MessageListItem } from '../message-list'
import type { Message } from '@/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0

function makeMessage(overrides: Partial<Message> = {}): Message {
  counter += 1
  return {
    id: `msg-${counter}`,
    createdAt: '2026-04-01T12:00:00.000Z',
    conversationId: 'conv-1',
    senderId: 'user-a',
    messageType: 'text',
    content: `message ${counter}`,
    ...overrides,
  }
}

beforeEach(() => {
  counter = 0
})

// ---------------------------------------------------------------------------
// We need to control "now" for TODAY / YESTERDAY label tests
// ---------------------------------------------------------------------------

function fakeNow(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// 1. Empty input
// ---------------------------------------------------------------------------

describe('deriveItems', () => {
  it('returns an empty array for empty input', () => {
    const result = deriveItems([], new Set(), 'group')
    expect(result).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 2. Date separator insertion
  // -------------------------------------------------------------------------

  describe('date separator insertion', () => {
    it('inserts a date separator before the first message', () => {
      const msgs = [makeMessage({ createdAt: '2026-04-01T10:00:00.000Z' })]
      const items = deriveItems(msgs, new Set(), 'group')

      expect(items[0]).toMatchObject({ type: 'date-separator' })
      expect(items[1]).toMatchObject({ type: 'message' })
    })

    it('inserts a date separator between messages on different days', () => {
      const msgs = [
        makeMessage({ createdAt: '2026-04-01T12:00:00.000Z' }),
        makeMessage({ createdAt: '2026-04-03T12:00:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const dateSeparators = items.filter((i) => i.type === 'date-separator')
      expect(dateSeparators).toHaveLength(2)
    })

    it('does not insert an extra date separator for messages on the same day', () => {
      const msgs = [
        makeMessage({ createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ createdAt: '2026-04-01T10:01:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const dateSeparators = items.filter((i) => i.type === 'date-separator')
      expect(dateSeparators).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // 3. Date label formatting
  // -------------------------------------------------------------------------

  describe('date label formatting', () => {
    it('labels today as "TODAY"', () => {
      fakeNow('2026-04-03T18:00:00.000Z')

      const msgs = [makeMessage({ createdAt: '2026-04-03T10:00:00.000Z' })]
      const items = deriveItems(msgs, new Set(), 'group')
      const sep = items.find((i) => i.type === 'date-separator') as Extract<
        MessageListItem,
        { type: 'date-separator' }
      >

      expect(sep.date).toBe('TODAY')
    })

    it('labels yesterday as "YESTERDAY"', () => {
      fakeNow('2026-04-03T18:00:00.000Z')

      const msgs = [makeMessage({ createdAt: '2026-04-02T10:00:00.000Z' })]
      const items = deriveItems(msgs, new Set(), 'group')
      const sep = items.find((i) => i.type === 'date-separator') as Extract<
        MessageListItem,
        { type: 'date-separator' }
      >

      expect(sep.date).toBe('YESTERDAY')
    })

    it('labels older dates with weekday, month, day in uppercase', () => {
      fakeNow('2026-04-03T18:00:00.000Z')

      const msgs = [makeMessage({ createdAt: '2026-03-30T10:00:00.000Z' })]
      const items = deriveItems(msgs, new Set(), 'group')
      const sep = items.find((i) => i.type === 'date-separator') as Extract<
        MessageListItem,
        { type: 'date-separator' }
      >

      // Should be an uppercase string like "MONDAY, MARCH 30"
      expect(sep.date).not.toBe('TODAY')
      expect(sep.date).not.toBe('YESTERDAY')
      expect(sep.date).toBe(sep.date.toUpperCase())
      expect(sep.date).toContain('MARCH')
      expect(sep.date).toContain('30')
    })
  })

  // -------------------------------------------------------------------------
  // 4. Timestamp cluster insertion (gap > 5 minutes)
  // -------------------------------------------------------------------------

  describe('timestamp cluster insertion', () => {
    it('inserts a timestamp item when gap > 5 minutes', () => {
      const msgs = [
        makeMessage({ createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ createdAt: '2026-04-01T10:06:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const timestamps = items.filter((i) => i.type === 'timestamp')
      expect(timestamps).toHaveLength(1)
    })

    // -----------------------------------------------------------------------
    // 5. No timestamp when gap <= 5 minutes
    // -----------------------------------------------------------------------

    it('does not insert a timestamp when gap <= 5 minutes', () => {
      const msgs = [
        makeMessage({ createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ createdAt: '2026-04-01T10:05:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const timestamps = items.filter((i) => i.type === 'timestamp')
      expect(timestamps).toHaveLength(0)
    })

    it('does not insert a timestamp for exactly 5-minute gap', () => {
      const msgs = [
        makeMessage({ createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ createdAt: '2026-04-01T10:05:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const timestamps = items.filter((i) => i.type === 'timestamp')
      expect(timestamps).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Blocked user filtering
  // -------------------------------------------------------------------------

  describe('blocked user filtering', () => {
    it('excludes messages from blocked senderIds', () => {
      const msgs = [
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ senderId: 'user-blocked', createdAt: '2026-04-01T10:01:00.000Z' }),
        makeMessage({ senderId: 'user-b', createdAt: '2026-04-01T10:02:00.000Z' }),
      ]
      const blocked = new Set(['user-blocked'])
      const items = deriveItems(msgs, blocked, 'group')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]
      expect(messageItems).toHaveLength(2)
      expect(messageItems.every((i) => i.message.senderId !== 'user-blocked')).toBe(true)
    })

    it('keeps messages with no senderId even if blocked set is non-empty', () => {
      const msgs = [
        makeMessage({
          senderId: undefined,
          messageType: 'system',
          createdAt: '2026-04-01T10:00:00.000Z',
        }),
      ]
      const blocked = new Set(['user-blocked'])
      const items = deriveItems(msgs, blocked, 'group')

      const messageItems = items.filter((i) => i.type === 'message')
      expect(messageItems).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // 7. showSender logic (group)
  // -------------------------------------------------------------------------

  describe('showSender logic (group)', () => {
    it('sets showSender = true for first message after sender change', () => {
      const msgs = [
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ senderId: 'user-b', createdAt: '2026-04-01T10:01:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]

      // Both should show sender since each is a new sender
      expect(messageItems[0]!.showSender).toBe(true)
      expect(messageItems[1]!.showSender).toBe(true)
    })

    it('sets showSender = false for consecutive messages from same sender', () => {
      const msgs = [
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:01:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]

      expect(messageItems[0]!.showSender).toBe(true)
      expect(messageItems[1]!.showSender).toBe(false)
    })

    it('sets showSender = true after a time gap resets sender tracking', () => {
      const msgs = [
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:06:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]

      // After a > 5 min gap, prevSenderId is reset to null, so showSender = true
      expect(messageItems[0]!.showSender).toBe(true)
      expect(messageItems[1]!.showSender).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 8. showSender logic (direct)
  // -------------------------------------------------------------------------

  describe('showSender logic (direct)', () => {
    it('always sets showSender = false regardless of sender changes', () => {
      const msgs = [
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:00:00.000Z' }),
        makeMessage({ senderId: 'user-b', createdAt: '2026-04-01T10:01:00.000Z' }),
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T10:02:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'direct')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]

      for (const item of messageItems) {
        expect(item.showSender).toBe(false)
      }
    })
  })

  // -------------------------------------------------------------------------
  // 9. System messages
  // -------------------------------------------------------------------------

  describe('system messages', () => {
    it('sets showSender = false for system messages in group conversations', () => {
      const msgs = [
        makeMessage({
          senderId: 'user-a',
          messageType: 'system',
          createdAt: '2026-04-01T10:00:00.000Z',
        }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]

      expect(messageItems[0]!.showSender).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 10. Date separator resets sender tracking
  // -------------------------------------------------------------------------

  describe('date separator resets sender tracking', () => {
    it('sets showSender = true after a day boundary even for same sender', () => {
      const msgs = [
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-01T12:00:00.000Z' }),
        makeMessage({ senderId: 'user-a', createdAt: '2026-04-02T12:00:00.000Z' }),
      ]
      const items = deriveItems(msgs, new Set(), 'group')

      const messageItems = items.filter((i) => i.type === 'message') as Extract<
        MessageListItem,
        { type: 'message' }
      >[]

      // Both should show sender -- first is naturally first, second is after day boundary reset
      expect(messageItems[0]!.showSender).toBe(true)
      expect(messageItems[1]!.showSender).toBe(true)
    })
  })
})
