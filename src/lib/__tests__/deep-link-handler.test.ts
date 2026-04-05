// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleConnectLink } from '../deep-link-handler'

const mockToast = vi.fn()
vi.mock('sonner', () => ({ toast: (...args: unknown[]) => mockToast(...args) }))

const mockHasConfig = vi.fn<() => Promise<boolean>>()
const mockGetConfig = vi.fn<() => Promise<{ supabaseUrl: string; supabaseKey: string } | null>>()
vi.mock('@/lib/config-store', () => ({
  getConfigStore: () => ({
    hasConfig: mockHasConfig,
    getConfig: mockGetConfig,
  }),
}))

const mockSetPending = vi.fn()
vi.mock('@/lib/pending-connect', () => ({
  usePendingConnect: {
    getState: () => ({ setPending: mockSetPending }),
  },
}))

describe('handleConnectLink', () => {
  const mockNavigate = vi.fn()

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('toasts "Invalid invite link" for non-connect URL', async () => {
    await handleConnectLink('https://example.com', mockNavigate)
    expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
  })

  it('toasts "Invalid invite link" for missing params', async () => {
    await handleConnectLink('ardentforge://connect', mockNavigate)
    expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
  })

  it('toasts "Invalid invite link" for non-HTTPS url param', async () => {
    await handleConnectLink(
      'ardentforge://connect?url=http%3A%2F%2Fevil.com&key=test-key',
      mockNavigate,
    )
    expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
  })

  it('navigates to /setup with params when unconfigured', async () => {
    mockHasConfig.mockResolvedValue(false)

    await handleConnectLink(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-key',
      mockNavigate,
    )

    expect(mockNavigate).toHaveBeenCalledWith(
      '/setup?url=https%3A%2F%2Fabc.supabase.co&key=test-key',
    )
  })

  it('toasts "Already connected" when same instance', async () => {
    mockHasConfig.mockResolvedValue(true)
    mockGetConfig.mockResolvedValue({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'existing-key',
    })

    await handleConnectLink(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-key',
      mockNavigate,
    )

    expect(mockToast).toHaveBeenCalledWith('Already connected to this server')
  })

  it('sets pending and navigates to /profile for different instance', async () => {
    mockHasConfig.mockResolvedValue(true)
    mockGetConfig.mockResolvedValue({
      supabaseUrl: 'https://other.supabase.co',
      supabaseKey: 'other-key',
    })

    await handleConnectLink(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-key',
      mockNavigate,
    )

    expect(mockSetPending).toHaveBeenCalledWith('https://abc.supabase.co', 'test-key')
    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('sets pending and navigates when config is null despite hasConfig', async () => {
    mockHasConfig.mockResolvedValue(true)
    mockGetConfig.mockResolvedValue(null)

    await handleConnectLink(
      'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-key',
      mockNavigate,
    )

    expect(mockSetPending).toHaveBeenCalledWith('https://abc.supabase.co', 'test-key')
    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })
})
