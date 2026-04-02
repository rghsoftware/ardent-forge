import { Icon } from '@/components/icon'
import { underlineInput } from './styles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequirementData {
  _clientId: string
  key: string
  value: string
  unit: string
  notes: string
}

interface RequirementEditorProps {
  requirement: RequirementData
  onChange: (updated: RequirementData) => void
  onDelete: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequirementEditor({ requirement, onChange, onDelete }: RequirementEditorProps) {
  return (
    <div className="flex items-end gap-3">
      {/* Key */}
      <div className="flex-1">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          KEY
        </label>
        <input
          type="text"
          value={requirement.key}
          onChange={(e) => onChange({ ...requirement, key: e.target.value })}
          placeholder="e.g. Min Ruck Weight"
          className={underlineInput}
          aria-label="Requirement key"
        />
      </div>

      {/* Value */}
      <div className="w-20">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          VALUE
        </label>
        <input
          type="text"
          value={requirement.value}
          onChange={(e) => onChange({ ...requirement, value: e.target.value })}
          placeholder="30"
          className={underlineInput}
          aria-label="Requirement value"
        />
      </div>

      {/* Unit */}
      <div className="w-16">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          UNIT
        </label>
        <input
          type="text"
          value={requirement.unit}
          onChange={(e) => onChange({ ...requirement, unit: e.target.value })}
          placeholder="lb"
          className={underlineInput}
          aria-label="Requirement unit"
        />
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="mb-2 min-h-8 min-w-8 text-warm-ash hover:text-alarm-red"
        aria-label="Delete requirement"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}
