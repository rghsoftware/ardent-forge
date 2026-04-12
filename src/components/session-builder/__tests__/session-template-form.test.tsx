// @vitest-environment happy-dom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import {
  SessionTemplateForm,
  computeErrors,
  type SessionTemplateFull,
} from '@/components/session-builder/session-template-form'
import type { ActivityGroupData } from '@/components/session-builder/activity-group-editor'
import { useUpdateSessionTemplate } from '@/hooks/use-session-templates'

// Mock hooks that SessionTemplateForm depends on
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: null, loading: false }),
}))

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/use-session-templates', () => ({
  useCreateSessionTemplate: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ template: { id: 'st-1', name: 'Test' } }),
    isPending: false,
  })),
  useUpdateSessionTemplate: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ template: { id: 'st-1', name: 'Test' } }),
    isPending: false,
  })),
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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validInitial: SessionTemplateFull = {
  template: {
    id: 'st-1',
    userId: 'user-1',
    name: 'Test Template',
    category: 'STRENGTH',
    scoring: 'NONE',
    isPublic: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  groups: [
    {
      id: 'group-1',
      sessionTemplateId: 'st-1',
      groupType: 'STRAIGHT_SETS',
      ordinal: 1,
    },
  ],
  activities: [
    {
      id: 'activity-1',
      activityGroupId: 'group-1',
      exerciseId: 'ex-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setScheme: { type: 'fixedSets', sets: 3, reps: 8 } as any,
      ordinal: 1,
    },
  ],
}

// ---------------------------------------------------------------------------
// SessionTemplateForm
// ---------------------------------------------------------------------------

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

  // P16-010: onSave callback
  it('calls onSave with the saved template after successful save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithProviders(<SessionTemplateForm initial={validInitial} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Save template' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'st-1' }))
    })
  })

  // P16-012: save-button state machine
  it('shows enabled Save template button when form is valid', () => {
    renderWithProviders(<SessionTemplateForm initial={validInitial} />)
    const saveButton = screen.getByRole('button', { name: 'Save template' })
    expect(saveButton).toBeInTheDocument()
    expect(saveButton).not.toBeDisabled()
  })

  it('shows Saving... and disables button while mutation is pending', () => {
    vi.mocked(useUpdateSessionTemplate).mockReturnValueOnce({
      mutateAsync: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useUpdateSessionTemplate>)

    renderWithProviders(<SessionTemplateForm initial={validInitial} />)

    const saveButton = screen.getByRole('button', { name: 'Saving...' })
    expect(saveButton).toBeDisabled()
  })

  // P16-013: onDirtyChange and mutation failure
  it('calls onDirtyChange(true) when the form is edited', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    renderWithProviders(<SessionTemplateForm onDirtyChange={onDirtyChange} />)

    await user.type(screen.getByLabelText('Template name'), 'Test')

    expect(onDirtyChange).toHaveBeenCalledWith(true)
  })

  it('calls onDirtyChange(false) after a successful save', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    renderWithProviders(
      <SessionTemplateForm initial={validInitial} onDirtyChange={onDirtyChange} />,
    )

    // Edit the name to make the form dirty, then save.
    await user.type(screen.getByLabelText('Template name'), ' Updated')
    await user.click(screen.getByRole('button', { name: 'Save template' }))

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('renders a server error alert when the mutation fails', async () => {
    vi.mocked(useUpdateSessionTemplate).mockReturnValueOnce({
      mutateAsync: vi.fn().mockRejectedValue(new Error('Network error')),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateSessionTemplate>)

    const user = userEvent.setup()
    renderWithProviders(<SessionTemplateForm initial={validInitial} />)

    await user.click(screen.getByRole('button', { name: 'Save template' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to update session template. Please try again.',
      )
    })
  })
})

// ---------------------------------------------------------------------------
// computeErrors (P16-011: unit tests for the pure validation function)
// ---------------------------------------------------------------------------

describe('computeErrors', () => {
  const validGroup = (): ActivityGroupData => ({
    clientId: 'g-1',
    groupType: 'STRAIGHT_SETS',
    ordinal: 1,
    activities: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { clientId: 'a-1', exerciseId: 'ex-1', setScheme: {} as any, ordinal: 1 },
    ],
  })

  it('returns no errors for a valid name and fully-populated group', () => {
    const result = computeErrors('My Template', [validGroup()])
    expect(result.name).toBeUndefined()
    expect(result.noGroups).toBeUndefined()
    expect(Object.keys(result.groups)).toHaveLength(0)
    expect(Object.keys(result.activities)).toHaveLength(0)
  })

  it('sets name error when name is blank', () => {
    const result = computeErrors('', [validGroup()])
    expect(result.name).toBe('Give your template a name')
  })

  it('sets name error when name is whitespace only', () => {
    const result = computeErrors('   ', [validGroup()])
    expect(result.name).toBe('Give your template a name')
  })

  it('sets noGroups error when groups array is empty', () => {
    const result = computeErrors('My Template', [])
    expect(result.noGroups).toBe('Add at least one group to continue')
  })

  it('sets group noType error when groupType is null', () => {
    const group = { ...validGroup(), groupType: null }
    const result = computeErrors('My Template', [group])
    expect(result.groups['g-1']?.noType).toBe('Pick a group type')
  })

  it('sets group noActivities error when activities array is empty', () => {
    const group = { ...validGroup(), activities: [] }
    const result = computeErrors('My Template', [group])
    expect(result.groups['g-1']?.noActivities).toBe('Add at least one exercise')
  })

  it('sets activity error when exerciseId is null', () => {
    const group = validGroup()
    group.activities[0] = { ...group.activities[0], exerciseId: null }
    const result = computeErrors('My Template', [group])
    expect(result.activities['a-1']).toBe('Select an exercise')
  })
})
