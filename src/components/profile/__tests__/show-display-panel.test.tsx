// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Hoisted test doubles (accessed inside vi.mock factories)
// ---------------------------------------------------------------------------

const { isTauriMock, mockCopyToClipboard, mockGetConfig, mockSetConfig, mockDiscoverInstance } =
  vi.hoisted(() => ({
    isTauriMock: vi.fn(() => false),
    mockCopyToClipboard: vi.fn().mockResolvedValue(true),
    mockGetConfig: vi.fn(),
    mockSetConfig: vi.fn(),
    mockDiscoverInstance: vi.fn(),
  }))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => isTauriMock(),
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: Record<string, unknown>) => (
    <svg data-testid="qr-mock" data-value={String(props.value)} aria-label="Display URL QR code" />
  ),
}))

vi.mock('@/lib/copy-to-clipboard', () => ({
  copyToClipboard: (text: string, opts: unknown) => mockCopyToClipboard(text, opts),
}))

vi.mock('@/lib/config-store', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/config-store')
  return {
    ...actual,
    getConfigStore: () => ({
      getConfig: mockGetConfig,
      setConfig: mockSetConfig,
      clearConfig: vi.fn(),
      hasConfig: vi.fn(),
    }),
  }
})

vi.mock('@/lib/discovery', () => ({
  discoverInstance: mockDiscoverInstance,
}))

// Import after mocks registered
import { ShowDisplayPanel } from '../show-display-panel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GYM_ID = '11111111-2222-4333-8444-555555555555'
const gym: Gym = {
  id: GYM_ID,
  name: 'Iron Temple',
  ownerUserId: 'user-1',
  isDefault: false,
  createdAt: '2026-04-07T00:00:00Z',
  updatedAt: '2026-04-07T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  isTauriMock.mockReturnValue(false)
  mockCopyToClipboard.mockResolvedValue(true)
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { origin: 'https://forge.example.com' },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Web mode (origin from window.location)
// ---------------------------------------------------------------------------

describe('ShowDisplayPanel (web)', () => {
  it('renders null when isOpen is false', () => {
    const { container } = render(<ShowDisplayPanel gym={gym} isOpen={false} onToggle={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders URL + Copy + QR when origin is valid (production)', () => {
    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    const urlEl = screen.getByTestId(`show-display-url-${GYM_ID}`)
    expect(urlEl.textContent).toBe(`https://forge.example.com/display/gym/${GYM_ID}`)

    expect(screen.getByTestId(`show-display-copy-${GYM_ID}`)).toBeInTheDocument()
    expect(screen.getByTestId('qr-mock')).toHaveAttribute(
      'data-value',
      `https://forge.example.com/display/gym/${GYM_ID}`,
    )
  })

  it('does not render the dev-origin warning for a production origin', () => {
    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    expect(screen.queryByTestId(`show-display-dev-warning-${GYM_ID}`)).not.toBeInTheDocument()
  })

  it('renders the dev-origin warning for localhost', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { origin: 'http://localhost:5173' },
    })

    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    expect(screen.getByTestId(`show-display-dev-warning-${GYM_ID}`)).toBeInTheDocument()
  })

  it('Copy button calls copyToClipboard with the URL and expected messages', async () => {
    const user = userEvent.setup()
    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    await user.click(screen.getByTestId(`show-display-copy-${GYM_ID}`))

    await waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        `https://forge.example.com/display/gym/${GYM_ID}`,
        expect.objectContaining({
          successMessage: 'Display URL copied',
          logPrefix: 'display-setup',
        }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Tauri mode (origin from persisted config.appUrl)
// ---------------------------------------------------------------------------

describe('ShowDisplayPanel (Tauri with appUrl)', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(true)
    mockGetConfig.mockResolvedValue({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'key',
      appUrl: 'https://forge.example.com',
    })
  })

  it('renders URL from config.appUrl', async () => {
    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    await waitFor(() => {
      expect(screen.getByTestId(`show-display-url-${GYM_ID}`)).toBeInTheDocument()
    })
    expect(screen.getByTestId(`show-display-url-${GYM_ID}`).textContent).toBe(
      `https://forge.example.com/display/gym/${GYM_ID}`,
    )
  })
})

// ---------------------------------------------------------------------------
// D22 backfill form (Tauri without appUrl)
// ---------------------------------------------------------------------------

describe('ShowDisplayPanel D22 backfill form', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(true)
    mockGetConfig.mockResolvedValue({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'key',
      // appUrl intentionally absent -- simulates pre-F019 persisted config
    })
  })

  it('renders the backfill form when config.appUrl is missing', async () => {
    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    await waitFor(() => {
      expect(screen.getByTestId(`show-display-backfill-${GYM_ID}`)).toBeInTheDocument()
    })
    expect(screen.getByTestId(`show-display-backfill-input-${GYM_ID}`)).toBeInTheDocument()
    expect(screen.getByTestId(`show-display-backfill-save-${GYM_ID}`)).toBeInTheDocument()
  })

  it('successful Save: calls discoverInstance, persists appUrl, and transitions to URL view', async () => {
    const user = userEvent.setup()

    mockDiscoverInstance.mockResolvedValueOnce({
      ok: true,
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'key',
      appUrl: 'https://forge.example.com',
    })
    mockSetConfig.mockResolvedValueOnce(undefined)

    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    const input = await screen.findByTestId(`show-display-backfill-input-${GYM_ID}`)
    await user.type(input, 'forge.example.com')

    await user.click(screen.getByTestId(`show-display-backfill-save-${GYM_ID}`))

    await waitFor(() => {
      expect(mockDiscoverInstance).toHaveBeenCalledWith('forge.example.com')
    })

    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith({
        supabaseUrl: 'https://abc.supabase.co',
        supabaseKey: 'key',
        appUrl: 'https://forge.example.com',
      })
    })

    // Form should transition out to the URL view.
    await waitFor(() => {
      expect(screen.getByTestId(`show-display-url-${GYM_ID}`)).toBeInTheDocument()
    })
  })

  it('Save error path: inline error + form stays open', async () => {
    const user = userEvent.setup()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockDiscoverInstance.mockResolvedValueOnce({
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Could not reach the server.',
    })

    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    const input = await screen.findByTestId(`show-display-backfill-input-${GYM_ID}`)
    await user.type(input, 'bad-host.local')
    await user.click(screen.getByTestId(`show-display-backfill-save-${GYM_ID}`))

    await waitFor(() => {
      expect(screen.getByTestId(`show-display-backfill-error-${GYM_ID}`)).toBeInTheDocument()
    })
    // Form remains visible.
    expect(screen.getByTestId(`show-display-backfill-input-${GYM_ID}`)).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[display-setup] Backfill discovery failed'),
      'NETWORK_ERROR',
      'Could not reach the server.',
    )
    errorSpy.mockRestore()
  })

  it('surfaces validation error when server URL is empty', async () => {
    const user = userEvent.setup()

    render(<ShowDisplayPanel gym={gym} isOpen={true} onToggle={() => {}} />)

    await screen.findByTestId(`show-display-backfill-input-${GYM_ID}`)
    await user.click(screen.getByTestId(`show-display-backfill-save-${GYM_ID}`))

    await waitFor(() => {
      expect(screen.getByTestId(`show-display-backfill-error-${GYM_ID}`)).toHaveTextContent(
        'Enter a server URL.',
      )
    })
    expect(mockDiscoverInstance).not.toHaveBeenCalled()
  })
})
