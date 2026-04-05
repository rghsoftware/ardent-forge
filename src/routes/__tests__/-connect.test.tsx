// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render-helpers'

// ---------------------------------------------------------------------------
// Hoisted variables -- available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockNavigate, mockToast, mockHandleConnectLink, capturedComponent, mockSearchParams } =
  vi.hoisted(() => {
    const mockNavigate = vi.fn()
    const mockToast = vi.fn()
    const mockHandleConnectLink = vi.fn().mockResolvedValue(undefined)
    const capturedComponent: { current: React.ComponentType | undefined } = { current: undefined }
    const mockSearchParams: { current: Record<string, string | undefined> } = { current: {} }
    return { mockNavigate, mockToast, mockHandleConnectLink, capturedComponent, mockSearchParams }
  })

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (routeConfig: { component?: React.ComponentType }) => {
    capturedComponent.current = routeConfig.component
    return { ...routeConfig, useSearch: () => mockSearchParams.current }
  },
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({ toast: mockToast }))

vi.mock('@/lib/deep-link-handler', () => ({
  handleConnectLink: (...args: unknown[]) => mockHandleConnectLink(...args),
}))

// Import after mocks are registered -- this triggers createFileRoute, capturing the component
import '../connect'

// ===========================================================================
// Tests
// ===========================================================================

describe('ConnectPage', () => {
  let Component: React.ComponentType

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.current = {}

    const Comp = capturedComponent.current
    if (!Comp) throw new Error('Could not extract ConnectPage from connect module')
    Component = Comp
  })

  it('shows invalid invite link toast when url is missing', async () => {
    mockSearchParams.current = { key: 'x' }

    renderWithProviders(<Component />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/setup' })
  })

  it('shows invalid invite link toast when key is missing', async () => {
    mockSearchParams.current = { url: 'https://abc.supabase.co' }

    renderWithProviders(<Component />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/setup' })
  })

  it('shows invalid invite link toast when both params are missing', async () => {
    mockSearchParams.current = {}

    renderWithProviders(<Component />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/setup' })
  })

  it('calls handleConnectLink with reconstructed URL when params are valid', async () => {
    mockSearchParams.current = { url: 'https://abc.supabase.co', key: 'test-key' }

    renderWithProviders(<Component />)

    await waitFor(() => {
      expect(mockHandleConnectLink).toHaveBeenCalledWith(
        'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-key',
        expect.any(Function),
      )
    })
  })

  it('shows error toast and navigates to /setup when handleConnectLink rejects', async () => {
    mockHandleConnectLink.mockRejectedValueOnce(new Error('boom'))
    mockSearchParams.current = { url: 'https://abc.supabase.co', key: 'test-key' }

    renderWithProviders(<Component />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Something went wrong. Please try again.')
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/setup' })
  })
})
