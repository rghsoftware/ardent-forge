// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMockSupabaseClient } from '@/test/mocks/supabase-client'

// ---------------------------------------------------------------------------
// Hoisted variables -- available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockNavigate, capturedComponent } = vi.hoisted(() => {
  const mockNavigate = vi.fn()
  const capturedComponent: { current: React.ComponentType | undefined } = { current: undefined }
  return { mockNavigate, capturedComponent }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (routeConfig: { component?: React.ComponentType }) => {
    capturedComponent.current = routeConfig.component
    return routeConfig
  },
  useNavigate: () => mockNavigate,
}))

const mockClient = createMockSupabaseClient()

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockClient,
}))

// Import after mocks are registered -- this triggers createFileRoute, capturing the component
import '../callback'

// ===========================================================================
// Tests
// ===========================================================================

describe('AuthCallbackPage', () => {
  let Component: React.ComponentType

  beforeEach(() => {
    vi.clearAllMocks()

    const Comp = capturedComponent.current
    if (!Comp) throw new Error('Could not extract AuthCallbackPage from callback module')
    Component = Comp

    // Default: window.location.search has no params
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '' },
    })
  })

  it('navigates to / when code is present and exchange succeeds', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?code=valid-auth-code' },
    })

    mockClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: {}, user: {} },
      error: null,
    })

    render(<Component />)

    await waitFor(() => {
      expect(mockClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-auth-code')
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('navigates to /sign-in?reason=oauth_error when exchange returns an error', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?code=bad-code' },
    })

    mockClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid code' },
    })

    render(<Component />)

    await waitFor(() => {
      expect(mockClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('bad-code')
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { reason: 'oauth_error' },
      })
    })
  })

  it('navigates to /sign-in?reason=oauth_error without calling exchange when no code in URL', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '' },
    })

    render(<Component />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { reason: 'oauth_error' },
      })
    })

    expect(mockClient.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('navigates to /sign-in?reason=oauth_error when exchange throws an exception', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?code=crash-code' },
    })

    mockClient.auth.exchangeCodeForSession.mockRejectedValueOnce(new Error('Network failure'))

    render(<Component />)

    await waitFor(() => {
      expect(mockClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('crash-code')
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { reason: 'oauth_error' },
      })
    })
  })
})
