interface UnderlineNumberInputProps {
  value: number | undefined
  onChange: (v: number) => void
  placeholder?: string
  label: string
  min?: number
  max?: number
  step?: number
  className?: string
}

export function UnderlineNumberInput({
  value,
  onChange,
  placeholder,
  label,
  min,
  max,
  step,
  className = '',
}: UnderlineNumberInputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(isNaN(n) ? 0 : n)
        }}
        placeholder={placeholder ?? '--'}
        min={min}
        max={max}
        step={step}
        className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
        aria-label={label}
      />
    </div>
  )
}

export type { UnderlineNumberInputProps }
