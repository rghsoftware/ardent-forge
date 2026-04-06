// @vitest-environment happy-dom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render-helpers'
import { BackendSettings } from '@/components/profile/backend-settings'

// --- Mocks ---

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}))

const mockGetConfig = vi.fn()

vi.mock('@/lib/config-store', () => ({
  getConfigStore: () => ({
    getConfig: mockGetConfig,
    setConfig: vi.fn().mockResolvedValue(undefined),
    hasConfig: vi.fn().mockResolvedValue(false),
  }),
}))

vi.mock('@/lib/connection-validator', () => ({
  validateConnection: vi.fn().mockResolvedValue({ status: 'ok' }),
}))

vi.mock('@/lib/supabase', () => ({
  resetSupabaseClient: vi.fn(),
  initSupabaseFromConfig: vi.fn(),
}))

vi.mock('@/lib/adapter', () => ({
  resetAdapter: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}))

const mockToast = vi.fn()
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: Record<string, unknown>) => (
    <div data-testid="qr-code" data-value={props.value as string} />
  ),
}))

// --- Helpers ---

const VALID_CONFIG = {
  supabaseUrl: 'https://abc.supabase.co',
  supabaseKey: 'test-anon-key',
}

const EXPECTED_DEEP_LINK =
  'ardentforge://connect?url=https%3A%2F%2Fabc.supabase.co&key=test-anon-key'
const EXPECTED_INVITE_LINK =
  'https://app.ardentforge.app/connect?url=https%3A%2F%2Fabc.supabase.co&key=test-anon-key'

// --- Tests ---

describe('BackendSettings - Share this server', () => {
  let writeTextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    writeTextSpy = vi.spyOn(window.navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  })

  afterEach(() => {
    writeTextSpy.mockRestore()
  })

  it('renders QR code and share section when config is present', async () => {
    mockGetConfig.mockResolvedValue(VALID_CONFIG)

    renderWithProviders(<BackendSettings />)

    const shareBtn = await screen.findByText('Share this server')
    fireEvent.click(shareBtn)

    const qr = await screen.findByTestId('qr-code')
    expect(qr).toBeInTheDocument()
    expect(qr.getAttribute('data-value')).toBe(EXPECTED_DEEP_LINK)
  })

  it('does not render share section when config is null', async () => {
    mockGetConfig.mockResolvedValue(null)

    renderWithProviders(<BackendSettings />)

    // Wait for the component to settle by checking it rendered the change-backend button
    await waitFor(() => {
      expect(screen.getByText('Change backend')).toBeInTheDocument()
    })

    expect(screen.queryByText('Share this server')).not.toBeInTheDocument()
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument()
  })

  it('copy invite link button copies correct link to clipboard and shows toast', async () => {
    mockGetConfig.mockResolvedValue(VALID_CONFIG)

    renderWithProviders(<BackendSettings />)

    const shareBtn = await screen.findByText('Share this server')
    fireEvent.click(shareBtn)

    const copyBtn = await screen.findByText('Copy invite link')
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Invite link copied')
    })
    expect(writeTextSpy).toHaveBeenCalledWith(EXPECTED_INVITE_LINK)
  })

  it('shows error toast when clipboard write fails', async () => {
    mockGetConfig.mockResolvedValue(VALID_CONFIG)
    writeTextSpy.mockRejectedValue(new Error('Clipboard denied'))

    renderWithProviders(<BackendSettings />)

    const shareBtn = await screen.findByText('Share this server')
    fireEvent.click(shareBtn)

    const copyBtn = await screen.findByText('Copy invite link')
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to copy invite link')
    })
  })
})
