import type { IdleSnapshot } from '@/domain/types'
import { ClockDisplay } from './clock-display'

interface IdleViewProps {
  idleSnapshot: IdleSnapshot | null
  clockFormat: '12h' | '24h'
  connectionStatus: 'connected' | 'reconnecting'
}

export function IdleView({ idleSnapshot, clockFormat, connectionStatus }: IdleViewProps) {
  const sessions = idleSnapshot?.scheduled_sessions ?? []
  const visibleSessions = sessions.slice(0, 3)
  const nextSession = idleSnapshot?.next_session ?? null

  const dateString = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex h-dvh flex-col bg-[#131313]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <ClockDisplay format={clockFormat} serverTimeCorrection={idleSnapshot?.server_time} />
        <p className="font-body text-2xl text-secondary">{dateString}</p>
      </div>

      {visibleSessions.length > 0 && (
        <div className="flex flex-col items-center gap-4 px-8 pb-8">
          <h2 className="font-display text-xl uppercase tracking-widest text-secondary">
            TODAY&apos;S SESSIONS
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {visibleSessions.map((session) => (
              <div
                key={`${session.display_name}-${session.session_name}`}
                className="flex flex-col gap-1 bg-[#201F1F] px-8 py-6"
              >
                <span className="font-display text-2xl text-foreground">
                  {session.display_name}
                </span>
                <span className="font-body text-xl uppercase tracking-widest text-secondary">
                  {session.session_type} &middot; {session.day_label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {nextSession && (
        <div className="flex justify-center px-8 pb-6">
          <div className="bg-[#353534] px-8 py-4">
            <span className="font-display text-xl uppercase tracking-widest text-[#FFB59C]">
              NEXT UP: {nextSession.session_name}
            </span>
          </div>
        </div>
      )}

      <div className="flex w-full items-center justify-center bg-[#0E0E0E] py-3">
        <span className="font-body text-xl text-secondary">
          {connectionStatus === 'connected' ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>
    </div>
  )
}
