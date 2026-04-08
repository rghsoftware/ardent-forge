// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Hoisted test doubles
// ---------------------------------------------------------------------------

const { mockUseCreateGym, mockUseUserProfile, mockNavigate } = vi.hoisted(() => ({
  mockUseCreateGym: vi.fn(),
  mockUseUserProfile: vi.fn(),
  mockNavigate: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string
    params: Record<string, string>
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={to.replace('$gymId', params.gymId)} data-testid={`link-${params.gymId}`} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}))

vi.mock('@/hooks/use-gyms', () => ({
  useCreateGym: () => mockUseCreateGym(),
}))

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}))

import { DisplayChooser } from '../display-chooser'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUserProfile.mockReturnValue({ data: { displayName: 'Alice' } })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DisplayChooser', () => {
  it('renders one Link row per gym', () => {
    mockUseCreateGym.mockReturnValue(makeMutation())
    const gyms = [
      makeGym({ id: 'gym-a', name: 'Gym A' }),
      makeGym({ id: 'gym-b', name: 'Gym B' }),
      makeGym({ id: 'gym-c', name: 'Gym C' }),
    ]

    render(<DisplayChooser gyms={gyms} userId="user-1" />)

    expect(screen.getByTestId('display-chooser-row-gym-a')).toBeInTheDocument()
    expect(screen.getByTestId('display-chooser-row-gym-b')).toBeInTheDocument()
    expect(screen.getByTestId('display-chooser-row-gym-c')).toBeInTheDocument()

    // Each row is a real <a> so middle-click / hover-preview work.
    expect(screen.getByTestId('link-gym-a')).toHaveAttribute('href', '/display/gym/gym-a')
    expect(screen.getByTestId('link-gym-b')).toHaveAttribute('href', '/display/gym/gym-b')
  })

  it('links have aria-label "Open display for {gym name}"', () => {
    mockUseCreateGym.mockReturnValue(makeMutation())
    render(<DisplayChooser gyms={[makeGym({ id: 'gym-a', name: 'Iron Temple' })]} userId="u" />)

    expect(screen.getByLabelText('Open display for Iron Temple')).toBeInTheDocument()
  })

  it('renders "Start a personal display" row at the bottom', () => {
    mockUseCreateGym.mockReturnValue(makeMutation())
    render(<DisplayChooser gyms={[makeGym({ id: 'a' }), makeGym({ id: 'b' })]} userId="u" />)

    expect(screen.getByTestId('display-chooser-start-personal')).toBeInTheDocument()
  })

  it('tapping Start a personal display calls createGym with the derived name', async () => {
    const user = userEvent.setup()
    const mutation = makeMutation()
    mockUseCreateGym.mockReturnValue(mutation)

    render(<DisplayChooser gyms={[makeGym({ id: 'a' }), makeGym({ id: 'b' })]} userId="user-1" />)

    await user.click(screen.getByTestId('display-chooser-start-personal'))

    expect(mutation.mutate).toHaveBeenCalledWith(
      { name: "Alice's Training" },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )
  })

  it('falls back to "My Training" when displayName is unset', async () => {
    const user = userEvent.setup()
    mockUseUserProfile.mockReturnValue({ data: { displayName: undefined } })
    const mutation = makeMutation()
    mockUseCreateGym.mockReturnValue(mutation)

    render(<DisplayChooser gyms={[makeGym({ id: 'a' }), makeGym({ id: 'b' })]} userId="u" />)

    await user.click(screen.getByTestId('display-chooser-start-personal'))

    expect(mutation.mutate).toHaveBeenCalledWith({ name: 'My Training' }, expect.any(Object))
  })

  it('onSuccess navigates to the new gym via replace', async () => {
    const user = userEvent.setup()
    const mutation = makeMutation()
    mockUseCreateGym.mockReturnValue(mutation)

    render(<DisplayChooser gyms={[makeGym({ id: 'a' }), makeGym({ id: 'b' })]} userId="user-1" />)

    await user.click(screen.getByTestId('display-chooser-start-personal'))

    // Fire the onSuccess callback manually to simulate server response.
    const call = mutation.mutate.mock.calls[0]
    const { onSuccess } = call![1] as {
      onSuccess: (gym: Gym) => void
    }
    onSuccess(makeGym({ id: 'new-gym', name: "Alice's Training" }))

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
        error: { code: '23505', message: 'duplicate' },
      }),
    )

    render(<DisplayChooser gyms={[makeGym({ id: 'a' }), makeGym({ id: 'b' })]} userId="u" />)

    const err = screen.getByTestId('display-chooser-personal-error')
    expect(err).toHaveTextContent(/gym with this name already exists|Choose a different name/i)
  })

  it('button shows "Creating..." while mutation is pending', () => {
    mockUseCreateGym.mockReturnValue(makeMutation({ isPending: true }))

    render(<DisplayChooser gyms={[makeGym({ id: 'a' }), makeGym({ id: 'b' })]} userId="u" />)

    const btn = screen.getByTestId('display-chooser-start-personal')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/Creating/i)
  })

  it('supports keyboard navigation via anchor tags', async () => {
    mockUseCreateGym.mockReturnValue(makeMutation())

    render(
      <DisplayChooser
        gyms={[makeGym({ id: 'a', name: 'A' }), makeGym({ id: 'b', name: 'B' })]}
        userId="u"
      />,
    )

    // Verify the anchor tags are present and focusable.
    const link = screen.getByTestId('link-a')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href')
    await waitFor(() => {
      link.focus()
      expect(document.activeElement).toBe(link)
    })
  })
})
