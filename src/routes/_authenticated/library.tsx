import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import { SOURCE_LABELS } from '@/components/program-builder/constants'
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
import {
  usePrograms,
  useActiveProgram,
  useSetActiveProgram,
  useClearActiveProgram,
  useDeleteProgram,
} from '@/hooks/use-programs'
import { useAuth } from '@/lib/auth'
import type { Program } from '@/domain/types'

export const Route = createFileRoute('/_authenticated/library')({
  component: LibraryPage,
})

type LibraryTab = 'templates' | 'programs'

function LibraryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<LibraryTab>('templates')

  // Template state
  const { data: templates = [], isLoading, error } = useSessionTemplates(userId || undefined)
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

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
    } catch (err) {
      console.error('[library] Failed to delete template:', err)
    }
  }

  const handleSaved = () => {
    setSheetOpen(false)
    setEditingId(null)
  }

  const handleCancel = () => {
    setSheetOpen(false)
    setEditingId(null)
  }

  return (
    <div className="min-h-screen bg-surface-anvil pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-medium uppercase tracking-wider text-bone-white">
          LIBRARY
        </h1>
        {activeTab === 'templates' && (
          <Button
            variant="default"
            onClick={handleCreate}
            className="min-h-12 text-xs uppercase tracking-wider"
          >
            <Icon name="add" size={16} />
            CREATE TEMPLATE
          </Button>
        )}
        {activeTab === 'programs' && (
          <Button
            variant="default"
            onClick={() => navigate({ to: '/builder', search: { programId: undefined } })}
            className="min-h-12 bg-forge text-on-forge text-xs uppercase tracking-wider hover:brightness-110"
          >
            <Icon name="add" size={16} />
            CREATE PROGRAM
          </Button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-warm-ash/10 px-4" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-templates"
          aria-selected={activeTab === 'templates'}
          aria-controls="tabpanel-templates"
          onClick={() => setActiveTab('templates')}
          className={`min-h-12 px-4 pb-3 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'templates'
              ? 'border-b-2 border-ember text-ember'
              : 'text-warm-ash/60 hover:text-warm-ash'
          }`}
        >
          TEMPLATES
        </button>
        <button
          type="button"
          role="tab"
          id="tab-programs"
          aria-selected={activeTab === 'programs'}
          aria-controls="tabpanel-programs"
          onClick={() => setActiveTab('programs')}
          className={`min-h-12 px-4 pb-3 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'programs'
              ? 'border-b-2 border-ember text-ember'
              : 'text-warm-ash/60 hover:text-warm-ash'
          }`}
        >
          PROGRAMS
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'templates' ? (
        <div role="tabpanel" id="tabpanel-templates" aria-labelledby="tab-templates">
          <div className="flex flex-col gap-2 px-4 pt-4">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full bg-surface-iron" />
                <Skeleton className="h-16 w-full bg-surface-iron" />
                <Skeleton className="h-16 w-full bg-surface-iron" />
              </>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Icon name="error" size={48} className="text-destructive/60" />
                <p className="text-center text-xs uppercase tracking-wider text-destructive">
                  FAILED TO LOAD TEMPLATES
                </p>
                <p className="text-center text-xs text-warm-ash/40">
                  {error instanceof Error ? error.message : 'An unexpected error occurred.'}
                </p>
              </div>
            ) : templates.length === 0 ? (
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
              templates.map((template) => (
                <SessionTemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => handleEdit(template.id)}
                  onDelete={() => handleDelete(template.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="tabpanel-programs" aria-labelledby="tab-programs">
          <ProgramList userId={userId || undefined} />
        </div>
      )}

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
// Program list panel
// ---------------------------------------------------------------------------

function ProgramList({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate()
  const { data: programs = [], isLoading, error } = usePrograms(userId)
  const { data: activeProgram, error: activeProgramError } = useActiveProgram(userId)
  const setActiveMutation = useSetActiveProgram()
  const clearActiveMutation = useClearActiveProgram()
  const deleteProgramMutation = useDeleteProgram()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const programToDelete = programs.find((p) => p.id === confirmDeleteId)

  const handleActivate = async (programId: string) => {
    if (!userId) return
    try {
      await setActiveMutation.mutateAsync({ userId, programId })
    } catch (err) {
      console.error('[library] Failed to activate program:', err)
    }
  }

  const handleDeactivate = async () => {
    if (!userId) return
    try {
      await clearActiveMutation.mutateAsync(userId)
    } catch (err) {
      console.error('[library] Failed to deactivate program:', err)
    }
  }

  const handleEdit = (id: string) => {
    navigate({ to: '/builder', search: { programId: id } })
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProgramMutation.mutateAsync(id)
    } catch (err) {
      console.error('[library] Failed to delete program:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-4 pt-4">
        <Skeleton className="h-24 w-full bg-surface-iron" />
        <Skeleton className="h-24 w-full bg-surface-iron" />
        <Skeleton className="h-24 w-full bg-surface-iron" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16">
        <Icon name="error" size={48} className="text-destructive/60" />
        <p className="text-center text-xs uppercase tracking-wider text-destructive">
          FAILED TO LOAD PROGRAMS
        </p>
        <p className="text-center text-xs text-warm-ash/40">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
    )
  }

  if (programs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16">
        <Icon name="fitness_center" size={48} className="text-warm-ash/40" />
        <p className="text-center text-xs uppercase tracking-wider text-warm-ash/60">
          NO PROGRAMS YET
        </p>
        <p className="text-center text-xs text-warm-ash/40">
          Build a structured training program from the program builder.
        </p>
      </div>
    )
  }

  return (
    <>
      {activeProgramError && (
        <div className="mx-4 mt-4 rounded bg-warning-flare/10 px-3 py-2 text-xs text-warning-flare">
          Could not load active program status.
        </div>
      )}
      <div className="flex flex-col gap-2 px-4 pt-4">
        {programs.map((program) => {
          const isActive = activeProgram?.programId === program.id

          return (
            <ProgramCard
              key={program.id}
              program={program}
              isActive={isActive}
              onActivate={() => handleActivate(program.id)}
              onDeactivate={handleDeactivate}
              onEdit={() => handleEdit(program.id)}
              onDelete={() => setConfirmDeleteId(program.id)}
            />
          )
        })}
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-widest text-ember">
              DELETE PROGRAM
            </DialogTitle>
            <DialogDescription className="text-sm text-warm-ash">
              Are you sure you want to delete &quot;{programToDelete?.name}&quot;? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteId(null)}
              className="min-h-12 text-xs uppercase tracking-wider"
            >
              CANCEL
            </Button>
            <Button
              variant="destructive"
              disabled={deleteProgramMutation.isPending}
              onClick={async () => {
                if (confirmDeleteId) {
                  await handleDelete(confirmDeleteId)
                  setConfirmDeleteId(null)
                }
              }}
              className="min-h-12 text-xs uppercase tracking-wider"
            >
              {deleteProgramMutation.isPending ? 'DELETING...' : 'DELETE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Program card component
// ---------------------------------------------------------------------------

function ProgramCard({
  program,
  isActive,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
}: {
  program: Program
  isActive: boolean
  onActivate: () => void
  onDeactivate: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const totalWeeks = program.durationWeeks ?? 0

  return (
    <div className="flex w-full flex-col gap-3 bg-surface-iron px-4 py-4">
      {/* Top row: name + active indicator */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex flex-1 flex-col gap-1 text-left hover:opacity-80"
          aria-label={`Edit program ${program.name}`}
        >
          <span className="font-display text-sm font-medium text-bone-white">{program.name}</span>
          <div className="flex items-center gap-2">
            <Badge className="text-[10px]">{SOURCE_LABELS[program.source] ?? program.source}</Badge>
            {totalWeeks > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-warm-ash/60">
                {totalWeeks} {totalWeeks === 1 ? 'WEEK' : 'WEEKS'}
              </span>
            )}
          </div>
        </button>

        {isActive && (
          <span className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-ember">
            <Icon name="check_circle" size={14} fill className="text-ember" />
            ACTIVE
          </span>
        )}
      </div>

      {/* Bottom row: actions */}
      <div className="flex items-center gap-2">
        {isActive ? (
          <Button
            variant="ghost"
            onClick={onDeactivate}
            className="min-h-12 flex-1 text-xs uppercase tracking-wider text-warm-ash/60 hover:text-warning-flare"
          >
            DEACTIVATE
          </Button>
        ) : (
          <Button
            variant="default"
            onClick={onActivate}
            className="min-h-12 flex-1 text-xs uppercase tracking-wider"
          >
            ACTIVATE
          </Button>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={onDelete}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onDelete()
            }
          }}
          className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash/60 hover:text-warning-flare"
          aria-label={`Delete ${program.name}`}
        >
          <Icon name="delete" size={18} />
        </div>
      </div>
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
  const { data, isLoading, error } = useSessionTemplateFull(templateId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-full bg-surface-iron" />
        <Skeleton className="h-8 w-48 bg-surface-iron" />
        <Skeleton className="h-32 w-full bg-surface-iron" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-4">
        <p className="text-center text-xs uppercase tracking-wider text-destructive">
          FAILED TO LOAD TEMPLATE
        </p>
        <p className="text-center text-xs text-warm-ash/40">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
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
