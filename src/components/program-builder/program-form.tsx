import type { ProgramDraft } from './builder-state'
import type { ProgramSource } from '@/domain/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRAM_SOURCES: Array<{ value: ProgramSource; label: string }> = [
  { value: 'CUSTOM', label: 'CUSTOM' },
  { value: 'TEMPLATE', label: 'TEMPLATE' },
  { value: 'IMPORTED', label: 'IMPORTED' },
  { value: 'SHARED', label: 'SHARED' },
  { value: 'MARKETPLACE', label: 'MARKETPLACE' },
  { value: 'AI_GENERATED', label: 'AI' },
  { value: 'COACH_ASSIGNED', label: 'COACH' },
]

// ---------------------------------------------------------------------------
// ProgramForm
// ---------------------------------------------------------------------------

interface ProgramFormProps {
  draft: ProgramDraft
  onChange: (updates: Partial<Pick<ProgramDraft, 'name' | 'description' | 'source'>>) => void
}

export function ProgramForm({ draft, onChange }: ProgramFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
          PROGRAM NAME
        </span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Program name"
          className="w-full border-0 border-b border-warm-ash/30 bg-transparent py-3 font-display text-lg font-medium text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Program name"
        />
      </div>

      <div>
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
          DESCRIPTION (OPTIONAL)
        </span>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Brief description of this program"
          rows={2}
          className="min-h-12 w-full resize-none border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Program description"
        />
      </div>

      <div>
        <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
          SOURCE
        </span>
        <div className="flex flex-wrap gap-1">
          {PROGRAM_SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ source: s.value })}
              className={`min-h-10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                draft.source === s.value
                  ? 'bg-forge text-on-forge'
                  : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
