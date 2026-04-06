import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CardioModality } from '@/domain/types'

const CARDIO_MODALITIES = [
  'RUNNING',
  'CYCLING',
  'SWIMMING',
  'ROWING',
  'RUCKING',
  'JUMP_ROPE',
  'STAIR_CLIMBER',
  'ELLIPTICAL',
] as const satisfies readonly CardioModality[]

interface CardioModalitySelectProps {
  value: CardioModality
  onChange: (m: CardioModality) => void
}

export function CardioModalitySelect({ value, onChange }: CardioModalitySelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        MODALITY
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as CardioModality)}>
        <SelectTrigger className="min-h-12 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-surface-gunmetal">
          {CARDIO_MODALITIES.map((m) => (
            <SelectItem key={m} value={m} className="text-xs uppercase">
              {m.replaceAll('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export type { CardioModalitySelectProps }
