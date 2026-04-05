import { useNavigate } from '@tanstack/react-router'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

interface EventCountdownBadgeProps {
  eventName: string
  daysUntil: number
  templateId: string
}

export function EventCountdownBadge({
  eventName,
  daysUntil,
  templateId,
}: EventCountdownBadgeProps) {
  const navigate = useNavigate()

  const handleNavigate = () => navigate({ to: '/events/$templateId', params: { templateId } })

  return (
    <button
      onClick={handleNavigate}
      aria-label={`View event: ${eventName}`}
      className={cn(
        'flex w-full items-center gap-3 min-h-12 px-4 py-3',
        daysUntil <= 3 ? 'bg-ember/15' : 'bg-surface-iron',
      )}
    >
      <Icon name="flag" size={20} fill className="text-ember" />
      <div className="flex-1 text-left">
        <p
          className={cn(
            'font-display text-sm uppercase tracking-wider',
            daysUntil <= 3 ? 'text-ember' : 'text-bone-white',
          )}
        >
          {eventName}
        </p>
        <p className="text-xs tracking-widest text-warm-ash">
          {daysUntil === 0 ? 'TODAY' : `IN ${daysUntil} ${daysUntil === 1 ? 'DAY' : 'DAYS'}`}
        </p>
      </div>
      <Icon name="chevron_right" size={20} className="text-warm-ash" />
    </button>
  )
}
