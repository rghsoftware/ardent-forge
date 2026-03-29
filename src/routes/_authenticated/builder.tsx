import { useState, useCallback, useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useProgramFull, useCreateProgram, useUpdateProgram } from '@/hooks/use-programs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { ProgramForm } from '@/components/program-builder/program-form'
import { BlockList } from '@/components/program-builder/block-list'
import { MobileBlockEditor } from '@/components/program-builder/mobile-block-editor'
import { SessionPickerSheet } from '@/components/program-builder/session-picker-sheet'
import { CopyWeekDialog } from '@/components/program-builder/copy-week-dialog'
import { ProgramPreview } from '@/components/program-builder/program-preview'
import {
  createEmptyDraft,
  hydrateDraft,
  assignSession,
  copyWeek,
  validateDraft,
  buildSavePayload,
} from '@/components/program-builder/builder-state'
import type { ProgramDraft, WeekDraft } from '@/components/program-builder/builder-state'
import type { DayOfWeek } from '@/components/program-builder/constants'
import type { SessionType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_authenticated/builder')({
  validateSearch: (search: Record<string, unknown>) => ({
    programId: search['programId'] as string | undefined,
  }),
  component: BuilderPage,
})

// ---------------------------------------------------------------------------
// BuilderPage
// ---------------------------------------------------------------------------

function BuilderPage() {
  const { programId } = Route.useSearch()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Draft state
  const [draft, setDraft] = useState<ProgramDraft>(createEmptyDraft)

  // Session picker state
  const [pickerState, setPickerState] = useState<{
    weekClientId: string
    dayOfWeek: DayOfWeek
  } | null>(null)

  // Copy week dialog state
  const [copyWeekState, setCopyWeekState] = useState<{
    sourceWeek: WeekDraft
    allWeeks: WeekDraft[]
  } | null>(null)

  // Error and preview state
  const [error, setError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  // Mutations
  const createMutation = useCreateProgram()
  const updateMutation = useUpdateProgram()
  const isSaving = createMutation.isPending || updateMutation.isPending

  // Edit mode: fetch existing program
  const { data: programFull, isLoading: isLoadingProgram } = useProgramFull(programId)

  // Track last-hydrated ID to ensure we hydrate only once per program. Uses React's
  // "adjusting state during render" pattern instead of useEffect to avoid an extra render cycle.
  const [hydratedProgramId, setHydratedProgramId] = useState<string | null>(null)
  if (programFull && hydratedProgramId !== programFull.program.id) {
    setHydratedProgramId(programFull.program.id)
    setDraft(hydrateDraft(programFull))
  }

  const userId = user?.id ?? ''

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleUpdateDraft = useCallback((updated: ProgramDraft) => {
    setDraft(updated)
    setError(null)
  }, [])

  const handleDraftChange = useCallback(
    (updates: Partial<Pick<ProgramDraft, 'name' | 'description' | 'source'>>) => {
      setDraft((prev) => ({ ...prev, ...updates }))
      setError(null)
    },
    [],
  )

  const handlePickSession = useCallback((weekClientId: string, dayOfWeek: DayOfWeek) => {
    setPickerState({ weekClientId, dayOfWeek })
  }, [])

  const pickerStateRef = useRef(pickerState)
  useEffect(() => {
    pickerStateRef.current = pickerState
  })

  const handleSessionSelected = useCallback(
    (templateId: string, templateName: string, sessionType: SessionType) => {
      const state = pickerStateRef.current
      if (!state) return
      setDraft((prev) =>
        assignSession(
          prev,
          state.weekClientId,
          state.dayOfWeek,
          templateId,
          templateName,
          sessionType,
        ),
      )
      setPickerState(null)
    },
    [],
  )

  const handleCopyWeek = useCallback(
    (sourceWeekClientId: string) => {
      // Find the source week and its block's weeks
      for (const block of draft.blocks) {
        const sourceWeek = block.weeks.find((w) => w.clientId === sourceWeekClientId)
        if (sourceWeek) {
          setCopyWeekState({ sourceWeek, allWeeks: block.weeks })
          return
        }
      }
    },
    [draft.blocks],
  )

  const handleCopyConfirm = useCallback(
    (targetWeekClientIds: string[]) => {
      if (!copyWeekState) return
      setDraft((prev) => copyWeek(prev, copyWeekState.sourceWeek.clientId, targetWeekClientIds))
      setCopyWeekState(null)
    },
    [copyWeekState],
  )

  const handleSave = useCallback(async () => {
    const errors = validateDraft(draft)
    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    if (!userId) {
      setError('You must be signed in to save a program')
      return
    }

    try {
      const payload = buildSavePayload(draft, userId)

      if (payload.mode === 'update') {
        await updateMutation.mutateAsync({
          program: payload.program,
          blocks: payload.blocks,
        })
      } else {
        await createMutation.mutateAsync({
          program: payload.program,
          blocks: payload.blocks,
        })
      }

      navigate({ to: '/library' })
    } catch (err) {
      const action = draft.id ? 'update' : 'create'
      console.error(`[builder] Failed to ${action} program:`, err)
      setError(`Failed to ${action} program. Please try again.`)
    }
  }, [draft, userId, createMutation, updateMutation, navigate])

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (programId && isLoadingProgram) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48 bg-surface-iron" />
        <Skeleton className="h-12 w-full bg-surface-iron" />
        <Skeleton className="h-12 w-full bg-surface-iron" />
        <Skeleton className="h-64 w-full bg-surface-iron" />
        <Skeleton className="h-64 w-full bg-surface-iron" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col bg-surface-anvil font-body text-bone-white">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 px-4 pt-8 pb-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate({ to: '/library' })}
          className="min-h-10 text-xs uppercase tracking-wider text-warm-ash hover:text-bone-white"
        >
          <Icon name="arrow_back" size={16} />
          BACK TO LIBRARY
        </Button>

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          onClick={() => setPreviewMode(true)}
          className="min-h-10 text-xs uppercase tracking-wider text-warm-ash hover:text-bone-white"
        >
          <Icon name="visibility" size={16} />
          PREVIEW
        </Button>
      </div>

      <div className="flex-shrink-0 px-4 pb-6">
        <h1 className="font-display text-2xl font-medium uppercase tracking-wider text-bone-white">
          PROGRAM BUILDER
        </h1>
        {programId && draft.name && (
          <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
            EDITING: {draft.name}
          </p>
        )}
      </div>

      {/* Layout: sidebar + content on desktop, stacked on mobile */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[320px_1fr] lg:gap-6 lg:px-4">
        {/* Sidebar: Program form */}
        <div className="px-4 pb-6 lg:px-0">
          <ProgramForm draft={draft} onChange={handleDraftChange} />
        </div>

        {/* Main content: Block list */}
        <div className="px-4 lg:px-0">
          {/* Desktop DnD builder */}
          <div className="hidden md:block">
            <BlockList
              draft={draft}
              onUpdate={handleUpdateDraft}
              onPickSession={handlePickSession}
              onCopyWeek={handleCopyWeek}
            />
          </div>
          {/* Mobile list editor */}
          <div className="block md:hidden">
            <MobileBlockEditor
              draft={draft}
              onUpdate={handleUpdateDraft}
              onPickSession={handlePickSession}
              onCopyWeek={handleCopyWeek}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex-shrink-0 px-4 pt-6 pb-8">
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-12 w-full bg-forge text-on-forge text-xs uppercase tracking-wider hover:brightness-110"
        >
          {isSaving ? 'SAVING...' : 'SAVE PROGRAM'}
        </Button>

        {error && <p className="mt-2 text-xs text-warning-flare">{error}</p>}
      </div>

      {/* Session picker sheet */}
      <SessionPickerSheet
        open={pickerState !== null}
        onOpenChange={(open) => {
          if (!open) setPickerState(null)
        }}
        onSelect={handleSessionSelected}
        userId={userId}
      />

      {/* Copy week dialog */}
      {copyWeekState && (
        <CopyWeekDialog
          open={copyWeekState !== null}
          onOpenChange={(open) => {
            if (!open) setCopyWeekState(null)
          }}
          sourceWeek={copyWeekState.sourceWeek}
          allWeeks={copyWeekState.allWeeks}
          onCopy={handleCopyConfirm}
        />
      )}

      {/* Program preview overlay */}
      <ProgramPreview draft={draft} open={previewMode} onClose={() => setPreviewMode(false)} />
    </div>
  )
}
