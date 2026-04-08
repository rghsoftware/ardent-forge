// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useRef } from 'react'
import type { GymPickerChoice } from '@/lib/gym-picker-storage'

// ---------------------------------------------------------------------------
// Stub the GymPickerSheet so this test file focuses on the hook contract
// (imperative open / resolve / cancel), not the sheet's internals. The
// sheet has its own test file (gym-picker-sheet.test.tsx).
//
// The stub exposes data-testid buttons for the three exit paths so we can
// drive the hook deterministically from the test.
// ---------------------------------------------------------------------------

interface StubProps {
  open: boolean
  userId: string
  onResolve: (choice: GymPickerChoice) => void
  onCancel: () => void
}

vi.mock('@/components/workout/gym-picker-sheet', () => ({
  GymPickerSheet: ({ open, userId, onResolve, onCancel }: StubProps) => {
    if (!open) return null
    return (
      <div data-testid="gym-picker-stub" data-user-id={userId}>
        <button type="button" data-testid="pick-gym-a" onClick={() => onResolve('gym-a')}>
          Pick A
        </button>
        <button type="button" data-testid="pick-gym-b" onClick={() => onResolve('gym-b')}>
          Pick B
        </button>
        <button type="button" data-testid="pick-private" onClick={() => onResolve('private')}>
          Pick Private
        </button>
        <button type="button" data-testid="cancel-picker" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  },
}))

// Import after mock
import { useGymPicker } from '../use-gym-picker'

// ---------------------------------------------------------------------------
// Test harness: a component that mounts the hook, exposes its API via a
// ref callback, and renders the portal inline. This lets the test drive
// the hook from outside while observing DOM changes inside.
// ---------------------------------------------------------------------------

type OpenFn = (args: { userId: string }) => Promise<GymPickerChoice | null>

function Harness({ apiRef }: { apiRef: (api: OpenFn) => void }) {
  const { openGymPicker, GymPickerPortal } = useGymPicker()
  const openRef = useRef(openGymPicker)
  // React 19 forbids mutating refs during render (react-hooks/refs);
  // update the ref after commit so the wrapper closure below always
  // reads the latest openGymPicker without re-binding apiRef.
  useEffect(() => {
    openRef.current = openGymPicker
  }, [openGymPicker])

  useEffect(() => {
    apiRef((args) => openRef.current(args))
    // apiRef is captured once; the wrapper closure always sees the latest
    // openGymPicker via the ref above.
  }, [apiRef])

  return <GymPickerPortal />
}

function renderHarness(): { open: OpenFn } {
  let openFn: OpenFn = () => Promise.resolve(null)
  render(<Harness apiRef={(fn) => (openFn = fn)} />)
  return {
    open: (args) => openFn(args),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGymPicker', () => {
  // -------------------------------------------------------------------------
  // Portal rendering
  // -------------------------------------------------------------------------

  it('renders nothing until openGymPicker is called', () => {
    renderHarness()
    expect(screen.queryByTestId('gym-picker-stub')).not.toBeInTheDocument()
  })

  it('mounts the picker with the provided userId after openGymPicker is called', async () => {
    const { open } = renderHarness()

    act(() => {
      void open({ userId: 'user-1' })
    })

    const stub = await screen.findByTestId('gym-picker-stub')
    expect(stub).toHaveAttribute('data-user-id', 'user-1')
  })

  // -------------------------------------------------------------------------
  // (a) Resolve with choice
  // -------------------------------------------------------------------------

  it('resolves the returned promise with the gym id when the picker fires onResolve', async () => {
    const user = userEvent.setup()
    const { open } = renderHarness()

    let openPromise: Promise<GymPickerChoice | null> | null = null
    act(() => {
      openPromise = open({ userId: 'user-1' })
    })

    await screen.findByTestId('gym-picker-stub')

    await user.click(screen.getByTestId('pick-gym-a'))

    await expect(openPromise!).resolves.toBe('gym-a')
  })

  it('resolves with "private" when the Private row is picked', async () => {
    const user = userEvent.setup()
    const { open } = renderHarness()

    let openPromise: Promise<GymPickerChoice | null> | null = null
    act(() => {
      openPromise = open({ userId: 'user-1' })
    })

    await screen.findByTestId('gym-picker-stub')

    await user.click(screen.getByTestId('pick-private'))

    await expect(openPromise!).resolves.toBe('private')
  })

  it('closes the portal after a choice is resolved', async () => {
    const user = userEvent.setup()
    const { open } = renderHarness()

    act(() => {
      void open({ userId: 'user-1' })
    })

    await screen.findByTestId('gym-picker-stub')

    await user.click(screen.getByTestId('pick-gym-a'))

    await waitFor(() => {
      expect(screen.queryByTestId('gym-picker-stub')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // (c) Cancel resolves with null
  // -------------------------------------------------------------------------

  it('resolves with null when the picker fires onCancel', async () => {
    const user = userEvent.setup()
    const { open } = renderHarness()

    let openPromise: Promise<GymPickerChoice | null> | null = null
    act(() => {
      openPromise = open({ userId: 'user-1' })
    })

    await screen.findByTestId('gym-picker-stub')

    await user.click(screen.getByTestId('cancel-picker'))

    await expect(openPromise!).resolves.toBeNull()
  })

  it('closes the portal after cancellation', async () => {
    const user = userEvent.setup()
    const { open } = renderHarness()

    act(() => {
      void open({ userId: 'user-1' })
    })

    await screen.findByTestId('gym-picker-stub')

    await user.click(screen.getByTestId('cancel-picker'))

    await waitFor(() => {
      expect(screen.queryByTestId('gym-picker-stub')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // (b) Double-open replaces the previous promise
  // -------------------------------------------------------------------------

  it('resolves the prior promise with null when openGymPicker is called a second time', async () => {
    const user = userEvent.setup()
    const { open } = renderHarness()

    let firstPromise: Promise<GymPickerChoice | null> | null = null
    let secondPromise: Promise<GymPickerChoice | null> | null = null

    act(() => {
      firstPromise = open({ userId: 'user-1' })
    })
    await screen.findByTestId('gym-picker-stub')

    act(() => {
      secondPromise = open({ userId: 'user-2' })
    })

    // First promise should resolve to null synchronously from the second call
    await expect(firstPromise!).resolves.toBeNull()

    // The picker should still be mounted, now for the new user
    const stub = await screen.findByTestId('gym-picker-stub')
    expect(stub).toHaveAttribute('data-user-id', 'user-2')

    // The second promise should resolve with whatever the user picks next
    await user.click(screen.getByTestId('pick-gym-b'))
    await expect(secondPromise!).resolves.toBe('gym-b')
  })
})
