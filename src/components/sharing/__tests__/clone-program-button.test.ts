import { describe, it, expect } from 'vitest'
import { mapRpcToProgramFull } from '@/lib/share-rpc-mapper'

describe('mapRpcToProgramFull', () => {
  const makeRpcPayload = () => ({
    program: {
      id: 'prog-1',
      name: 'Test Program',
      description: 'A test program',
      source: 'MANUAL',
      duration_weeks: 4,
      is_public: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    blocks: [
      {
        block: {
          id: 'block-1',
          program_id: 'prog-1',
          name: 'Block 1',
          ordinal: 0,
          duration_weeks: 4,
          block_type: 'ACCUMULATION',
        },
        weeks: [
          {
            week: {
              id: 'week-1',
              block_id: 'block-1',
              week_number: 1,
            },
            sessions: [
              {
                id: 'ss-1',
                block_week_id: 'week-1',
                day_of_week: 1,
                day_label: 'Monday',
                session_type: 'STRENGTH',
                session_template_id: null,
                notes: null,
              },
            ],
          },
        ],
      },
    ],
  })

  it('maps a valid RPC payload to ProgramFull shape', () => {
    const result = mapRpcToProgramFull(makeRpcPayload())
    expect(result.program.name).toBe('Test Program')
    expect(result.blocks).toHaveLength(1)
    expect(result.blockWeeks).toHaveLength(1)
    expect(result.scheduledSessions).toHaveLength(1)
    expect(result.scheduledSessions[0].dayLabel).toBe('Monday')
  })

  it('returns ProgramFull with empty arrays when blocks is empty', () => {
    const payload = { ...makeRpcPayload(), blocks: [] }
    const result = mapRpcToProgramFull(payload)
    expect(result.blocks).toHaveLength(0)
    expect(result.blockWeeks).toHaveLength(0)
    expect(result.scheduledSessions).toHaveLength(0)
  })

  it('throws on invalid shape (missing program key)', () => {
    expect(() => mapRpcToProgramFull({})).toThrow(
      'Invalid program data received from share link RPC',
    )
  })

  it('throws on null input', () => {
    expect(() => mapRpcToProgramFull(null)).toThrow(
      'Invalid program data received from share link RPC',
    )
  })
})
