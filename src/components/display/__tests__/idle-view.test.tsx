// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IdleView } from '../idle-view'
import type { IdleSnapshot } from '@/domain/types'

const mockIdleSnapshot: IdleSnapshot = {
  server_time: '2026-04-04T14:30:00Z',
  scheduled_sessions: [
    {
      display_name: 'Robert',
      session_name: 'Push Day',
      session_type: 'STRENGTH',
      day_label: 'Day 1',
    },
    {
      display_name: 'Sarah',
      session_name: 'Pull Day',
      session_type: 'STRENGTH',
      day_label: 'Day 2',
    },
  ],
  next_session: { display_name: 'Robert', session_name: 'Push Day' },
}

describe('IdleView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-04T14:30:00'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders clock section (A-001, A-003)', () => {
    render(<IdleView idleSnapshot={null} clockFormat="24h" connectionStatus="connected" />)
    // ClockDisplay renders a time string; just verify the container is present
    expect(screen.getByText(/14:30:00/)).toBeInTheDocument()
  })

  it('renders date line in correct style', () => {
    render(<IdleView idleSnapshot={null} clockFormat="24h" connectionStatus="connected" />)
    // April 4, 2026 is a Saturday
    expect(screen.getByText(/Saturday, April 4/)).toBeInTheDocument()
  })

  it('renders session list when idleSnapshot has sessions (A-004)', () => {
    render(
      <IdleView idleSnapshot={mockIdleSnapshot} clockFormat="24h" connectionStatus="connected" />,
    )
    expect(screen.getByText("TODAY'S SESSIONS")).toBeInTheDocument()
    expect(screen.getByText('Robert')).toBeInTheDocument()
    expect(screen.getByText('Sarah')).toBeInTheDocument()
  })

  it('hides session list when idleSnapshot is null', () => {
    render(<IdleView idleSnapshot={null} clockFormat="24h" connectionStatus="connected" />)
    expect(screen.queryByText("TODAY'S SESSIONS")).not.toBeInTheDocument()
  })

  it('renders "NEXT UP" badge with ember styling when next_session present (A-005)', () => {
    render(
      <IdleView idleSnapshot={mockIdleSnapshot} clockFormat="24h" connectionStatus="connected" />,
    )
    expect(screen.getByText(/NEXT UP: Push Day/)).toBeInTheDocument()
  })

  it('hides "NEXT UP" badge when next_session is null (A-006)', () => {
    const snapshotWithoutNext: IdleSnapshot = {
      ...mockIdleSnapshot,
      next_session: null,
    }
    render(
      <IdleView
        idleSnapshot={snapshotWithoutNext}
        clockFormat="24h"
        connectionStatus="connected"
      />,
    )
    expect(screen.queryByText(/NEXT UP/)).not.toBeInTheDocument()
  })

  it('caps sessions at 3 rows when 4+ provided', () => {
    const snapshotWith4Sessions: IdleSnapshot = {
      ...mockIdleSnapshot,
      scheduled_sessions: [
        {
          display_name: 'Robert',
          session_name: 'Push Day',
          session_type: 'STRENGTH',
          day_label: 'Day 1',
        },
        {
          display_name: 'Sarah',
          session_name: 'Pull Day',
          session_type: 'STRENGTH',
          day_label: 'Day 2',
        },
        {
          display_name: 'Alex',
          session_name: 'Leg Day',
          session_type: 'STRENGTH',
          day_label: 'Day 3',
        },
        {
          display_name: 'Mike',
          session_name: 'Cardio',
          session_type: 'CONDITIONING',
          day_label: 'Day 4',
        },
      ],
    }
    render(
      <IdleView
        idleSnapshot={snapshotWith4Sessions}
        clockFormat="24h"
        connectionStatus="connected"
      />,
    )
    expect(screen.getByText('Robert')).toBeInTheDocument()
    expect(screen.getByText('Sarah')).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.queryByText('Mike')).not.toBeInTheDocument()
  })

  it('renders footer with "Connected" when connectionStatus is connected', () => {
    render(<IdleView idleSnapshot={null} clockFormat="24h" connectionStatus="connected" />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('renders footer with "Reconnecting..." when connectionStatus is reconnecting', () => {
    render(<IdleView idleSnapshot={null} clockFormat="24h" connectionStatus="reconnecting" />)
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument()
  })
})
