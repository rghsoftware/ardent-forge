import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DisplaySet } from '@/domain/types/display-snapshot'

interface SetTableProps {
  sets: DisplaySet[]
}

function SetTable({ sets }: SetTableProps) {
  // The current set is the first incomplete set
  const currentSetNumber = sets.find((s) => !s.completed)?.set_number ?? null

  return (
    <table className="mt-6 w-full">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left font-sans text-base uppercase tracking-wider text-warm-ash">
            Set
          </th>
          <th className="px-4 py-2 text-left font-sans text-base uppercase tracking-wider text-warm-ash">
            Prescribed
          </th>
          <th className="px-4 py-2 text-left font-sans text-base uppercase tracking-wider text-warm-ash">
            Actual
          </th>
          <th className="px-4 py-2 text-left font-sans text-base uppercase tracking-wider text-warm-ash">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {sets.map((set, index) => {
          const isCurrent = set.set_number === currentSetNumber

          return (
            <tr
              key={set.set_number}
              className={cn(
                'h-12',
                index % 2 === 0 ? 'bg-surface-charcoal' : 'bg-surface-anvil',
                isCurrent && 'border-l-2 border-ember',
              )}
            >
              <td className="px-4 py-2 font-sans text-[1.25rem] text-bone-white">
                {set.set_number}
              </td>
              <td className="px-4 py-2 font-sans text-[1.25rem] text-bone-white">
                {set.prescribed
                  ? `${set.prescribed.weight.value} ${set.prescribed.weight.unit} x ${set.prescribed.reps}`
                  : '--'}
              </td>
              <td className="px-4 py-2 font-sans text-[1.25rem] text-bone-white">
                {set.actual
                  ? `${set.actual.weight.value} ${set.actual.weight.unit} x ${set.actual.reps}`
                  : '--'}
              </td>
              <td className="px-4 py-2">
                {set.completed && (
                  <CheckCircle2
                    className="h-6 w-6 text-arc"
                    aria-label={`Set ${set.set_number} completed`}
                  />
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export { SetTable }
