import type { ReactElement } from 'react'
import type { Gym } from '@/domain/types'

interface GymDetailHeaderProps {
  gym: Gym
  ownerDisplayName: string | null
  memberCount: number
}

export function GymDetailHeader({
  gym,
  ownerDisplayName,
  memberCount,
}: GymDetailHeaderProps): ReactElement {
  return (
    <header className="bg-surface-iron px-4 py-6">
      <p className="font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash">
        GYM
      </p>
      <h1 className="mt-1 font-sans text-2xl font-semibold uppercase tracking-wider text-bone-white">
        {gym.name}
      </h1>
      <dl className="mt-4 flex gap-8">
        <div>
          <dt className="font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash">
            OWNER
          </dt>
          <dd className="mt-1 font-sans text-sm text-bone-white">
            {ownerDisplayName ?? 'Unknown'}
          </dd>
        </div>
        <div>
          <dt className="font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash">
            MEMBERS
          </dt>
          <dd className="mt-1 font-sans text-sm text-bone-white">{memberCount}</dd>
        </div>
      </dl>
    </header>
  )
}
