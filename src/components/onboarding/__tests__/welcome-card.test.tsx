// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeCard } from '../welcome-card'

const mockDismissWelcome = vi.fn()
const mockNavigate = vi.fn()
let mockIsFirstRun = true

vi.mock('@/hooks/use-onboarding', () => ({
  useOnboarding: () => ({
    isFirstRun: mockIsFirstRun,
    dismissWelcome: mockDismissWelcome,
  }),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}))

vi.mock('@/hooks/use-workout-logs', () => ({
  useWorkoutLogs: () => ({ data: [] }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))

describe('WelcomeCard', () => {
  beforeEach(() => {
    mockIsFirstRun = true
    mockDismissWelcome.mockClear()
    mockNavigate.mockClear()
  })

  it('renders when isFirstRun is true', () => {
    render(<WelcomeCard />)

    expect(screen.getByTestId('welcome-card')).toBeInTheDocument()
    expect(screen.getByText('Welcome to Ardent Forge')).toBeInTheDocument()
    expect(screen.getByText('Choose where to start.')).toBeInTheDocument()
  })

  it('does not render when welcomeDismissed (isFirstRun false)', () => {
    mockIsFirstRun = false

    const { container } = render(<WelcomeCard />)

    expect(container.innerHTML).toBe('')
  })

  it('renders all three path buttons', () => {
    render(<WelcomeCard />)

    expect(screen.getByText('Log a workout')).toBeInTheDocument()
    expect(screen.getByText('Browse exercises')).toBeInTheDocument()
    expect(screen.getByText('Build a program')).toBeInTheDocument()
  })

  it('"Log a workout" button navigates to / and calls dismissWelcome', async () => {
    const user = userEvent.setup()
    render(<WelcomeCard />)

    await user.click(screen.getByTestId('welcome-path-/'))

    expect(mockDismissWelcome).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('"Browse exercises" button navigates to /exercises and calls dismissWelcome', async () => {
    const user = userEvent.setup()
    render(<WelcomeCard />)

    await user.click(screen.getByTestId('welcome-path-/exercises'))

    expect(mockDismissWelcome).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/exercises' })
  })

  it('"Build a program" button navigates to /builder and calls dismissWelcome', async () => {
    const user = userEvent.setup()
    render(<WelcomeCard />)

    await user.click(screen.getByTestId('welcome-path-/builder'))

    expect(mockDismissWelcome).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/builder' })
  })

  it('close button dismisses without navigation', async () => {
    const user = userEvent.setup()
    render(<WelcomeCard />)

    const closeButton = screen.getByRole('button', { name: /dismiss welcome/i })
    await user.click(closeButton)

    expect(mockDismissWelcome).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('path buttons have at least 48px touch target', () => {
    render(<WelcomeCard />)

    const pathButtons = screen.getAllByTestId(/^welcome-path-/)
    for (const button of pathButtons) {
      expect(button.className).toContain('min-h-12')
    }
  })
})
