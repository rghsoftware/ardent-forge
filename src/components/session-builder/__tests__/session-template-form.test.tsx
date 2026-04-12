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

vi.mock('@/components/session-builder/inputs/duration-input', () => ({
  DurationInput: ({ label }: { label: string }) => <div data-testid="duration-input">{label}</div>,
}))

describe('SessionTemplateForm', () => {
  it('renders template name input', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByLabelText('Template name')).toBeInTheDocument()
  })

  it('renders category selector with all options', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('Conditioning')).toBeInTheDocument()
    expect(screen.getByText('SE')).toBeInTheDocument()
    expect(screen.getByText('Mixed')).toBeInTheDocument()
  })

  it('renders description textarea', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByLabelText('Template description')).toBeInTheDocument()
  })

  it('renders scoring section visible when category supports it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SessionTemplateForm />)

    // Default category is STRENGTH which collapses scoring. Switch to CONDITIONING.
    await user.click(screen.getByText('Conditioning'))
    expect(screen.getByText('Scoring')).toBeInTheDocument()
  })

  it('renders disabled Save button with Resolve errors copy on initial load', () => {
    renderWithProviders(<SessionTemplateForm />)
    const saveButton = screen.getByRole('button', { name: 'Resolve errors' })
    expect(saveButton).toBeInTheDocument()
    expect(saveButton).toBeDisabled()
  })

  it('renders Add group button', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.getByText('Add group')).toBeInTheDocument()
  })

  it('shows name validation error when name field is blurred while empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SessionTemplateForm />)

    const nameInput = screen.getByLabelText('Template name')
    await user.click(nameInput)
    await user.tab()

    expect(screen.getByText('Give your template a name')).toBeInTheDocument()
  })

  it('keeps Save button disabled when name is filled but no groups exist', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SessionTemplateForm />)

    await user.type(screen.getByLabelText('Template name'), 'My Session')

    const saveButton = screen.getByRole('button', { name: 'Resolve errors' })
    expect(saveButton).toBeDisabled()
  })

  it('renders Cancel button when onCancel prop is provided', () => {
    renderWithProviders(<SessionTemplateForm onCancel={() => {}} />)
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('does not render Cancel button when onCancel prop is absent', () => {
    renderWithProviders(<SessionTemplateForm />)
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })
})
