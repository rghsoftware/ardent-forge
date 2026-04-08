// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Hoisted test doubles
// ---------------------------------------------------------------------------

const { mockUseCreateGym, mockUseUserProfile, mockUseQrScanner, mockNavigate, mockToast } =
  vi.hoisted(() => ({
    mockUseCreateGym: vi.fn(),
    mockUseUserProfile: vi.fn(),
    mockUseQrScanner: vi.fn(),
    mockNavigate: vi.fn(),
    mockToast: vi.fn(),
  }))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/hooks/use-gyms', () => ({
  useCreateGym: () => mockUseCreateGym(),
}))

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}))

vi.mock('@/hooks/use-qr-scanner', () => ({
  useQrScanner: () => mockUseQrScanner(),
}))

vi.mock('sonner', () => ({
  toast: (msg: string) => mockToast(msg),
}))

import { DisplaySetupPanel } from '../display-setup-panel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '11111111-2222-4333-8444-555555555555'

interface MutationStub {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
  isError: boolean
  error: unknown
}

function makeMutation(overrides: Partial<MutationStub> = {}): MutationStub {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-default',
    name: 'Gym',
    ownerUserId: 'user-1',
    isDefault: false,
    createdAt: '2026-04-07T00:00:00Z',
    updatedAt: '2026-04-07T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUserProfile.mockReturnValue({ data: { displayName: 'Alice' } })
  mockUseQrScanner.mockReturnValue(null) // default: web mode
  mockUseCreateGym.mockReturnValue(makeMutation())
})

// ---------------------------------------------------------------------------
// Panel A: URL input
// ---------------------------------------------------------------------------

describe('DisplaySetupPanel Panel A', () => {
  it('auto-focuses the input on mount', () => {
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    expect(document.activeElement).toBe(input)
  })

  it('renders the intro copy', () => {
    render(<DisplaySetupPanel userId="user-1" />)

    expect(screen.getByTestId('display-setup-intro')).toHaveTextContent(
      /Connect a TV at an existing gym/,
    )
  })

  it('accepts a full URL and navigates with the parsed gym id', async () => {
    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    await user.type(input, `https://forge.example.com/display/gym/${VALID_UUID}`)
    await user.click(screen.getByTestId('display-setup-panel-a-submit'))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/display/gym/$gymId',
      params: { gymId: VALID_UUID },
    })
  })

  it('accepts a path-only URL', async () => {
    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    await user.type(input, `/display/gym/${VALID_UUID}`)
    await user.click(screen.getByTestId('display-setup-panel-a-submit'))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/display/gym/$gymId',
      params: { gymId: VALID_UUID },
    })
  })

  it('accepts a bare UUID', async () => {
    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    await user.type(input, VALID_UUID)
    await user.click(screen.getByTestId('display-setup-panel-a-submit'))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/display/gym/$gymId',
      params: { gymId: VALID_UUID },
    })
  })

  it('rejects malformed input with an inline error and does not navigate', async () => {
    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    await user.type(input, 'not-a-uuid-and-not-a-url')
    await user.click(screen.getByTestId('display-setup-panel-a-submit'))

    expect(screen.getByTestId('display-setup-panel-a-error')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('accepts Enter key as submit', async () => {
    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    await user.type(input, `${VALID_UUID}{Enter}`)

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/display/gym/$gymId',
      params: { gymId: VALID_UUID },
    })
  })

  it('clears the inline error when the user edits the input', async () => {
    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    const input = screen.getByTestId('display-setup-panel-a-input')
    await user.type(input, 'bad')
    await user.click(screen.getByTestId('display-setup-panel-a-submit'))
    expect(screen.getByTestId('display-setup-panel-a-error')).toBeInTheDocument()

    await user.type(input, 'x')
    expect(screen.queryByTestId('display-setup-panel-a-error')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Scan QR (Tauri-only)
// ---------------------------------------------------------------------------

describe('DisplaySetupPanel Scan QR', () => {
  it('Scan QR button is absent when useQrScanner returns null (web)', () => {
    mockUseQrScanner.mockReturnValue(null)
    render(<DisplaySetupPanel userId="user-1" />)
    expect(screen.queryByTestId('display-setup-scan-qr')).not.toBeInTheDocument()
  })

  it('Scan QR button is present when useQrScanner returns a hook (Tauri)', () => {
    mockUseQrScanner.mockReturnValue({
      scanning: false,
      scan: vi.fn(),
      cancel: vi.fn(),
    })
    render(<DisplaySetupPanel userId="user-1" />)
    expect(screen.getByTestId('display-setup-scan-qr')).toBeInTheDocument()
  })

  it('successful scan navigates to the parsed gym id', async () => {
    const scan = vi.fn().mockResolvedValue(`/display/gym/${VALID_UUID}`)
    mockUseQrScanner.mockReturnValue({ scanning: false, scan, cancel: vi.fn() })

    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    await user.click(screen.getByTestId('display-setup-scan-qr'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/display/gym/$gymId',
        params: { gymId: VALID_UUID },
      })
    })
  })

  it('non-UUID scan result surfaces a toast and does not navigate', async () => {
    const scan = vi.fn().mockResolvedValue('garbage')
    mockUseQrScanner.mockReturnValue({ scanning: false, scan, cancel: vi.fn() })

    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    await user.click(screen.getByTestId('display-setup-scan-qr'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Scanned code is not a display URL')
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('cancelled scan (returns null) is silent', async () => {
    const scan = vi.fn().mockResolvedValue(null)
    mockUseQrScanner.mockReturnValue({ scanning: false, scan, cancel: vi.fn() })

    const user = userEvent.setup()
    render(<DisplaySetupPanel userId="user-1" />)

    await user.click(screen.getByTestId('display-setup-scan-qr'))

    await waitFor(() => {
      expect(scan).toHaveBeenCalled()
    })
    expect(mockToast).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Panel B: Personal display
// ---------------------------------------------------------------------------

describe('DisplaySetupPanel Panel B', () => {
  it('calls createGym with the derived name on click', async () => {
    const user = userEvent.setup()
    const mutation = makeMutation()
    mockUseCreateGym.mockReturnValue(mutation)

    render(<DisplaySetupPanel userId="user-1" />)

    await user.click(screen.getByTestId('display-setup-panel-b-submit'))

    expect(mutation.mutate).toHaveBeenCalledWith(
      { name: "Alice's Training" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('navigates with replace on createGym success', async () => {
    const user = userEvent.setup()
    const mutation = makeMutation()
    mockUseCreateGym.mockReturnValue(mutation)

    render(<DisplaySetupPanel userId="user-1" />)
    await user.click(screen.getByTestId('display-setup-panel-b-submit'))

    const { onSuccess } = mutation.mutate.mock.calls[0]![1] as {
      onSuccess: (gym: Gym) => void
    }
    onSuccess(makeGym({ id: 'new-gym' }))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/display/gym/$gymId',
      params: { gymId: 'new-gym' },
      replace: true,
    })
  })

  it('renders inline error when createGym fails', () => {
    mockUseCreateGym.mockReturnValue(
      makeMutation({
        isError: true,
        error: { code: '42501', message: 'denied' },
      }),
    )

    render(<DisplaySetupPanel userId="user-1" />)

    const err = screen.getByTestId('display-setup-panel-b-error')
    expect(err).toHaveTextContent(/permission/i)
  })

  it('button is disabled and shows "Creating..." while pending', () => {
    mockUseCreateGym.mockReturnValue(makeMutation({ isPending: true }))

    render(<DisplaySetupPanel userId="user-1" />)

    const btn = screen.getByTestId('display-setup-panel-b-submit')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/Creating/i)
  })
})
