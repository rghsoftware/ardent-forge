interface VaultMetricCardProps {
  label: string
  value: string | number
  subValue?: string
}

export function VaultMetricCard({ label, value, subValue }: VaultMetricCardProps) {
  return (
    <div className="bg-surface-iron p-4">
      <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
        {label}
      </span>
      <p className="mt-1 font-display text-readout text-bone-white">{value}</p>
      {subValue && <span className="font-body text-xs text-warm-ash/60">{subValue}</span>}
    </div>
  )
}
