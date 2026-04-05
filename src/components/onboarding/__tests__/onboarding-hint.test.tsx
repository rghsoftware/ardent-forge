// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingHint } from '../onboarding-hint'

// Track mock state
const mockMarkHintSeen = vi.fn()
let mockShouldShowHint = true

vi.mock('@/hooks/use-onboarding', () => ({
  useOnboarding: () => ({
    shouldShowHint: vi.fn(() => mockShouldShowHint),
    markHintSeen: mockMarkHintSeen,
  }),
}))

vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))

describe('OnboardingHint', () => {
  beforeEach(() => {
    mockShouldShowHint = true
    mockMarkHintSeen.mockClear()
  })

  it('renders when hint key has not been seen', () => {
    render(
      <OnboardingHint hintKey="test-hint">
        <p>This is a hint</p>
      </OnboardingHint>,
    )

    expect(screen.getByText('This is a hint')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-hint-test-hint')).toBeInTheDocument()
  })

  it('does not render when hint key has already been seen', () => {
    mockShouldShowHint = false

    const { container } = render(
      <OnboardingHint hintKey="test-hint">
        <p>This is a hint</p>
      </OnboardingHint>,
    )

    expect(container.innerHTML).toBe('')
  })

  it('calls markHintSeen with the correct key when dismiss button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <OnboardingHint hintKey="library-intro">
        <p>Hint content</p>
      </OnboardingHint>,
    )

    const dismissButton = screen.getByRole('button', { name: /dismiss hint/i })
    await user.click(dismissButton)

    expect(mockMarkHintSeen).toHaveBeenCalledWith('library-intro')
    expect(mockMarkHintSeen).toHaveBeenCalledTimes(1)
  })

  it('dismiss button has at least 48px touch target', () => {
    render(
      <OnboardingHint hintKey="test-hint">
        <p>Hint content</p>
      </OnboardingHint>,
    )

    const dismissButton = screen.getByRole('button', { name: /dismiss hint/i })
    expect(dismissButton.className).toContain('min-h-12')
    expect(dismissButton.className).toContain('min-w-12')
  })

  it('applies motion-safe animation class', () => {
    render(
      <OnboardingHint hintKey="test-hint">
        <p>Hint content</p>
      </OnboardingHint>,
    )

    const hint = screen.getByTestId('onboarding-hint-test-hint')
    expect(hint.className).toContain('motion-safe:animate-')
  })

  it('renders with ember left border accent', () => {
    render(
      <OnboardingHint hintKey="test-hint">
        <p>Hint content</p>
      </OnboardingHint>,
    )

    const hint = screen.getByTestId('onboarding-hint-test-hint')
    expect(hint.className).toContain('border-l-2')
    expect(hint.className).toContain('border-ember')
  })

  it('applies additional className when provided', () => {
    render(
      <OnboardingHint hintKey="test-hint" className="mt-6">
        <p>Hint content</p>
      </OnboardingHint>,
    )

    const hint = screen.getByTestId('onboarding-hint-test-hint')
    expect(hint.className).toContain('mt-6')
  })
})
