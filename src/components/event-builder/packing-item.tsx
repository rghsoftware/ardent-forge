import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import type { EventItem } from '@/domain/types'

// ---------------------------------------------------------------------------
// PackingItem -- single checkbox row in the packing list
// ---------------------------------------------------------------------------

interface PackingItemProps {
  item: EventItem
  interactive?: boolean
  onToggle?: (itemId: string) => void
}

export function PackingItem({ item, interactive, onToggle }: PackingItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 min-h-12 px-2',
        item.isPacked && 'opacity-50',
        isDragging && 'opacity-50 z-10',
      )}
      {...attributes}
    >
      {interactive && (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          type="button"
          className="cursor-grab touch-none text-warm-ash"
          aria-label="Drag to reorder"
        >
          <Icon name="drag_indicator" size={20} />
        </button>
      )}
      <button
        type="button"
        onClick={() => interactive && onToggle?.(item.id)}
        disabled={!interactive}
        className="flex-shrink-0"
        aria-label={item.isPacked ? `Unpack ${item.name}` : `Pack ${item.name}`}
      >
        <Icon
          name={item.isPacked ? 'check_circle' : 'radio_button_unchecked'}
          size={24}
          fill={item.isPacked}
          className={item.isPacked ? 'text-ember' : 'text-warm-ash'}
        />
      </button>
      <span className={cn('flex-1 text-bone-white', item.isPacked && 'line-through')}>
        {item.name}
      </span>
      {item.quantity > 1 && <span className="text-xs text-warm-ash">x{item.quantity}</span>}
    </div>
  )
}
