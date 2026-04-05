import {
  conversationSchema,
  conversationParticipantSchema,
  messageSchema,
  mediaAttachmentSchema,
} from '@/domain/types'

const baseConversation = {
  id: 'conv-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  type: 'direct',
  participantUserIds: [],
}

const baseParticipant = {
  id: 'cp-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  conversationId: 'conv-1',
  userId: 'user-1',
  isArchived: false,
  joinedAt: '2025-01-01T00:00:00Z',
}

const baseMessage = {
  id: 'msg-1',
  createdAt: '2025-01-01T00:00:00Z',
  conversationId: 'conv-1',
  senderId: 'user-1',
  messageType: 'text',
  content: 'Hello',
}

const baseMediaAttachment = {
  id: 'ma-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  messageId: 'msg-1',
  provider: 'supabase_storage',
  mediaType: 'image',
  status: 'ready',
}

describe('Direct conversations cannot have a groupId', () => {
  it('accepts a direct conversation without groupId', () => {
    expect(conversationSchema.safeParse(baseConversation).success).toBe(true)
  })
  it('rejects a direct conversation with groupId', () => {
    expect(conversationSchema.safeParse({ ...baseConversation, groupId: 'group-1' }).success).toBe(
      false,
    )
  })
  it('accepts a group conversation with groupId', () => {
    expect(
      conversationSchema.safeParse({ ...baseConversation, type: 'group', groupId: 'group-1' })
        .success,
    ).toBe(true)
  })
  it('accepts a group conversation without groupId', () => {
    expect(conversationSchema.safeParse({ ...baseConversation, type: 'group' }).success).toBe(true)
  })
})

describe('leftAt must be after joinedAt', () => {
  it('accepts an active participant (no leftAt)', () => {
    expect(conversationParticipantSchema.safeParse(baseParticipant).success).toBe(true)
  })
  it('accepts leftAt after joinedAt', () => {
    expect(
      conversationParticipantSchema.safeParse({
        ...baseParticipant,
        leftAt: '2025-06-01T00:00:00Z',
      }).success,
    ).toBe(true)
  })
  it('rejects leftAt before joinedAt', () => {
    expect(
      conversationParticipantSchema.safeParse({
        ...baseParticipant,
        leftAt: '2024-06-01T00:00:00Z',
      }).success,
    ).toBe(false)
  })
  it('rejects leftAt equal to joinedAt', () => {
    expect(
      conversationParticipantSchema.safeParse({
        ...baseParticipant,
        leftAt: '2025-01-01T00:00:00Z',
      }).success,
    ).toBe(false)
  })
})

describe('System messages cannot have a senderId', () => {
  it('accepts a text message with senderId', () => {
    expect(messageSchema.safeParse(baseMessage).success).toBe(true)
  })
  it('accepts a system message without senderId', () => {
    expect(
      messageSchema.safeParse({
        ...baseMessage,
        messageType: 'system',
        senderId: undefined,
      }).success,
    ).toBe(true)
  })
  it('rejects a system message with senderId', () => {
    expect(messageSchema.safeParse({ ...baseMessage, messageType: 'system' }).success).toBe(false)
  })
  it('accepts a text message without senderId', () => {
    expect(messageSchema.safeParse({ ...baseMessage, senderId: undefined }).success).toBe(true)
  })
})

describe('mediaAttachment numeric constraints', () => {
  it('accepts valid attachment with positive duration and fileSize', () => {
    expect(
      mediaAttachmentSchema.safeParse({
        ...baseMediaAttachment,
        durationSeconds: 120,
        fileSizeBytes: 1024,
      }).success,
    ).toBe(true)
  })
  it('accepts zero duration', () => {
    expect(
      mediaAttachmentSchema.safeParse({ ...baseMediaAttachment, durationSeconds: 0 }).success,
    ).toBe(true)
  })
  it('accepts zero fileSize', () => {
    expect(
      mediaAttachmentSchema.safeParse({ ...baseMediaAttachment, fileSizeBytes: 0 }).success,
    ).toBe(true)
  })
  it('rejects negative duration', () => {
    expect(
      mediaAttachmentSchema.safeParse({ ...baseMediaAttachment, durationSeconds: -1 }).success,
    ).toBe(false)
  })
  it('rejects negative fileSize', () => {
    expect(
      mediaAttachmentSchema.safeParse({ ...baseMediaAttachment, fileSizeBytes: -1 }).success,
    ).toBe(false)
  })
  it('accepts omitted duration and fileSize', () => {
    expect(mediaAttachmentSchema.safeParse(baseMediaAttachment).success).toBe(true)
  })
})
