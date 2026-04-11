import { useState } from 'react'
import { createFileRoute, useNavigate, useBlocker } from '@tanstack/react-router'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'
import { EventTemplateForm } from '@/components/event-builder/event-template-form'
import { TemplateEditorLayout } from '@/components/session-builder/template-editor-layout'
import { ExercisePickerDrawer } from '@/components/session-builder/exercise-picker-drawer'
import { DirtyNavGuardDialog } from '@/components/session-builder/dirty-nav-guard-dialog'

type TemplateMode = 'session' | 'event'

function isTemplateMode(v: unknown): v is TemplateMode {
  return v === 'session' || v === 'event'
}

export const Route = createFileRoute('/_authenticated/templates/new')({
  validateSearch: (search: Record<string, unknown>): { mode: TemplateMode } => ({
    mode: isTemplateMode(search['mode']) ? search['mode'] : 'session',
  }),
  component: TemplateNewPage,
})

function TemplateNewPage() {
  const { mode } = Route.useSearch()
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

  const title = mode === 'event' ? 'New event' : 'New session'

  return (
    <>
      <TemplateEditorLayout title={title} onBack={backToLibrary}>
        {mode === 'event' ? (
          <EventTemplateForm
            onSave={backToLibrary}
            onCancel={backToLibrary}
            onDirtyChange={setDirty}
          />
        ) : (
          <SessionTemplateForm
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
