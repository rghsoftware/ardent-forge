interface ScopeToggleProps {
  value: 'mine' | 'public'
  onChange: (value: 'mine' | 'public') => void
}

export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  return (
    <div className="inline-flex bg-surface-charcoal">
      <button
        type="button"
        onClick={() => onChange('mine')}
        className={`inline-flex min-h-[36px] flex-1 items-center justify-center px-4 py-1.5 text-xs font-medium uppercase tracking-wider ${
          value === 'mine' ? 'bg-surface-gunmetal text-ember' : 'text-warm-ash'
        }`}
      >
        MINE
      </button>
      <button
        type="button"
        onClick={() => onChange('public')}
        className={`inline-flex min-h-[36px] flex-1 items-center justify-center px-4 py-1.5 text-xs font-medium uppercase tracking-wider ${
          value === 'public' ? 'bg-surface-gunmetal text-ember' : 'text-warm-ash'
        }`}
      >
        PUBLIC
      </button>
    </div>
  )
}
