// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import type { Gym } from '@/domain/types'
// P14-048: removed `?raw` source-text import. The pagination TODO is
// tracked in Context/Backlog/gym-management-pagination.md, not asserted in
// this test file.

// ---------------------------------------------------------------------------
// Mocks -- drive every data hook and every mutation from the test.
// ---------------------------------------------------------------------------

const mockUseGyms = vi.fn()
const mockUseAllGyms = vi.fn()
const mockUseGymMembers = vi.fn()
const mockUseCreateGym = vi.fn()
const mockUseDeleteGym = vi.fn()
const mockUseJoinGym = vi.fn()
const mockUseLeaveGym = vi.fn()

vi.mock('@/hooks/use-gyms', () => ({
  useGyms: (...args: unknown[]) => mockUseGyms(...args),
  useAllGyms: () => mockUseAllGyms(),
  useCreateGym: () => mockUseCreateGym(),
  useDeleteGym: () => mockUseDeleteGym(),
}))

vi.mock('@/hooks/use-gym-members', () => ({
  useGymMembers: (...args: unknown[]) => mockUseGymMembers(...args),
  useJoinGym: () => mockUseJoinGym(),
  useLeaveGym: () => mockUseLeaveGym(),
}))

// Import after mocks are registered
import { GymManagementSection } from '../gym-management-section'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ME = 'user-me'
const OTHER_USER = 'user-other'

function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-default',
    name: 'Home Gym',
    ownerUserId: ME,
    isDefault: false,
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    ...overrides,
  }
}

interface QueryState<T> {
  data?: T
  isLoading?: boolean
  isError?: boolean
}

function stubUseGyms(state: QueryState<Gym[]>) {
  mockUseGyms.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  })
}

function stubUseAllGyms(state: QueryState<Gym[]>) {
  mockUseAllGyms.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  })
}

// Stubs the per-row useGymMembers query. By default returns the same shape
// for every gym id; pass an `idMap` to vary by gym (e.g., to assert different
// counts on different rows).
function stubUseGymMembers(
  defaults: QueryState<{ id: string }[]>,
  idMap: Record<string, QueryState<{ id: string }[]>> = {},
) {
  mockUseGymMembers.mockImplementation((gymId: string) => {
    const state = idMap[gymId] ?? defaults
    return {
      data: state.data,
      isLoading: state.isLoading ?? false,
      isError: state.isError ?? false,
    }
  })
}

interface MutationStub {
  mutate: ReturnType<typeof vi.fn>
  isPending?: boolean
  isError?: boolean
  variables?: unknown
}

function makeMutation(overrides: Partial<MutationStub> = {}): MutationStub {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    variables: undefined,
    ...overrides,
  }
}

// Holders so tests can reach their assertion spies.
let createGymStub: MutationStub
let deleteGymStub: MutationStub
let joinGymStub: MutationStub
let leaveGymStub: MutationStub

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GymManagementSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    createGymStub = makeMutation()
    deleteGymStub = makeMutation()
    joinGymStub = makeMutation()
    leaveGymStub = makeMutation()

    mockUseCreateGym.mockImplementation(() => createGymStub)
    mockUseDeleteGym.mockImplementation(() => deleteGymStub)
    mockUseJoinGym.mockImplementation(() => joinGymStub)
    mockUseLeaveGym.mockImplementation(() => leaveGymStub)

    // Sensible query defaults -- individual tests override.
    stubUseGyms({ data: [] })
    stubUseAllGyms({ data: [] })
    stubUseGymMembers({ data: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // (a) My gyms list renders with leave + delete affordances appropriately
  // -------------------------------------------------------------------------
  it('renders My gyms rows with Leave on all rows and Delete only on owned rows', () => {
    stubUseGyms({
      data: [
        makeGym({ id: 'gym-owned', name: 'My Garage', ownerUserId: ME }),
        makeGym({ id: 'gym-joined', name: "Friend's Box", ownerUserId: OTHER_USER }),
      ],
    })
    // Different counts per row so the assertion verifies the per-row query
    // is wired up, not just that some number renders.
    stubUseGymMembers(
      { data: [] },
      {
        'gym-owned': { data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] },
        'gym-joined': { data: [{ id: 'm1' }, { id: 'm2' }] },
      },
    )

    renderWithProviders(<GymManagementSection userId={ME} />)

    expect(screen.getByTestId('my-gym-row-gym-owned')).toBeInTheDocument()
    expect(screen.getByTestId('my-gym-row-gym-joined')).toBeInTheDocument()

    // Leave button on both rows
    expect(screen.getByTestId('my-gym-row-gym-owned-leave')).toBeInTheDocument()
    expect(screen.getByTestId('my-gym-row-gym-joined-leave')).toBeInTheDocument()

    // Delete button ONLY on the owned row
    expect(screen.getByTestId('my-gym-row-gym-owned-delete')).toBeInTheDocument()
    expect(screen.queryByTestId('my-gym-row-gym-joined-delete')).not.toBeInTheDocument()

    // Live member counts from useGymMembers per row
    expect(screen.getByTestId('my-gym-row-gym-owned-member-count')).toHaveTextContent('3')
    expect(screen.getByTestId('my-gym-row-gym-joined-member-count')).toHaveTextContent('2')
  })

  it('renders -- in the member count while the per-row members query is loading', () => {
    stubUseGyms({
      data: [makeGym({ id: 'gym-owned', name: 'My Garage', ownerUserId: ME })],
    })
    stubUseGymMembers({ isLoading: true })

    renderWithProviders(<GymManagementSection userId={ME} />)

    expect(screen.getByTestId('my-gym-row-gym-owned-member-count')).toHaveTextContent('--')
  })

  it('renders ? in the member count when the per-row members query errors', () => {
    stubUseGyms({
      data: [makeGym({ id: 'gym-owned', name: 'My Garage', ownerUserId: ME })],
    })
    stubUseGymMembers({ isError: true })

    renderWithProviders(<GymManagementSection userId={ME} />)

    expect(screen.getByTestId('my-gym-row-gym-owned-member-count')).toHaveTextContent('?')
  })

  it('shows an empty state when the user has no gym memberships', () => {
    stubUseGyms({ data: [] })
    renderWithProviders(<GymManagementSection userId={ME} />)

    expect(screen.getByTestId('my-gyms-empty')).toBeInTheDocument()
  })

  it('shows an error state when the my-gyms query fails', () => {
    stubUseGyms({ isError: true })
    renderWithProviders(<GymManagementSection userId={ME} />)

    expect(screen.getByTestId('my-gyms-error')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // (b) Leave button calls useLeaveGym().mutate
  // -------------------------------------------------------------------------
  it('calls leaveGym.mutate with the gym id when Leave is tapped', async () => {
    const user = userEvent.setup()
    stubUseGyms({
      data: [makeGym({ id: 'gym-joined', name: "Friend's Box", ownerUserId: OTHER_USER })],
    })

    renderWithProviders(<GymManagementSection userId={ME} />)

    await user.click(screen.getByTestId('my-gym-row-gym-joined-leave'))

    expect(leaveGymStub.mutate).toHaveBeenCalledTimes(1)
    expect(leaveGymStub.mutate).toHaveBeenCalledWith('gym-joined')
  })

  // -------------------------------------------------------------------------
  // (c) Delete on owned gym opens confirmation modal; Confirm calls delete
  // -------------------------------------------------------------------------
  it('opens a confirmation modal when Delete is tapped and calls deleteGym.mutate on Confirm', async () => {
    const user = userEvent.setup()
    stubUseGyms({
      data: [makeGym({ id: 'gym-owned', name: 'My Garage', ownerUserId: ME })],
    })

    renderWithProviders(<GymManagementSection userId={ME} />)

    // Dialog is not open initially
    expect(screen.queryByTestId('delete-gym-confirm-dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('my-gym-row-gym-owned-delete'))

    // Dialog content is visible and includes the gym name + warning
    await waitFor(() => {
      expect(screen.getByTestId('delete-gym-confirm-dialog')).toBeInTheDocument()
    })
    expect(screen.getByText(/DELETE MY GARAGE\?/i)).toBeInTheDocument()
    expect(screen.getByText(/This will end any active TV at this gym/i)).toBeInTheDocument()

    // Tap Confirm
    await user.click(screen.getByTestId('delete-gym-confirm'))

    expect(deleteGymStub.mutate).toHaveBeenCalledTimes(1)
    // Component now passes an onSuccess callback so the dialog only closes
    // after the mutation succeeds (and stays open with an error banner if it
    // fails). Match the (gymId, optionsObject) shape rather than just gymId.
    expect(deleteGymStub.mutate).toHaveBeenCalledWith(
      'gym-owned',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  // -------------------------------------------------------------------------
  // (d) Cancel on the confirmation modal does NOT call deleteGym.mutate
  // -------------------------------------------------------------------------
  it('does not call deleteGym.mutate when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    stubUseGyms({
      data: [makeGym({ id: 'gym-owned', name: 'My Garage', ownerUserId: ME })],
    })

    renderWithProviders(<GymManagementSection userId={ME} />)

    await user.click(screen.getByTestId('my-gym-row-gym-owned-delete'))

    await waitFor(() => {
      expect(screen.getByTestId('delete-gym-confirm-dialog')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-gym-cancel'))

    expect(deleteGymStub.mutate).not.toHaveBeenCalled()
    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByTestId('delete-gym-confirm-dialog')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // (e) Browse list: Join buttons for non-joined, "Joined" label for joined
  // -------------------------------------------------------------------------
  it('renders Join for not-yet-joined gyms and "Joined" for already-joined gyms', () => {
    stubUseGyms({
      data: [makeGym({ id: 'gym-a', name: 'Alpha', ownerUserId: ME })],
    })
    stubUseAllGyms({
      data: [
        makeGym({ id: 'gym-a', name: 'Alpha', ownerUserId: ME }),
        makeGym({ id: 'gym-b', name: 'Bravo', ownerUserId: OTHER_USER }),
      ],
    })

    renderWithProviders(<GymManagementSection userId={ME} />)

    // gym-a is already a member -> "Joined" indicator
    expect(screen.getByTestId('browse-gym-row-gym-a-joined')).toBeInTheDocument()
    expect(screen.queryByTestId('browse-gym-row-gym-a-join')).not.toBeInTheDocument()

    // gym-b is not a member -> Join button
    expect(screen.getByTestId('browse-gym-row-gym-b-join')).toBeInTheDocument()
    expect(screen.queryByTestId('browse-gym-row-gym-b-joined')).not.toBeInTheDocument()

    // Member-count placeholder
    expect(screen.getByTestId('browse-gym-row-gym-b-member-count')).toHaveTextContent('--')
  })

  // -------------------------------------------------------------------------
  // (f) Join button calls joinGym.mutate
  // -------------------------------------------------------------------------
  it('calls joinGym.mutate with the gym id when Join is tapped', async () => {
    const user = userEvent.setup()
    stubUseGyms({ data: [] })
    stubUseAllGyms({
      data: [makeGym({ id: 'gym-b', name: 'Bravo', ownerUserId: OTHER_USER })],
    })

    renderWithProviders(<GymManagementSection userId={ME} />)

    await user.click(screen.getByTestId('browse-gym-row-gym-b-join'))

    expect(joinGymStub.mutate).toHaveBeenCalledTimes(1)
    expect(joinGymStub.mutate).toHaveBeenCalledWith('gym-b')
  })

  // -------------------------------------------------------------------------
  // (g) Create form posts a new gym via createGym.mutate({ name })
  // -------------------------------------------------------------------------
  it('calls createGym.mutate with the entered name when Create is tapped', async () => {
    const user = userEvent.setup()
    stubUseGyms({ data: [] })
    stubUseAllGyms({ data: [] })

    renderWithProviders(<GymManagementSection userId={ME} />)

    const input = screen.getByTestId('create-gym-input')
    await user.type(input, 'Concrete Lab')

    await user.click(screen.getByTestId('create-gym-submit'))

    expect(createGymStub.mutate).toHaveBeenCalledTimes(1)
    const [firstCall] = createGymStub.mutate.mock.calls
    expect(firstCall[0]).toEqual({ name: 'Concrete Lab' })
  })

  // -------------------------------------------------------------------------
  // (h) Create form rejects an empty name (Create button disabled)
  // -------------------------------------------------------------------------
  it('disables the Create button when the name is empty', () => {
    stubUseGyms({ data: [] })
    stubUseAllGyms({ data: [] })

    renderWithProviders(<GymManagementSection userId={ME} />)

    const submit = screen.getByTestId('create-gym-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  // -------------------------------------------------------------------------
  // (i) Create form rejects a 61-character name (Create button disabled,
  //     validation error surfaces)
  // -------------------------------------------------------------------------
  it('rejects a 61-character name and surfaces a validation error', async () => {
    const user = userEvent.setup()
    stubUseGyms({ data: [] })
    stubUseAllGyms({ data: [] })

    renderWithProviders(<GymManagementSection userId={ME} />)

    const tooLong = 'x'.repeat(61)
    const input = screen.getByTestId('create-gym-input') as HTMLInputElement
    await user.type(input, tooLong)

    const submit = screen.getByTestId('create-gym-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(screen.getByText(/Gym name must be 1 to 60 characters/i)).toBeInTheDocument()
    expect(createGymStub.mutate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // (j) Browse all gyms is hidden when it would only duplicate My gyms
  // -------------------------------------------------------------------------
  describe('Browse all gyms visibility', () => {
    it('hides Browse all gyms when there is exactly one gym and the user is a member', () => {
      const onlyGym = makeGym({ id: 'gym-only', name: 'The Forge', ownerUserId: ME })
      stubUseGyms({ data: [onlyGym] })
      stubUseAllGyms({ data: [onlyGym] })

      renderWithProviders(<GymManagementSection userId={ME} />)

      // The Browse heading and any browse-* test ids must not appear -- the
      // single gym is already in My gyms above.
      expect(screen.queryByText(/Browse all gyms/i)).not.toBeInTheDocument()
      expect(screen.queryByTestId('browse-gym-row-gym-only')).not.toBeInTheDocument()
    })

    it('shows Browse all gyms when the only gym exists but the user is not a member', () => {
      // User has joined nothing yet -- they need Browse to discover the gym.
      stubUseGyms({ data: [] })
      stubUseAllGyms({
        data: [makeGym({ id: 'gym-only', name: 'The Forge', ownerUserId: OTHER_USER })],
      })

      renderWithProviders(<GymManagementSection userId={ME} />)

      expect(screen.getByText(/Browse all gyms/i)).toBeInTheDocument()
      expect(screen.getByTestId('browse-gym-row-gym-only-join')).toBeInTheDocument()
    })

    it('shows Browse all gyms when more than one gym exists', () => {
      // Even if the user is a member of one gym, the second gym is only
      // discoverable through Browse, so it must remain visible.
      stubUseGyms({
        data: [makeGym({ id: 'gym-a', name: 'Alpha', ownerUserId: ME })],
      })
      stubUseAllGyms({
        data: [
          makeGym({ id: 'gym-a', name: 'Alpha', ownerUserId: ME }),
          makeGym({ id: 'gym-b', name: 'Bravo', ownerUserId: OTHER_USER }),
        ],
      })

      renderWithProviders(<GymManagementSection userId={ME} />)

      expect(screen.getByText(/Browse all gyms/i)).toBeInTheDocument()
      expect(screen.getByTestId('browse-gym-row-gym-b')).toBeInTheDocument()
    })

    it('shows Browse all gyms while data is still loading', () => {
      // Don't pop the section in/out -- render Browse so its own loading
      // indicator is shown until the queries resolve.
      stubUseGyms({ isLoading: true })
      stubUseAllGyms({ isLoading: true })

      renderWithProviders(<GymManagementSection userId={ME} />)

      expect(screen.getByText(/Browse all gyms/i)).toBeInTheDocument()
      expect(screen.getByTestId('browse-gyms-loading')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // (k) Pagination TODO marker -- removed per P14-048
  //
  // The previous test imported the source file via Vite's `?raw` query and
  // grep-asserted a comment string. That coupled the test to the exact
  // wording of a comment, which broke on cosmetic edits and caught no
  // behavioral regression. Pagination is tracked in
  // Context/Backlog/gym-management-pagination.md instead -- the source
  // file's TODO comment is descriptive scaffolding, not a test fixture.
  // -------------------------------------------------------------------------
})
