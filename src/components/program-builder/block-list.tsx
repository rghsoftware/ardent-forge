import { useCallback } from 'react'
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
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { BlockEditor } from './block-editor'
import { addBlock, reorderBlocks } from './builder-state'
import type { ProgramDraft } from './builder-state'

// ---------------------------------------------------------------------------
// Custom modifier: restrict drag to vertical axis
// ---------------------------------------------------------------------------

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})

// ---------------------------------------------------------------------------
// BlockList
// ---------------------------------------------------------------------------

interface BlockListProps {
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
  onCopyWeek?: (sourceWeekClientId: string) => void
}

export function BlockList({ draft, onUpdate, onPickSession, onCopyWeek }: BlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const fromIndex = draft.blocks.findIndex((b) => b.clientId === active.id)
      const toIndex = draft.blocks.findIndex((b) => b.clientId === over.id)

      if (fromIndex !== -1 && toIndex !== -1) {
        onUpdate(reorderBlocks(draft, fromIndex, toIndex))
      }
    },
    [draft, onUpdate],
  )

  const handleAddBlock = useCallback(() => {
    onUpdate(addBlock(draft, 'ACCUMULATION'))
  }, [draft, onUpdate])

  const blockIds = draft.blocks.map((b) => b.clientId)

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {draft.blocks.map((block) => (
            <BlockEditor
              key={block.clientId}
              block={block}
              draft={draft}
              onUpdate={onUpdate}
              onPickSession={onPickSession}
              onCopyWeek={onCopyWeek}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="secondary"
        onClick={handleAddBlock}
        className="min-h-12 w-full text-xs uppercase tracking-wider"
      >
        <Icon name="add" size={16} />
        ADD BLOCK
      </Button>
    </div>
  )
}
