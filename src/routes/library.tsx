import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import { SessionTemplateCard } from '@/components/session-builder/session-template-card'
import {
  SessionTemplateForm,
  type SessionTemplateFull,
} from '@/components/session-builder/session-template-form'
import {
  useSessionTemplates,
  useSessionTemplateFull,
  useDeleteSessionTemplate,
} from '@/hooks/use-session-templates'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/library')({
  component: LibraryPage,
})

function LibraryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { data: templates = [], isLoading } = useSessionTemplates(userId || undefined)
  const deleteMutation = useDeleteSessionTemplate()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleCreate = () => {
    setEditingId(null)
    setSheetOpen(true)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setSheetOpen(true)
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const handleSaved = () => {
    setSheetOpen(false)
    setEditingId(null)
  }

  const handleCancel = () => {
    setSheetOpen(false)
    setEditingId(null)
  }

  // Build enriched template list with group/exercise counts
  const enrichedTemplates = templates.map((t) => ({
    ...t,
    groupCount: 0,
    exerciseCount: 0,
  }))

  return (
    <div className="min-h-screen bg-surface-anvil pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-medium uppercase tracking-wider text-bone-white">
          LIBRARY
        </h1>
        <Button
          variant="default"
          onClick={handleCreate}
          className="min-h-12 text-xs uppercase tracking-wider"
        >
          <Icon name="add" size={16} />
          CREATE TEMPLATE
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 px-4">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full bg-surface-iron" />
            <Skeleton className="h-16 w-full bg-surface-iron" />
            <Skeleton className="h-16 w-full bg-surface-iron" />
          </>
        ) : enrichedTemplates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Icon name="description" size={48} className="text-warm-ash/40" />
            <p className="text-center text-xs uppercase tracking-wider text-warm-ash/60">
              NO TEMPLATES YET
            </p>
            <p className="text-center text-xs text-warm-ash/40">
              Create your first session template.
            </p>
          </div>
        ) : (
          enrichedTemplates.map((template) => (
            <SessionTemplateCard
              key={template.id}
              template={template}
              onEdit={() => handleEdit(template.id)}
              onDelete={() => handleDelete(template.id)}
            />
          ))
        )}
      </div>

      {/* Template form sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[95vh] overflow-y-auto bg-surface-anvil p-0"
          showCloseButton={false}
        >
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle className="text-xs uppercase tracking-widest text-ember">
              {editingId ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {editingId ? 'Edit an existing session template' : 'Create a new session template'}
            </SheetDescription>
          </SheetHeader>

          <div className="pt-2">
            {editingId ? (
              <EditTemplateFormLoader
                templateId={editingId}
                onSave={handleSaved}
                onCancel={handleCancel}
              />
            ) : (
              <SessionTemplateForm onSave={handleSaved} onCancel={handleCancel} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loader for edit mode -- fetches the full template data
// ---------------------------------------------------------------------------

function EditTemplateFormLoader({
  templateId,
  onSave,
  onCancel,
}: {
  templateId: string
  onSave: () => void
  onCancel: () => void
}) {
  const { data, isLoading } = useSessionTemplateFull(templateId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-full bg-surface-iron" />
        <Skeleton className="h-8 w-48 bg-surface-iron" />
        <Skeleton className="h-32 w-full bg-surface-iron" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-xs uppercase tracking-wider text-warm-ash/60">
        TEMPLATE NOT FOUND
      </div>
    )
  }

  return (
    <SessionTemplateForm
      initial={data as SessionTemplateFull}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}
