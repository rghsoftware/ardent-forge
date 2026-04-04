import { useState, useId } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { HelpTrigger } from '@/components/ui/help-trigger'
import { SOURCE_HELP } from '@/components/builders/help-content'
import { Icon } from '@/components/icon'
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
  error?: string
}

export function ProgramForm({ draft, onChange, error }: ProgramFormProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()

  return (
    <div className="flex flex-col gap-6">
      {/* Program name -- always visible */}
      <div>
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
          PROGRAM NAME
        </span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Program name"
          className={`w-full border-0 border-b bg-transparent py-3 font-display text-lg font-medium text-bone-white placeholder:text-warm-ash/40 focus:outline-none ${
            error
              ? 'border-warning-flare focus:border-warning-flare'
              : 'border-warm-ash/30 focus:border-ember'
          }`}
          aria-label="Program name"
          aria-invalid={!!error}
        />
        {error && <p className="mt-1 text-xs text-warning-flare">{error}</p>}
      </div>

      {/* Mobile details toggle (hidden on desktop) */}
      <button
        type="button"
        onClick={() => setDetailsOpen((prev) => !prev)}
        className="flex items-center gap-1 text-[11px] font-medium text-warm-ash/60 hover:text-warm-ash lg:hidden"
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
      >
        <Icon name="tune" size={14} />
        {detailsOpen ? 'Hide details' : 'Show details'}
        <Icon name={detailsOpen ? 'expand_less' : 'expand_more'} size={14} className="ml-auto" />
      </button>

      {/* Details: always visible on lg+, toggled on mobile */}
      <div id={detailsId} className={`flex flex-col gap-6 ${detailsOpen ? '' : 'hidden lg:flex'}`}>
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
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
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
              SOURCE
            </span>
            <HelpTrigger
              title="Program Sources"
              content={
                <div className="space-y-3">
                  {Object.values(SOURCE_HELP).map((source) => (
                    <div key={source.label}>
                      <p className="font-medium text-bone-white">{source.label}</p>
                      <p>{source.description}</p>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
          <ToggleGroup
            type="single"
            value={draft.source}
            onValueChange={(v) => {
              if (v) onChange({ source: v as ProgramSource })
            }}
            className="flex flex-wrap gap-1"
          >
            {PROGRAM_SOURCES.map((s) => (
              <ToggleGroupItem
                key={s.value}
                value={s.value}
                className="min-h-10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
              >
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  )
}
