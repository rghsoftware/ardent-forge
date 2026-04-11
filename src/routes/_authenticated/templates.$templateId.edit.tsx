import { useState } from 'react'
import { createFileRoute, useNavigate, useBlocker } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'
import { EventTemplateForm } from '@/components/event-builder/event-template-form'
import { TemplateEditorLayout } from '@/components/session-builder/template-editor-layout'
import { ExercisePickerDrawer } from '@/components/session-builder/exercise-picker-drawer'
import { DirtyNavGuardDialog } from '@/components/session-builder/dirty-nav-guard-dialog'
import { useSessionTemplateFull } from '@/hooks/use-session-templates'
import type { SessionTemplateFull } from '@/lib/data-adapter'

export const Route = createFileRoute('/_authenticated/templates/$templateId/edit')({
  component: TemplateEditPage,
})

function TemplateEditPage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const [dirty, setDirty] = useState(false)

  const { status, proceed, reset } = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  })

  const backToLibrary = () => {
    void navigate({ to: '/library', search: { tab: 'templates' } })
  }

  const { data, isLoading, error } = useSessionTemplateFull(templateId)

  if (isLoading) {
    return (
      <TemplateEditorLayout title="Edit template" onBack={backToLibrary}>
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-10 w-full bg-surface-iron" />
          <Skeleton className="h-8 w-48 bg-surface-iron" />
          <Skeleton className="h-32 w-full bg-surface-iron" />
        </div>
      </TemplateEditorLayout>
    )
  }

  if (error) {
    return (
      <TemplateEditorLayout title="Edit template" onBack={backToLibrary}>
        <div className="flex flex-col items-center gap-2 p-4">
          <p className="text-center text-xs text-destructive">Failed to load template</p>
          <p className="text-center text-xs text-warm-ash/40">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
        </div>
      </TemplateEditorLayout>
    )
  }

  if (!data) {
    return (
      <TemplateEditorLayout title="Edit template" onBack={backToLibrary}>
        <div className="p-4 text-center text-xs text-warm-ash/60">Template not found</div>
      </TemplateEditorLayout>
    )
  }

  const full = data as SessionTemplateFull
  const isEvent = full.template.category === 'EVENT'
  const title = isEvent ? `Edit event: ${full.template.name}` : `Edit: ${full.template.name}`

  return (
    <>
      <TemplateEditorLayout title={title} onBack={backToLibrary}>
        {isEvent ? (
          <EventTemplateForm
            initial={full}
            onSave={backToLibrary}
            onCancel={backToLibrary}
            onDirtyChange={setDirty}
          />
        ) : (
          <SessionTemplateForm
            initial={full}
            onSave={backToLibrary}
            onCancel={backToLibrary}
            onDirtyChange={setDirty}
            PickerComponent={ExercisePickerDrawer}
          />
        )}
      </TemplateEditorLayout>
      <DirtyNavGuardDialog
        open={status === 'blocked'}
        onConfirm={() => proceed?.()}
        onCancel={() => reset?.()}
      />
    </>
  )
}
