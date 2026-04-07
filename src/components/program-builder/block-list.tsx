import { useCallback, useEffect, useState } from 'react'
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
import { EmptyState } from '@/components/shared/empty-state'
import { BlockEditor } from './block-editor'
import { addBlock, reorderBlocks } from './builder-state'
import type { ProgramDraft, ValidationError } from './builder-state'
import type { DayOfWeek } from './constants'

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
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onPreviewSession?: (sessionTemplateId: string) => void
  onCopyWeek?: (sourceWeekClientId: string) => void
  showWeekends: boolean
  fieldErrors?: ValidationError[]
}

export function BlockList({
  draft,
  onUpdate,
  onPickSession,
  onPreviewSession,
  onCopyWeek,
  showWeekends,
  fieldErrors = [],
}: BlockListProps) {
  const [newBlockId, setNewBlockId] = useState<string | null>(null)

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
    const updated = addBlock(draft, 'ACCUMULATION')
    const newBlock = updated.blocks[updated.blocks.length - 1]
    setNewBlockId(newBlock.clientId)
    onUpdate(updated)
  }, [draft, onUpdate])

  useEffect(() => {
    if (newBlockId) {
      const t = setTimeout(() => setNewBlockId(null), 350)
      return () => clearTimeout(t)
    }
  }, [newBlockId])

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
              onPreviewSession={onPreviewSession}
              onCopyWeek={onCopyWeek}
              showWeekends={showWeekends}
              isNew={block.clientId === newBlockId}
              errors={fieldErrors.filter((e) => e.blockClientId === block.clientId)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {draft.blocks.length === 0 && (
        <EmptyState
          icon="dashboard_customize"
          heading="Start by adding your first training block."
          className="py-12"
        />
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={handleAddBlock}
        className="min-h-12 w-full text-xs"
      >
        <Icon name="add" size={16} />
        Add block
      </Button>
    </div>
  )
}
