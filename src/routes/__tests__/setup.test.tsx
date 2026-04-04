// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'

// ---------------------------------------------------------------------------
// Hoisted variables -- available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockNavigate, mockToast, mockValidateConnection, mockSetConfig, capturedComponent } =
  vi.hoisted(() => {
    const mockNavigate = vi.fn()
    const mockToast = vi.fn()
    const mockValidateConnection = vi.fn()
    const mockSetConfig = vi.fn().mockResolvedValue(undefined)
    const capturedComponent: { current: React.ComponentType | undefined } = { current: undefined }
    return { mockNavigate, mockToast, mockValidateConnection, mockSetConfig, capturedComponent }
  })

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (routeConfig: { component?: React.ComponentType }) => {
    capturedComponent.current = routeConfig.component
    return routeConfig
  },
  useRouter: () => ({ navigate: mockNavigate }),
  redirect: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
}))

vi.mock('@/lib/config-store', () => ({
  getConfigStore: () => ({
    hasConfig: vi.fn().mockResolvedValue(false),
    setConfig: mockSetConfig,
  }),
}))

vi.mock('@/lib/connection-validator', () => ({
  validateConnection: mockValidateConnection,
}))

vi.mock('@/lib/supabase', () => ({
  initSupabaseFromConfig: vi.fn(),
}))

vi.mock('@/lib/discovery', () => ({
  discoverInstance: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: mockToast,
}))

// Import after mocks are registered -- this triggers createFileRoute, capturing the component
import '../setup'

// ===========================================================================
// Tests
// ===========================================================================

describe('SetupPage - processInviteLink', () => {
  let Component: React.ComponentType

  beforeEach(() => {
    vi.clearAllMocks()

    const Comp = capturedComponent.current
    if (!Comp) throw new Error('Could not extract SetupPage from setup module')
    Component = Comp
  })

  it('does not show paste field until QR button is clicked', async () => {
    renderWithProviders(<Component />)

    // Paste input should not exist initially (the button with same label always exists)
    expect(screen.queryByRole('textbox', { name: 'Paste invite link' })).not.toBeInTheDocument()

    // Click QR button (labeled "Paste invite link" in browser mode)
    const qrButton = screen.getByRole('button', { name: 'Paste invite link' })
    await userEvent.click(qrButton)

    // Now the paste input should appear
    expect(screen.getByRole('textbox', { name: 'Paste invite link' })).toBeInTheDocument()
  })

  it('shows invalid invite link toast for garbage input via paste', async () => {
    renderWithProviders(<Component />)

    // Open paste field
    const qrButton = screen.getByRole('button', { name: 'Paste invite link' })
    await userEvent.click(qrButton)

    const pasteInput = screen.getByRole('textbox', { name: 'Paste invite link' })

    // Simulate paste with invalid content
    const clipboardData = new DataTransfer()
    clipboardData.setData('text', 'not-a-valid-link')
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true,
    })
    pasteInput.dispatchEvent(pasteEvent)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
    })
  })

  it('shows invalid invite link toast on Enter with invalid input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Component />)

    // Open paste field
    const qrButton = screen.getByRole('button', { name: 'Paste invite link' })
    await user.click(qrButton)

    const pasteInput = screen.getByRole('textbox', { name: 'Paste invite link' })

    // Type garbage and press Enter
    await user.type(pasteInput, 'garbage-text{Enter}')

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Invalid invite link')
    })
  })

  it('pre-populates fields and triggers validation on valid invite link paste', async () => {
    mockValidateConnection.mockResolvedValueOnce({ status: 'ok' })

    renderWithProviders(<Component />)

    // Open paste field
    const qrButton = screen.getByRole('button', { name: 'Paste invite link' })
    await userEvent.click(qrButton)

    const pasteInput = screen.getByRole('textbox', { name: 'Paste invite link' })

    // Simulate paste with valid invite link
    const validLink = 'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-key-123'
    const clipboardData = new DataTransfer()
    clipboardData.setData('text', validLink)
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true,
    })
    pasteInput.dispatchEvent(pasteEvent)

    await waitFor(() => {
      expect(mockValidateConnection).toHaveBeenCalledWith('https://abc.supabase.co', 'test-key-123')
    })
  })
})
