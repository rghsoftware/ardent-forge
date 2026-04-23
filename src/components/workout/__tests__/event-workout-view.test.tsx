// @vitest-environment happy-dom
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import type { EventMetadata } from '@/domain/types'

// ---------------------------------------------------------------------------
// Captured prop refs (vi.hoisted so mocks can reference them)
// ---------------------------------------------------------------------------
const { capturedPausedBarProps, capturedErrorBannerProps } = vi.hoisted(() => {
  const capturedPausedBarProps = { current: null as null | { onDiscard: () => void; canFinish: boolean } }
  const capturedErrorBannerProps = { current: null as null | { onDismiss: () => void; message?: string } }
  return { capturedPausedBarProps, capturedErrorBannerProps }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/components/workout/workout-header', () => ({
  WorkoutHeader: () => <div data-testid="workout-header" />,
}))

vi.mock('@/components/workout/workout-paused-bar', () => ({
  WorkoutPausedBar: (props: { onDiscard: () => void; canFinish: boolean }) => {
    capturedPausedBarProps.current = props
    return <div data-testid="workout-paused-bar" />
  },
}))

vi.mock('@/components/workout/error-banner', () => ({
  ErrorBanner: (props: { onDismiss: () => void; message?: string }) => {
    capturedErrorBannerProps.current = props
    return <div data-testid="error-banner">{props.message}</div>
  },
}))

vi.mock('@/components/workout/workout-header-menu', () => ({
  WorkoutHeaderMenu: () => null,
}))

vi.mock('@/components/event-builder/event-detail', () => ({
  EventDetail: () => null,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

// Import after mocks
import { EventWorkoutView } from '../event-workout-view'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const fakeEventMetadata: EventMetadata = {
  requirements: [],
}

interface EventWorkoutViewProps {
  workoutLog: { id: string; eventMetadata: EventMetadata }
  elapsedSeconds: number
  isPauseSupported: boolean
  isPaused: boolean
  handlePause: () => void
  handleResume: () => void
  handleFinish: () => Promise<void>
  handleDiscard: () => Promise<void>
  isBroadcasting: boolean
  publishFocus: () => void
  publishUnfocus: () => void
  isFinishing: boolean
  isDiscarding: boolean
  pageError: string | null
  setPageError: (error: string | null) => void
  showDiscardDialog: boolean
  setShowDiscardDialog: (open: boolean) => void
}

function makeProps(overrides: Partial<EventWorkoutViewProps> = {}): EventWorkoutViewProps {
  return {
    workoutLog: { id: 'wl-1', eventMetadata: fakeEventMetadata },
    elapsedSeconds: 0,
    isPauseSupported: false,
    isPaused: false,
    handlePause: vi.fn(),
    handleResume: vi.fn(),
    handleFinish: vi.fn().mockResolvedValue(undefined),
    handleDiscard: vi.fn().mockResolvedValue(undefined),
    isBroadcasting: false,
    publishFocus: vi.fn(),
    publishUnfocus: vi.fn(),
    isFinishing: false,
    isDiscarding: false,
    pageError: null,
    setPageError: vi.fn(),
    showDiscardDialog: false,
    setShowDiscardDialog: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('EventWorkoutView', () => {
  beforeEach(() => {
    capturedPausedBarProps.current = null
    capturedErrorBannerProps.current = null
  })

  describe('discard dialog -- triggered by WorkoutPausedBar.onDiscard', () => {
    it('calls setShowDiscardDialog(true) when onDiscard is invoked', () => {
      const setShowDiscardDialog = vi.fn()
      render(<EventWorkoutView {...makeProps({ setShowDiscardDialog })} />)

      act(() => {
        capturedPausedBarProps.current!.onDiscard()
      })

      expect(setShowDiscardDialog).toHaveBeenCalledWith(true)
    })
  })

  describe('cancel path -- dialog closes, handleDiscard NOT called', () => {
    it('calls setShowDiscardDialog(false) on Cancel and does not call handleDiscard', async () => {
      const user = userEvent.setup()
      const setShowDiscardDialog = vi.fn()
      const handleDiscard = vi.fn().mockResolvedValue(undefined)

      render(
        <EventWorkoutView
          {...makeProps({ showDiscardDialog: true, setShowDiscardDialog, handleDiscard })}
        />,
      )

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(setShowDiscardDialog).toHaveBeenCalledWith(false)
      expect(handleDiscard).not.toHaveBeenCalled()
    })
  })

  describe('discard path -- handleDiscard IS called', () => {
    it('calls handleDiscard when Discard button is clicked', async () => {
      const user = userEvent.setup()
      const handleDiscard = vi.fn().mockResolvedValue(undefined)

      render(
        <EventWorkoutView {...makeProps({ showDiscardDialog: true, handleDiscard })} />,
      )

      await user.click(screen.getByRole('button', { name: /^discard$/i }))

      expect(handleDiscard).toHaveBeenCalledTimes(1)
    })
  })

  describe('canFinish is always true', () => {
    it('passes canFinish={true} to WorkoutPausedBar', () => {
      render(<EventWorkoutView {...makeProps()} />)
      expect(capturedPausedBarProps.current!.canFinish).toBe(true)
    })
  })

  describe('pageError renders ErrorBanner and is dismissible', () => {
    it('renders the error message when pageError is set', () => {
      render(<EventWorkoutView {...makeProps({ pageError: 'Something went wrong' })} />)
      expect(screen.getByTestId('error-banner')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('calls setPageError(null) when onDismiss is invoked', () => {
      const setPageError = vi.fn()
      render(
        <EventWorkoutView {...makeProps({ pageError: 'Something went wrong', setPageError })} />,
      )

      act(() => {
        capturedErrorBannerProps.current!.onDismiss()
      })

      expect(setPageError).toHaveBeenCalledWith(null)
    })

    it('does not render ErrorBanner when pageError is null', () => {
      render(<EventWorkoutView {...makeProps({ pageError: null })} />)
      expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument()
    })
  })

  describe('discard dialog content', () => {
    it('renders correct title and description when dialog is open', () => {
      render(<EventWorkoutView {...makeProps({ showDiscardDialog: true })} />)
      expect(screen.getByText('Discard workout')).toBeInTheDocument()
      expect(
        screen.getByText(/all logged sets will be permanently deleted/i),
      ).toBeInTheDocument()
    })

    it('does not render dialog content when showDiscardDialog is false', () => {
      render(<EventWorkoutView {...makeProps({ showDiscardDialog: false })} />)
      expect(screen.queryByText('Discard workout')).not.toBeInTheDocument()
    })
  })
})
