import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// localStorage mock -- node environment does not provide one
// (Pattern matches src/lib/__tests__/config-store.test.ts so we can spy on
// individual methods and force them to throw via mockImplementationOnce.)
// ---------------------------------------------------------------------------

const storage = new Map<string, string>()

const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key)
  }),
  clear: vi.fn(() => {
    storage.clear()
  }),
  get length() {
    return storage.size
  },
  key: vi.fn((index: number) => {
    const keys = Array.from(storage.keys())
    return keys[index] ?? null
  }),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

/** Restore localStorage mock implementations after mockImplementation overrides. */
function restoreLocalStorageMocks() {
  vi.mocked(localStorageMock.getItem).mockImplementation((key: string) => storage.get(key) ?? null)
  vi.mocked(localStorageMock.setItem).mockImplementation((key: string, value: string) => {
    storage.set(key, value)
  })
}

// Import after the mock is wired up
import { KEY, readLastGymChoice, writeLastGymChoice } from '../gym-picker-storage'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gym-picker-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreLocalStorageMocks()
    storage.clear()
  })

  // 1. round-trip a gym UUID
  it('writeLastGymChoice(uuid) followed by readLastGymChoice() returns the uuid', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    writeLastGymChoice(uuid)
    expect(readLastGymChoice()).toBe(uuid)
    // sanity: it actually went through the mock-backed storage under the right key
    expect(storage.get(KEY)).toBe(uuid)
  })

  // 2. round-trip the 'private' literal
  it("writeLastGymChoice('private') followed by readLastGymChoice() returns 'private'", () => {
    writeLastGymChoice('private')
    expect(readLastGymChoice()).toBe('private')
    expect(storage.get(KEY)).toBe('private')
  })

  // 3. empty storage returns null
  it('readLastGymChoice() on empty localStorage returns null', () => {
    expect(readLastGymChoice()).toBeNull()
  })

  // 4. tolerates a thrown error from localStorage.getItem
  it('readLastGymChoice() tolerates a thrown error from localStorage.getItem and returns null', () => {
    vi.mocked(localStorageMock.getItem).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let result: ReturnType<typeof readLastGymChoice> | undefined
    expect(() => {
      result = readLastGymChoice()
    }).not.toThrow()

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[gym-picker]'), expect.any(Error))

    warnSpy.mockRestore()
  })

  // 5. tolerates a thrown error from localStorage.setItem and returns false
  it('writeLastGymChoice() returns false on quota error and does not throw (P14-014)', () => {
    const quotaErr = new DOMException('QuotaExceededError', 'QuotaExceededError')
    vi.mocked(localStorageMock.setItem).mockImplementationOnce(() => {
      throw quotaErr
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Use a valid UUID -- P14-006 boundary validation now rejects garbage
    // strings before localStorage is touched.
    const validUuid = '11111111-2222-4333-8444-555555555555'
    let result: boolean | undefined
    expect(() => {
      result = writeLastGymChoice(validUuid)
    }).not.toThrow()

    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[gym-picker]'),
      expect.any(DOMException),
    )

    warnSpy.mockRestore()
  })
})
