import { GYM_CHANNEL_PREFIX, getGymChannelName, parseGymIdFromChannel } from '@/lib/gym-channel'

// ===========================================================================
// GYM_CHANNEL_PREFIX
// ===========================================================================

describe('GYM_CHANNEL_PREFIX', () => {
  it('is the literal "display:gym:"', () => {
    expect(GYM_CHANNEL_PREFIX).toBe('display:gym:')
  })
})

// ===========================================================================
// getGymChannelName
// ===========================================================================

describe('getGymChannelName', () => {
  it('prefixes the gym id with "display:gym:"', () => {
    expect(getGymChannelName('abc-123')).toBe('display:gym:abc-123')
  })
})

// ===========================================================================
// parseGymIdFromChannel
// ===========================================================================

describe('parseGymIdFromChannel', () => {
  it('round-trips with getGymChannelName for any non-empty string', () => {
    const id = 'any-uuid-string'
    expect(parseGymIdFromChannel(getGymChannelName(id))).toBe(id)
  })

  it('returns null when the channel name does not start with the prefix', () => {
    expect(parseGymIdFromChannel('something-else')).toBeNull()
  })

  it('returns null for the wrong prefix "display:"', () => {
    expect(parseGymIdFromChannel('display:')).toBeNull()
  })

  it('returns null when the gym id segment is empty', () => {
    expect(parseGymIdFromChannel('display:gym:')).toBeNull()
  })
})
