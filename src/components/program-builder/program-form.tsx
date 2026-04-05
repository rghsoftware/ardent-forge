import { useState, useId } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTrigger } from '@/components/ui/help-trigger'
import { SOURCE_HELP } from '@/components/builders/help-content'
import { Icon } from '@/components/icon'
import type { ProgramDraft } from './builder-state'
import type { ProgramSource } from '@/domain/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRAM_SOURCES: Array<{ value: ProgramSource; label: string }> = [
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'IMPORTED', label: 'Imported' },
  { value: 'SHARED', label: 'Shared' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
  { value: 'AI_GENERATED', label: 'AI Generated' },
  { value: 'COACH_ASSIGNED', label: 'Coach Assigned' },
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
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-warm-ash/60">
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
        className="flex items-center gap-1 text-xs font-medium text-warm-ash/80 hover:text-bone-white lg:hidden"
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
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-warm-ash/60">
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
          <Select
            value={draft.source}
            onValueChange={(v) => onChange({ source: v as ProgramSource })}
          >
            <SelectTrigger className="w-full border-warm-ash/30 bg-transparent text-sm text-bone-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRAM_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-warm-ash/60">
            DESCRIPTION (OPTIONAL)
          </span>
          <textarea
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Brief description of this program"
            rows={5}
            className="min-h-[120px] w-full resize-y border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            aria-label="Program description"
          />
        </div>
      </div>
    </div>
  )
}
