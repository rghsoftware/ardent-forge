import type { ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { useGymRoster } from '@/hooks/use-gym-members'

interface GymRosterProps {
  gymId: string
  /** If provided, renders a per-row kick control (owner-only surface). */
  onKick?: (userId: string) => void
  kickingUserId?: string | null
}

export function GymRoster({ gymId, onKick, kickingUserId }: GymRosterProps): ReactElement {
  const { data, isLoading, isError } = useGymRoster(gymId)

  if (isLoading) {
    return (
      <p data-testid="gym-roster-loading" className="px-4 py-6 text-xs text-warm-ash">
        Loading roster...
      </p>
    )
  }

  if (isError) {
    return (
      <p
        data-testid="gym-roster-error"
        className="px-4 py-6 text-xs text-warning-flare"
        role="alert"
      >
        Failed to load roster. Check your connection and try again.
      </p>
    )
  }

  const members = data ?? []
  if (members.length === 0) {
    return (
      <p data-testid="gym-roster-empty" className="px-4 py-6 text-xs text-warm-ash">
        No members yet.
      </p>
    )
  }

  return (
    <section className="bg-surface-charcoal/40 px-4 py-4">
      <h2 className="font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash">
        ROSTER
      </h2>
      <table className="mt-3 w-full" data-testid="gym-roster-table">
        <thead>
          <tr>
            <th className="pb-2 text-left font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash">
              MEMBER
            </th>
            <th className="pb-2 text-left font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash">
              JOINED
            </th>
            {onKick && <th className="pb-2" />}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} data-testid={`gym-roster-row-${m.userId}`}>
              <td className="py-2 font-sans text-sm text-bone-white">
                {m.displayName ?? 'Anonymous'}
              </td>
              <td className="py-2 font-sans text-xs text-warm-ash">
                {new Date(m.joinedAt).toLocaleDateString()}
              </td>
              {onKick && (
                <td className="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`gym-roster-kick-${m.userId}`}
                    className="min-h-[48px] text-xs text-warning-flare hover:bg-warning-flare/10"
                    onClick={() => onKick(m.userId)}
                    disabled={kickingUserId === m.userId}
                  >
                    {kickingUserId === m.userId ? 'Kicking...' : 'Kick'}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
