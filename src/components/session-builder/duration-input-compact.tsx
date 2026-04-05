import { DurationInput } from './inputs'
import type { Duration } from '@/domain/types'

/**
 * @deprecated Use `<DurationInput size="compact" />` from `./inputs` instead.
 */
export function DurationInputCompact({
  value,
  onChange,
  label,
}: {
  value: Duration | undefined
  onChange: (d: Duration | undefined) => void
  label: string
}) {
  return <DurationInput value={value} onChange={onChange} label={label} size="compact" />
}
