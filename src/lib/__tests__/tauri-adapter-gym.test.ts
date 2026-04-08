import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TauriAdapter, OnlineRequiredError } from '../tauri-adapter'

// ===========================================================================
// F018 (S011-T) -- Tauri adapter gym method stub tests.
//
// Per Tech.md D14, gyms are an online-only concept; the Tauri adapter does
// NOT have local SQLite tables for them. Read methods return empty
// collections (so offline UI renders gracefully) and log a warn so callers
// can distinguish "no gyms exist" from "offline-mode stub returned empty."
// Write methods throw `OnlineRequiredError` (P14-003) so mutation hooks can
// `instanceof`-check and surface a contextual "Offline mode" banner.
//
// These tests assert exactly that contract -- no `invoke` should be called
// for any gym operation, since none of them touch native Rust commands.
// ===========================================================================

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

let adapter: TauriAdapter

beforeEach(() => {
  mockInvoke.mockReset()
  adapter = new TauriAdapter('user-001')
})

// ---------------------------------------------------------------------------
// Read methods -- empty-collection sentinels
// ---------------------------------------------------------------------------

describe('Gym read methods (offline-empty sentinels)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('listUserGyms returns an empty array and warns', async () => {
    const result = await adapter.listUserGyms('user-001')
    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('listUserGyms called in offline mode'),
    )
  })

  it('listAllGyms returns an empty array and warns', async () => {
    const result = await adapter.listAllGyms()
    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('listAllGyms called in offline mode'),
    )
  })

  it('getGym returns null and warns', async () => {
    const result = await adapter.getGym('gym-001')
    expect(result).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('getGym called in offline mode'))
  })

  it('listGymMembers returns an empty array and warns', async () => {
    const result = await adapter.listGymMembers('gym-001')
    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('listGymMembers called in offline mode'),
    )
  })
})

// ---------------------------------------------------------------------------
// Write methods -- "online required" errors
// ---------------------------------------------------------------------------

describe('Gym write methods (OnlineRequiredError)', () => {
  async function expectOnlineRequired(promise: Promise<unknown>, operation: string): Promise<void> {
    try {
      await promise
      throw new Error('Expected OnlineRequiredError to be thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(OnlineRequiredError)
      expect((err as OnlineRequiredError).code).toBe('ONLINE_REQUIRED')
      expect((err as OnlineRequiredError).operation).toBe(operation)
    }
  }

  it('createGym throws OnlineRequiredError', async () => {
    await expectOnlineRequired(adapter.createGym({ name: 'Garage' }), 'createGym')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('updateGym throws OnlineRequiredError', async () => {
    await expectOnlineRequired(adapter.updateGym({ id: 'gym-001', name: 'Renamed' }), 'updateGym')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('deleteGym throws OnlineRequiredError', async () => {
    await expectOnlineRequired(adapter.deleteGym('gym-001'), 'deleteGym')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('joinGym throws OnlineRequiredError', async () => {
    await expectOnlineRequired(adapter.joinGym('gym-001'), 'joinGym')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('leaveGym throws OnlineRequiredError', async () => {
    await expectOnlineRequired(adapter.leaveGym('gym-001'), 'leaveGym')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('kickGymMember throws OnlineRequiredError', async () => {
    await expectOnlineRequired(adapter.kickGymMember('gym-001', 'user-007'), 'kickGymMember')
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
