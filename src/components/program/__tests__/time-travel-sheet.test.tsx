// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import { TimeTravelSheet } from '@/components/program/time-travel-sheet'
import type { ProgramActivation } from '@/domain/types'
import type { ProgramFull } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const mockUpdateActiveProgram = vi.fn().mockResolvedValue({})
vi.mock('@/lib/adapter', () => ({
  getAdapter: () => ({
    updateActiveProgram: mockUpdateActiveProgram,
  }),
}))

const mockUpsertStatusesAsync = vi.fn().mockResolvedValue({})
vi.mock('@/hooks/use-week-statuses', () => ({
  useWeekStatuses: () => ({
    upsertStatusesAsync: mockUpsertStatusesAsync,
    isUpserting: false,
  }),
}))

const mockComputePosition = vi.fn()
const mockComputeDateFromPosition = vi.fn()
const mockValidatePosition = vi.fn()
vi.mock('@/lib/program-position', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/program-position')>()
  return {
    ...actual,
    computePositionFromDate: (...args: unknown[]) => mockComputePosition(...args),
    computeDateFromPosition: (...args: unknown[]) => mockComputeDateFromPosition(...args),
    validateProgramPosition: (...args: unknown[]) => mockValidatePosition(...args),
  }
})

// ---------------------------------------------------------------------------
// Test data: 2 blocks, Block 1 has 3 weeks, Block 2 has 2 weeks
// ---------------------------------------------------------------------------

const testBlocks = [
  {
    id: 'block-1',
    programId: 'prog-1',
    name: 'Accumulation',
    ordinal: 1,
    durationWeeks: 3,
    blockType: 'ACCUMULATION' as const,
  },
  {
    id: 'block-2',
    programId: 'prog-1',
    name: 'Intensification',
    ordinal: 2,
    durationWeeks: 2,
    blockType: 'INTENSIFICATION' as const,
  },
]

const testBlockWeeks = [
  { id: 'bw-1', blockId: 'block-1', weekNumber: 1 },
  { id: 'bw-2', blockId: 'block-1', weekNumber: 2 },
  { id: 'bw-3', blockId: 'block-1', weekNumber: 3 },
  { id: 'bw-4', blockId: 'block-2', weekNumber: 1 },
  { id: 'bw-5', blockId: 'block-2', weekNumber: 2 },
]

const testProgram = {
  id: 'prog-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  userId: 'user-1',
  name: 'Test Program',
  source: 'CUSTOM' as const,
  durationWeeks: 5,
  isPublic: false,
  createdBy: 'user-1',
}

const testActivation: ProgramActivation = {
  id: 'pa-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  userId: 'user-1',
  programId: 'prog-1',
  currentBlockOrdinal: 1,
  currentWeekNumber: 1,
  startDate: '2025-06-01',
}

const testProgramFull: ProgramFull = {
  program: testProgram,
  blocks: testBlocks,
  blockWeeks: testBlockWeeks,
  scheduledSessions: [],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSheet(overrides?: Partial<Parameters<typeof TimeTravelSheet>[0]>) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    activation: testActivation,
    programFull: testProgramFull,
  }
  return renderWithProviders(<TimeTravelSheet {...defaultProps} {...overrides} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimeTravelSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidatePosition.mockReturnValue(true)
    mockComputePosition.mockReturnValue({ blockOrdinal: 1, weekNumber: 2 })
    mockComputeDateFromPosition.mockReturnValue('2025-05-25')
  })

  // -----------------------------------------------------------------------
  // 1. Renders with current start date and position
  // -----------------------------------------------------------------------

  it('renders the sheet title', () => {
    renderSheet()
    expect(screen.getByText('Time Travel')).toBeInTheDocument()
  })

  it('renders the start date input with activation start date', () => {
    renderSheet()
    const dateInput = screen.getByLabelText('Program start date') as HTMLInputElement
    expect(dateInput).toBeInTheDocument()
    expect(dateInput.value).toBe('2025-06-01')
  })

  it('renders a single Save button (disabled when nothing changed)', () => {
    renderSheet()
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled()
  })

  // -----------------------------------------------------------------------
  // 2. Changing start date syncs position selectors
  // -----------------------------------------------------------------------

  it('updates position selectors when start date changes', async () => {
    mockComputePosition.mockReturnValue({ blockOrdinal: 1, weekNumber: 2 })
    const user = userEvent.setup()
    renderSheet()

    const dateInput = screen.getByLabelText('Program start date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, '2025-05-25')

    // The change summary should reflect the new position
    expect(screen.getByText(/Accumulation, Week 2/)).toBeInTheDocument()
  })

  it('enables Save button when start date changes', async () => {
    mockComputePosition.mockReturnValue({ blockOrdinal: 1, weekNumber: 2 })
    const user = userEvent.setup()
    renderSheet()

    const dateInput = screen.getByLabelText('Program start date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, '2025-05-25')

    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  // -----------------------------------------------------------------------
  // 3. Forward jump shows skip label UI for intermediate weeks
  // -----------------------------------------------------------------------

  it('shows intermediate weeks with skip labels on forward jump', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-04')
    const user = userEvent.setup()
    renderSheet()

    const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
    await user.click(blockTrigger)
    const option = await screen.findByText('2. Intensification')
    await user.click(option)

    expect(screen.getByText('Skipped weeks')).toBeInTheDocument()
    expect(screen.getByText('Accumulation, Week 2')).toBeInTheDocument()
    expect(screen.getByText('Accumulation, Week 3')).toBeInTheDocument()
  })

  it('shows bulk label buttons for intermediate weeks', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-04')
    const user = userEvent.setup()
    renderSheet()

    const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
    await user.click(blockTrigger)
    const option = await screen.findByText('2. Intensification')
    await user.click(option)

    expect(screen.getByText('All done')).toBeInTheDocument()
    expect(screen.getByText('All skipped')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // 4. Backward jump hides skip label UI
  // -----------------------------------------------------------------------

  it('does not show skip labels on backward jump', () => {
    const backwardActivation: ProgramActivation = {
      ...testActivation,
      currentBlockOrdinal: 2,
      currentWeekNumber: 2,
    }
    renderSheet({ activation: backwardActivation })

    expect(screen.queryByText('Skipped weeks')).not.toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // 5. Skip label toggles work
  // -----------------------------------------------------------------------

  it('toggles individual week skip labels', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-04')
    const user = userEvent.setup()
    renderSheet()

    const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
    await user.click(blockTrigger)
    const option = await screen.findByText('2. Intensification')
    await user.click(option)

    const weekRow = screen.getByText('Accumulation, Week 2').closest('div')!
    const doneBtn = within(weekRow).getByText('Done')
    const skippedBtn = within(weekRow).getByText('Skipped')
    const unmarkedBtn = within(weekRow).getByText('Unmarked')

    expect(unmarkedBtn).toHaveAttribute('aria-pressed', 'true')

    await user.click(doneBtn)
    expect(doneBtn).toHaveAttribute('aria-pressed', 'true')
    expect(unmarkedBtn).toHaveAttribute('aria-pressed', 'false')

    await user.click(skippedBtn)
    expect(skippedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(doneBtn).toHaveAttribute('aria-pressed', 'false')
  })

  // -----------------------------------------------------------------------
  // 6. Bulk label buttons
  // -----------------------------------------------------------------------

  it('marks all intermediate weeks as done via bulk button', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-04')
    const user = userEvent.setup()
    renderSheet()

    const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
    await user.click(blockTrigger)
    const option = await screen.findByText('2. Intensification')
    await user.click(option)

    await user.click(screen.getByText('All done'))

    const doneButtons = screen.getAllByText('Done')
    for (const btn of doneButtons) {
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('marks all intermediate weeks as skipped via bulk button', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-04')
    const user = userEvent.setup()
    renderSheet()

    const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
    await user.click(blockTrigger)
    const option = await screen.findByText('2. Intensification')
    await user.click(option)

    await user.click(screen.getByText('All skipped'))

    const skippedButtons = screen.getAllByText('Skipped')
    for (const btn of skippedButtons) {
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('clears all labels via Clear bulk button', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-04')
    const user = userEvent.setup()
    renderSheet()

    const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
    await user.click(blockTrigger)
    const option = await screen.findByText('2. Intensification')
    await user.click(option)

    await user.click(screen.getByText('All done'))
    await user.click(screen.getByText('Clear'))

    const unmarkedButtons = screen.getAllByText('Unmarked')
    for (const btn of unmarkedButtons) {
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    }
  })

  // -----------------------------------------------------------------------
  // 7. Invalid position
  // -----------------------------------------------------------------------

  it('shows error message when position is invalid', async () => {
    mockValidatePosition.mockReturnValue(false)
    mockComputeDateFromPosition.mockReturnValue('2025-05-25')
    const user = userEvent.setup()
    renderSheet()

    const weekTrigger = screen.getByText('Week').closest('div')!.querySelector('button')!
    await user.click(weekTrigger)
    const weekOption = await screen.findByText('Week 2')
    await user.click(weekOption)

    expect(screen.getByText('This position does not exist in the program.')).toBeInTheDocument()
  })

  it('disables Save button when position is invalid', async () => {
    mockValidatePosition.mockReturnValue(false)
    mockComputeDateFromPosition.mockReturnValue('2025-05-25')
    const user = userEvent.setup()
    renderSheet()

    const weekTrigger = screen.getByText('Week').closest('div')!.querySelector('button')!
    await user.click(weekTrigger)
    const weekOption = await screen.findByText('Week 2')
    await user.click(weekOption)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  // -----------------------------------------------------------------------
  // 8. Change summary shows before/after position
  // -----------------------------------------------------------------------

  it('shows current and new position summary on valid position change', async () => {
    mockValidatePosition.mockReturnValue(true)
    mockComputeDateFromPosition.mockReturnValue('2025-05-25')
    const user = userEvent.setup()
    renderSheet()

    const weekTrigger = screen.getByText('Week').closest('div')!.querySelector('button')!
    await user.click(weekTrigger)
    const weekOption = await screen.findByText('Week 2')
    await user.click(weekOption)

    expect(screen.getByText(/Current:/)).toBeInTheDocument()
    expect(screen.getByText(/Accumulation, Week 1/)).toBeInTheDocument()
    expect(screen.getByText(/New:/)).toBeInTheDocument()
    expect(screen.getByText(/Accumulation, Week 2/)).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // 9. Save via start date change
  // -----------------------------------------------------------------------

  describe('save via start date change', () => {
    async function changeStartDate(user: ReturnType<typeof userEvent.setup>, date: string) {
      const dateInput = screen.getByLabelText('Program start date') as HTMLInputElement
      await user.clear(dateInput)
      await user.type(dateInput, date)
    }

    it('calls updateActiveProgram with start date and computed position', async () => {
      mockComputePosition.mockReturnValue({ blockOrdinal: 1, weekNumber: 2 })
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onOpenChange })

      await changeStartDate(user, '2025-05-25')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(mockUpdateActiveProgram).toHaveBeenCalledWith('user-1', {
        startDate: '2025-05-25',
        currentBlockOrdinal: 1,
        currentWeekNumber: 2,
      })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('renders error when updateActiveProgram rejects', async () => {
      mockComputePosition.mockReturnValue({ blockOrdinal: 1, weekNumber: 2 })
      mockUpdateActiveProgram.mockRejectedValueOnce(new Error('Network error'))
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onOpenChange })

      await changeStartDate(user, '2025-05-25')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })
  })

  // -----------------------------------------------------------------------
  // 10. Save via position change
  // -----------------------------------------------------------------------

  describe('save via position change', () => {
    async function jumpToBlock2(user: ReturnType<typeof userEvent.setup>) {
      const blockTrigger = screen.getByText('Block').closest('div')!.querySelector('button')!
      await user.click(blockTrigger)
      const option = await screen.findByText('2. Intensification')
      await user.click(option)
    }

    async function jumpToWeek2(user: ReturnType<typeof userEvent.setup>) {
      const weekTrigger = screen.getByText('Week').closest('div')!.querySelector('button')!
      await user.click(weekTrigger)
      const weekOption = await screen.findByText('Week 2')
      await user.click(weekOption)
    }

    it('calls updateActiveProgram with back-calculated start date and position', async () => {
      mockValidatePosition.mockReturnValue(true)
      mockComputeDateFromPosition.mockReturnValue('2025-05-25')
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onOpenChange })

      await jumpToWeek2(user)
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(mockUpdateActiveProgram).toHaveBeenCalledWith('user-1', {
        startDate: '2025-05-25',
        currentBlockOrdinal: 1,
        currentWeekNumber: 2,
      })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls upsertStatusesAsync with labeled weeks only (filters out unmarked)', async () => {
      mockValidatePosition.mockReturnValue(true)
      mockComputeDateFromPosition.mockReturnValue('2025-05-04')
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onOpenChange })

      await jumpToBlock2(user)

      const week2Row = screen.getByText('Accumulation, Week 2').closest('div')!
      await user.click(within(week2Row).getByText('Done'))

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(mockUpsertStatusesAsync).toHaveBeenCalledWith([
        { blockOrdinal: 1, weekNumber: 2, status: 'done' },
      ])
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('does not call upsertStatusesAsync when all intermediate weeks are unmarked', async () => {
      mockValidatePosition.mockReturnValue(true)
      mockComputeDateFromPosition.mockReturnValue('2025-05-04')
      const user = userEvent.setup()
      renderSheet()

      await jumpToBlock2(user)
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(mockUpdateActiveProgram).toHaveBeenCalled()
      expect(mockUpsertStatusesAsync).not.toHaveBeenCalled()
    })

    it('renders error when updateActiveProgram rejects', async () => {
      mockValidatePosition.mockReturnValue(true)
      mockComputeDateFromPosition.mockReturnValue('2025-05-25')
      mockUpdateActiveProgram.mockRejectedValueOnce(new Error('DB error'))
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onOpenChange })

      await jumpToWeek2(user)
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
      expect(mockUpsertStatusesAsync).not.toHaveBeenCalled()
    })

    it('renders step-2 error when upsertStatusesAsync rejects', async () => {
      mockValidatePosition.mockReturnValue(true)
      mockComputeDateFromPosition.mockReturnValue('2025-05-04')
      mockUpsertStatusesAsync.mockRejectedValueOnce(new Error('Upsert failed'))
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onOpenChange })

      await jumpToBlock2(user)
      await user.click(screen.getByText('All done'))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(mockUpdateActiveProgram).toHaveBeenCalled()
      expect(
        screen.getByText('Position updated, but week labels failed to save. Please try again.'),
      ).toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })
  })

  // -----------------------------------------------------------------------
  // 11. Does not render when closed
  // -----------------------------------------------------------------------

  it('does not render content when open is false', () => {
    renderSheet({ open: false })
    expect(screen.queryByText('Time Travel')).not.toBeInTheDocument()
  })
})
