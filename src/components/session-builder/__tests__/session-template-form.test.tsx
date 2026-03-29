// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'

// Mock hooks that SessionTemplateForm depends on
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: null, loading: false }),
}))

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/use-session-templates', () => ({
  useCreateSessionTemplate: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ template: { id: 'st-1', name: 'Test' } }),
    isPending: false,
  }),
  useUpdateSessionTemplate: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ template: { id: 'st-1', name: 'Test' } }),
    isPending: false,
  }),
}))

// Mock Icon to avoid font dependency
vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))

// Mock sub-components that add complexity
vi.mock('@/components/session-builder/activity-group-editor', () => ({
  ActivityGroupEditor: () => <div data-testid="activity-group-editor">Group Editor</div>,
}))

vi.mock('@/components/session-builder/duration-input-compact', () => ({
  DurationInputCompact: ({ label }: { label: string }) => (
    <div data-testid="duration-input">{label}</div>
  ),
}))

describe('SessionTemplateForm', () => {
  it('renders template name input', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByLabelText('Template name')).toBeInTheDocument()
  })

  it('renders category selector with all options', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByText('CATEGORY')).toBeInTheDocument()
    expect(screen.getByText('STRENGTH')).toBeInTheDocument()
    expect(screen.getByText('CONDITIONING')).toBeInTheDocument()
    expect(screen.getByText('SE')).toBeInTheDocument()
    expect(screen.getByText('MIXED')).toBeInTheDocument()
  })

  it('renders description textarea', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByLabelText('Template description')).toBeInTheDocument()
  })

  it('renders scoring section', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByText('SCORING')).toBeInTheDocument()
  })

  it('renders SAVE TEMPLATE button', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByText('SAVE TEMPLATE')).toBeInTheDocument()
  })

  it('renders ADD GROUP button', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByText('ADD GROUP')).toBeInTheDocument()
  })

  it('shows validation error when saving with empty name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SessionTemplateForm />)

    await user.click(screen.getByText('SAVE TEMPLATE'))

    expect(screen.getByText('Template name is required')).toBeInTheDocument()
  })

  it('shows validation error when saving with no activity groups', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SessionTemplateForm />)

    // Fill in name but don't add groups
    await user.type(screen.getByLabelText('Template name'), 'My Session')
    await user.click(screen.getByText('SAVE TEMPLATE'))

    expect(screen.getByText('At least one activity group is required')).toBeInTheDocument()
  })

  it('renders CANCEL button when onCancel prop is provided', () => {
    renderWithProviders(<SessionTemplateForm onCancel={() => {}} />)
    expect(screen.getByText('CANCEL')).toBeInTheDocument()
  })

  it('does not render CANCEL button when onCancel prop is absent', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.queryByText('CANCEL')).not.toBeInTheDocument()
  })
})
