import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TauriAdapter } from '../tauri-adapter'

// ===========================================================================
// F018 (S011-T) -- Tauri adapter gym method stub tests.
//
// Per Tech.md D14, gyms are an online-only concept; the Tauri adapter does
// NOT have local SQLite tables for them. Read methods return empty
// collections (so offline UI renders gracefully). Write methods throw a
// clear "Gyms require an online connection" error so the user knows why
// their action did not take effect.
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
  it('listUserGyms returns an empty array', async () => {
    const result = await adapter.listUserGyms('user-001')
    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('listAllGyms returns an empty array', async () => {
    const result = await adapter.listAllGyms()
    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('getGym returns null', async () => {
    const result = await adapter.getGym('gym-001')
    expect(result).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('listGymMembers returns an empty array', async () => {
    const result = await adapter.listGymMembers('gym-001')
    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Write methods -- "online required" errors
// ---------------------------------------------------------------------------

describe('Gym write methods (online-required errors)', () => {
  const expectedMessage = 'Gyms require an online connection'

  it('createGym throws online-required error', async () => {
    await expect(adapter.createGym({ name: 'Garage' })).rejects.toThrow(expectedMessage)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('updateGym throws online-required error', async () => {
    await expect(adapter.updateGym({ id: 'gym-001', name: 'Renamed' })).rejects.toThrow(
      expectedMessage,
    )
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('deleteGym throws online-required error', async () => {
    await expect(adapter.deleteGym('gym-001')).rejects.toThrow(expectedMessage)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('joinGym throws online-required error', async () => {
    await expect(adapter.joinGym('gym-001')).rejects.toThrow(expectedMessage)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('leaveGym throws online-required error', async () => {
    await expect(adapter.leaveGym('gym-001')).rejects.toThrow(expectedMessage)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('kickGymMember throws online-required error', async () => {
    await expect(adapter.kickGymMember('gym-001', 'user-007')).rejects.toThrow(expectedMessage)
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
