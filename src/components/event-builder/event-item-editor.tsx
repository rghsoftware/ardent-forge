import { Icon } from '@/components/icon'
import { underlineInput } from './styles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftEventItem {
  _clientId: string
  id?: string
  name: string
  category: string
  quantity: number
  notes: string
}

interface EventItemEditorProps {
  item: DraftEventItem
  onChange: (updated: DraftEventItem) => void
  onDelete: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventItemEditor({ item, onChange, onDelete }: EventItemEditorProps) {
  return (
    <div className="flex items-end gap-3">
      {/* Name */}
      <div className="flex-[2]">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          ITEM
        </label>
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          placeholder="e.g. Ruck plate"
          className={underlineInput}
          aria-label="Item name"
        />
      </div>

      {/* Category */}
      <div className="flex-1">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          CATEGORY
        </label>
        <input
          type="text"
          value={item.category}
          onChange={(e) => onChange({ ...item, category: e.target.value })}
          placeholder="Gear"
          className={underlineInput}
          aria-label="Item category"
        />
      </div>

      {/* Quantity */}
      <div className="w-16">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          QTY
        </label>
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) =>
            onChange({ ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) })
          }
          className={underlineInput}
          aria-label="Item quantity"
        />
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="mb-2 min-h-8 min-w-8 text-warm-ash hover:text-alarm-red"
        aria-label="Delete item"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}
