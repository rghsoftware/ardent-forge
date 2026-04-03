import { vi, beforeEach, afterEach } from 'vitest'
import { useBlockedUsersStore } from '@/stores/blocked-users-store'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: () => store,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

// ---------------------------------------------------------------------------
// Reset store + localStorage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  useBlockedUsersStore.setState({
    blockedIds: new Set<string>(),
    currentUserId: '',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// Initial state
// ===========================================================================

describe('initial state', () => {
  it('starts with an empty blockedIds Set', () => {
    const { blockedIds } = useBlockedUsersStore.getState()
    expect(blockedIds).toBeInstanceOf(Set)
    expect(blockedIds.size).toBe(0)
  })

  it('starts with an empty currentUserId', () => {
    expect(useBlockedUsersStore.getState().currentUserId).toBe('')
  })
})

// ===========================================================================
// initialize
// ===========================================================================

describe('initialize', () => {
  it('loads blocked IDs from localStorage for a given user', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      JSON.stringify(['blocked-a', 'blocked-b']),
    )

    useBlockedUsersStore.getState().initialize('user-1')
    const { blockedIds, currentUserId } = useBlockedUsersStore.getState()

    expect(currentUserId).toBe('user-1')
    expect(blockedIds.size).toBe(2)
    expect(blockedIds.has('blocked-a')).toBe(true)
    expect(blockedIds.has('blocked-b')).toBe(true)
  })

  it('sets empty Set when no localStorage data exists', () => {
    useBlockedUsersStore.getState().initialize('user-new')
    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(0)
  })

  it('reloads from localStorage when initialized with a different user', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      JSON.stringify(['a']),
    )
    localStorage.setItem(
      'ardent-forge:blocked-users:user-2',
      JSON.stringify(['x', 'y', 'z']),
    )

    useBlockedUsersStore.getState().initialize('user-1')
    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(1)

    useBlockedUsersStore.getState().initialize('user-2')
    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(3)
    expect(useBlockedUsersStore.getState().currentUserId).toBe('user-2')
  })

  it('is idempotent -- calling with same userId does not reload', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      JSON.stringify(['a']),
    )

    useBlockedUsersStore.getState().initialize('user-1')
    localStorageMock.getItem.mockClear()

    useBlockedUsersStore.getState().initialize('user-1')
    expect(localStorageMock.getItem).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// blockUser
// ===========================================================================

describe('blockUser', () => {
  it('adds a user to the blocked Set and persists to localStorage', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    useBlockedUsersStore.getState().blockUser('target-1')

    const { blockedIds } = useBlockedUsersStore.getState()
    expect(blockedIds.has('target-1')).toBe(true)

    const persisted = JSON.parse(
      localStorage.getItem('ardent-forge:blocked-users:user-1')!,
    )
    expect(persisted).toContain('target-1')
  })

  it('blocking same user twice results in one entry', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    useBlockedUsersStore.getState().blockUser('target-1')
    useBlockedUsersStore.getState().blockUser('target-1')

    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(1)
  })
})

// ===========================================================================
// unblockUser
// ===========================================================================

describe('unblockUser', () => {
  it('removes a user from the blocked Set and persists to localStorage', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    useBlockedUsersStore.getState().blockUser('target-1')
    useBlockedUsersStore.getState().blockUser('target-2')

    useBlockedUsersStore.getState().unblockUser('target-1')

    const { blockedIds } = useBlockedUsersStore.getState()
    expect(blockedIds.has('target-1')).toBe(false)
    expect(blockedIds.has('target-2')).toBe(true)

    const persisted = JSON.parse(
      localStorage.getItem('ardent-forge:blocked-users:user-1')!,
    )
    expect(persisted).not.toContain('target-1')
    expect(persisted).toContain('target-2')
  })

  it('unblocking a non-blocked user causes no error and Set is unchanged', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    useBlockedUsersStore.getState().blockUser('target-1')

    useBlockedUsersStore.getState().unblockUser('non-existent')
    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(1)
    expect(useBlockedUsersStore.getState().blockedIds.has('target-1')).toBe(
      true,
    )
  })
})

// ===========================================================================
// isBlocked
// ===========================================================================

describe('isBlocked', () => {
  it('returns true for a blocked user', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    useBlockedUsersStore.getState().blockUser('target-1')
    expect(useBlockedUsersStore.getState().isBlocked('target-1')).toBe(true)
  })

  it('returns false for a non-blocked user', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    expect(useBlockedUsersStore.getState().isBlocked('target-1')).toBe(false)
  })
})

// ===========================================================================
// localStorage persistence
// ===========================================================================

describe('localStorage persistence', () => {
  it('uses the key format ardent-forge:blocked-users:${userId}', () => {
    useBlockedUsersStore.getState().initialize('user-42')
    useBlockedUsersStore.getState().blockUser('target-1')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'ardent-forge:blocked-users:user-42',
      expect.any(String),
    )
  })

  it('persists across initialize calls -- block then re-initialize', () => {
    useBlockedUsersStore.getState().initialize('user-1')
    useBlockedUsersStore.getState().blockUser('target-1')
    useBlockedUsersStore.getState().blockUser('target-2')

    // Reset store state to simulate fresh load
    useBlockedUsersStore.setState({
      blockedIds: new Set<string>(),
      currentUserId: '',
    })

    useBlockedUsersStore.getState().initialize('user-1')
    const { blockedIds } = useBlockedUsersStore.getState()
    expect(blockedIds.size).toBe(2)
    expect(blockedIds.has('target-1')).toBe(true)
    expect(blockedIds.has('target-2')).toBe(true)
  })
})

// ===========================================================================
// Corruption handling
// ===========================================================================

describe('corruption handling', () => {
  it('returns empty Set for non-array JSON (object)', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      JSON.stringify({ not: 'an array' }),
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useBlockedUsersStore.getState().initialize('user-1')

    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(0)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns empty Set for non-array JSON (string)', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      JSON.stringify('just a string'),
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useBlockedUsersStore.getState().initialize('user-1')

    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(0)
    warnSpy.mockRestore()
  })

  it('returns empty Set for invalid JSON', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      '{not valid json!!!',
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    useBlockedUsersStore.getState().initialize('user-1')

    expect(useBlockedUsersStore.getState().blockedIds.size).toBe(0)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('filters non-string values from array', () => {
    localStorage.setItem(
      'ardent-forge:blocked-users:user-1',
      JSON.stringify(['valid-id', 42, null, true, 'another-valid']),
    )

    useBlockedUsersStore.getState().initialize('user-1')
    const { blockedIds } = useBlockedUsersStore.getState()

    expect(blockedIds.size).toBe(2)
    expect(blockedIds.has('valid-id')).toBe(true)
    expect(blockedIds.has('another-valid')).toBe(true)
  })
})

// ===========================================================================
// Selectors (store shape)
// ===========================================================================

describe('selectors', () => {
  it('exposes all expected keys on the store', () => {
    const state = useBlockedUsersStore.getState()
    expect(state).toHaveProperty('blockedIds')
    expect(state).toHaveProperty('currentUserId')
    expect(state).toHaveProperty('initialize')
    expect(state).toHaveProperty('blockUser')
    expect(state).toHaveProperty('unblockUser')
    expect(state).toHaveProperty('isBlocked')
  })

  it('all actions are functions', () => {
    const state = useBlockedUsersStore.getState()
    expect(typeof state.initialize).toBe('function')
    expect(typeof state.blockUser).toBe('function')
    expect(typeof state.unblockUser).toBe('function')
    expect(typeof state.isBlocked).toBe('function')
  })
})
