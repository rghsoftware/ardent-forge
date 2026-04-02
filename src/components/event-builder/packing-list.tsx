import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import {
  useEventItems,
  useToggleEventItemPacked,
  useReorderEventItems,
} from '@/hooks/use-event-items'
import type { EventItem } from '@/domain/types'
import { PackingItem } from './packing-item'
import { EventProgressBar } from './event-progress-bar'

// ---------------------------------------------------------------------------
// Custom modifier: restrict drag to vertical axis
// ---------------------------------------------------------------------------

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PackingListProps {
  parentId: string
  parentType: 'template' | 'log'
  interactive?: boolean
}

// ---------------------------------------------------------------------------
// PackingList -- categorized checklist with progress bars
// ---------------------------------------------------------------------------

export function PackingList({ parentId, parentType, interactive }: PackingListProps) {
  const { data: items = [] } = useEventItems(parentId, parentType)
  const toggleMutation = useToggleEventItemPacked(parentId)
  const reorderMutation = useReorderEventItems(parentId)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Error feedback for mutations
  const [mutationError, setMutationError] = useState<string | null>(null)

  useEffect(() => {
    if (toggleMutation.isError) {
      setMutationError('Failed to toggle item. Please try again.')
    } else if (reorderMutation.isError) {
      setMutationError('Failed to reorder items. Please try again.')
    }
  }, [toggleMutation.isError, reorderMutation.isError])

  useEffect(() => {
    if (!mutationError) return
    const timer = setTimeout(() => setMutationError(null), 4000)
    return () => clearTimeout(timer)
  }, [mutationError])

  // Track collapsed categories
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  // Group items by category
  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const item of items) {
      const cat = item.category || 'UNCATEGORIZED'
      const list = map.get(cat) || []
      list.push(item)
      map.set(cat, list)
    }
    return map
  }, [items])

  // Overall counts
  const totalCount = items.length
  const packedCount = items.filter((i) => i.isPacked).length

  const handleToggle = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    toggleMutation.mutate({ itemId, isPacked: !item.isPacked })
  }

  const toggleCollapse = (category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Find which category this drag is within
    const activeItem = items.find((i) => i.id === active.id)
    const overItem = items.find((i) => i.id === over.id)
    if (!activeItem || !overItem) return
    if (activeItem.category !== overItem.category) return // don't allow cross-category drag

    // Get items in this category, compute new sort orders
    const catKey = activeItem.category || 'UNCATEGORIZED'
    const categoryItems = grouped.get(catKey) || []
    const oldIndex = categoryItems.findIndex((i) => i.id === active.id)
    const newIndex = categoryItems.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Array splice to reorder
    const reordered = [...categoryItems]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    // Assign new sequential sort orders
    const updates = reordered.map((item, idx) => ({ id: item.id, sortOrder: idx }))
    reorderMutation.mutate(updates)
  }

  if (items.length === 0) {
    return <div className="py-6 text-center text-sm tracking-widest text-warm-ash/60">NO ITEMS</div>
  }

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <EventProgressBar packed={packedCount} total={totalCount} />

      {/* Mutation error feedback */}
      {mutationError && <p className="text-xs text-destructive">{mutationError}</p>}

      {/* Categories */}
      {Array.from(grouped.entries()).map(([category, categoryItems]) => {
        const catPacked = categoryItems.filter((i) => i.isPacked).length
        const catTotal = categoryItems.length
        const allPacked = catPacked === catTotal && catTotal > 0
        const isCollapsed = collapsed.has(category)

        return (
          <div key={category}>
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCollapse(category)}
              className="flex min-h-10 w-full items-center justify-between text-left"
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${category} section`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash">
                  {category}
                </span>
                {allPacked && <Icon name="check_circle" size={14} fill className="text-ember" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] tracking-widest text-warm-ash/60">
                  {catPacked}/{catTotal}
                </span>
                <Icon
                  name={isCollapsed ? 'expand_more' : 'expand_less'}
                  size={18}
                  className="text-warm-ash"
                />
              </div>
            </button>

            {/* Category items */}
            {!isCollapsed && (
              <div className={cn('border-l-2 border-surface-steel ml-1')}>
                {interactive ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={categoryItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {categoryItems.map((item) => (
                        <PackingItem
                          key={item.id}
                          item={item}
                          interactive={interactive}
                          onToggle={handleToggle}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  categoryItems.map((item) => (
                    <PackingItem key={item.id} item={item} interactive={false} />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
