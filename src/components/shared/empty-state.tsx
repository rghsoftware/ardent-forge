import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: string
  heading: string
  subtext?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, heading, subtext, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-8 py-16 text-center',
        className,
      )}
    >
      <Icon name={icon} size={48} className="text-warm-ash/30" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-heading text-warm-ash">{heading}</p>
        {subtext && <p className="text-xs text-warm-ash/50 leading-relaxed">{subtext}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
