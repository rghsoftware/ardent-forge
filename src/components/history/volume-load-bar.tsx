import { cn } from '@/lib/utils'

interface VolumeLoadBarProps {
  value: number
  maxValue: number
  label?: string
  className?: string
}

export function VolumeLoadBar({ value, maxValue, label, className }: VolumeLoadBarProps) {
  const widthPct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className="w-16 shrink-0 text-right font-body text-xs tabular-nums text-warm-ash">
          {label}
        </span>
      )}
      <div className="h-[8px] flex-1 bg-surface-steel">
        <div className="h-full bg-ember transition-all" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  )
}
