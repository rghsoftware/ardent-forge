import { useState, useCallback, useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useOnboarding } from '@/hooks/use-onboarding'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { useProgramFull, useCreateProgram, useUpdateProgram } from '@/hooks/use-programs'
import { useSessionTemplates } from '@/hooks/use-session-templates'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { ProgramForm } from '@/components/program-builder/program-form'
import { BlockList } from '@/components/program-builder/block-list'
import { MobileBlockEditor } from '@/components/program-builder/mobile-block-editor'
import { SessionPickerSheet } from '@/components/program-builder/session-picker-sheet'
import { SessionTemplateDialog } from '@/components/session-builder/session-template-dialog'
import { EventTemplateDialog } from '@/components/event-builder/event-template-dialog'
import { WorkoutPreviewSheet } from '@/components/workout/workout-preview-sheet'
import { CopyWeekDialog } from '@/components/program-builder/copy-week-dialog'
import {
  createEmptyDraft,
  hydrateDraft,
  assignSession,
  copyWeek,
  validateDraft,
  buildSavePayload,
} from '@/components/program-builder/builder-state'
import type {
  ProgramDraft,
  WeekDraft,
  ValidationError,
} from '@/components/program-builder/builder-state'
import type { DayOfWeek } from '@/components/program-builder/constants'
import { BLOCK_TYPE_STYLES } from '@/components/program-builder/constants'
import type { SessionType, SessionTemplate } from '@/domain/types'

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_authenticated/builder')({
  validateSearch: (search: Record<string, unknown>) => ({
    programId: typeof search['programId'] === 'string' ? search['programId'] : undefined,
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
  const { markRouteVisited } = useOnboarding()

  useEffect(() => {
    markRouteVisited('/builder')
  }, [markRouteVisited])

  // Draft state
  const [draft, setDraft] = useState<ProgramDraft>(createEmptyDraft)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)

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

  // Error state: fieldErrors for inline validation, error for server/auth failures
  const [fieldErrors, setFieldErrors] = useState<ValidationError[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showWeekends, setShowWeekends] = useState(false)

  // Template / event creation dialogs
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)

  // Mutations
  const createMutation = useCreateProgram()
  const updateMutation = useUpdateProgram()
  const isSaving = createMutation.isPending || updateMutation.isPending

  const userId = user?.id ?? ''

  // Edit mode: fetch existing program and resolve template names for display
  const { data: programFull, isLoading: isLoadingProgram } = useProgramFull(programId)
  const { data: sessionTemplates } = useSessionTemplates(userId || undefined)

  // Track last-hydrated ID to ensure we hydrate only once per program. Uses React's
  // "adjusting state during render" pattern instead of useEffect to avoid an extra render cycle.
  const [hydratedProgramId, setHydratedProgramId] = useState<string | null>(null)
  if (programFull && sessionTemplates && hydratedProgramId !== programFull.program.id) {
    const templateNames = new Map(sessionTemplates.map((t) => [t.id, t.name]))
    setHydratedProgramId(programFull.program.id)
    setDraft(hydrateDraft(programFull, templateNames))
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const clearErrors = useCallback(() => {
    setFieldErrors([])
    setError(null)
  }, [])

  const handleUpdateDraft = useCallback(
    (updated: ProgramDraft) => {
      setDraft(updated)
      clearErrors()
    },
    [clearErrors],
  )

  const handleDraftChange = useCallback(
    (updates: Partial<Pick<ProgramDraft, 'name' | 'description' | 'source'>>) => {
      setDraft((prev) => ({ ...prev, ...updates }))
      clearErrors()
    },
    [clearErrors],
  )

  const handlePickSession = useCallback((weekClientId: string, dayOfWeek: DayOfWeek) => {
    setPickerState({ weekClientId, dayOfWeek })
  }, [])

  const pickerStateRef = useRef(pickerState)
  useEffect(() => {
    pickerStateRef.current = pickerState
  }, [pickerState])

  const handleSessionSelected = useCallback(
    (templateId: string, templateName: string, sessionType: SessionType) => {
      const state = pickerStateRef.current
      if (!state) {
        console.warn('[builder] handleSessionSelected called with no active picker state')
        return
      }
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

  const handleTemplateCreated = useCallback(
    (template: SessionTemplate) => {
      const state = pickerStateRef.current
      if (state) {
        setDraft((prev) =>
          assignSession(
            prev,
            state.weekClientId,
            state.dayOfWeek,
            template.id,
            template.name,
            template.category,
          ),
        )
        setPickerState(null)
      }
      setShowCreateTemplate(false)
    },
    [],
  )

  const handleEventCreated = useCallback(
    (template: SessionTemplate) => {
      const state = pickerStateRef.current
      if (state) {
        setDraft((prev) =>
          assignSession(
            prev,
            state.weekClientId,
            state.dayOfWeek,
            template.id,
            template.name,
            template.category,
          ),
        )
        setPickerState(null)
      }
      setShowCreateEvent(false)
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
      setFieldErrors(errors)
      return
    }

    if (!userId) {
      console.error('[builder] Cannot save: no authenticated user')
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
  // Block navigation: scroll-to on click
  // ---------------------------------------------------------------------------

  const scrollBlock = useCallback((blockClientId: string) => {
    document
      .getElementById(`block-${blockClientId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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
      {/* Header bar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 pt-6 pb-4 lg:hidden">
        <div>
          <div className="flex items-center gap-3">
            <Icon name="construction" size={24} className="text-warm-ash" />
            <h1 className="font-display text-2xl font-medium text-bone-white">Program Builder</h1>
          </div>
          {programId && draft.name && (
            <p className="mt-1 text-xs font-medium text-warm-ash/60">Editing: {draft.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-warning-flare">{error}</p>}
          {fieldErrors.some((e) => e.field === 'blocks') && (
            <p className="text-xs text-warning-flare">
              {fieldErrors.find((e) => e.field === 'blocks')!.message}
            </p>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-forge text-on-forge text-xs hover:brightness-110"
          >
            {isSaving ? 'Saving...' : 'Save program'}
          </Button>
        </div>
      </div>

      {/* Large-screen header */}
      <div className="hidden items-center justify-between px-4 pt-6 pb-4 lg:flex lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <Icon name="construction" size={24} className="text-warm-ash" />
            <h1 className="font-display text-2xl font-medium text-bone-white">Program Builder</h1>
          </div>
          {programId && draft.name && (
            <p className="mt-1 text-xs font-medium text-warm-ash/60">Editing: {draft.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-warning-flare">{error}</p>}
          {fieldErrors.some((e) => e.field === 'blocks') && (
            <p className="text-xs text-warning-flare">
              {fieldErrors.find((e) => e.field === 'blocks')!.message}
            </p>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-forge text-on-forge text-xs hover:brightness-110"
          >
            {isSaving ? 'Saving...' : 'Save program'}
          </Button>
        </div>
      </div>

      {/* Onboarding hint */}
      <div className="px-4 lg:px-8">
        <OnboardingHint hintKey="builder-intro">
          Design your training program here. Add blocks, assign sessions to days, and set your
          progression.
        </OnboardingHint>
      </div>

      {/* Layout: independent scroll columns on large screens, stacked scroll on mobile */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[360px_1fr] lg:gap-6 lg:overflow-hidden lg:px-4">
        {/* Sidebar: program metadata + block navigation (sticky on large screens) */}
        <aside className="px-4 pb-6 lg:overflow-y-auto lg:px-0 lg:pb-8">
          <ProgramForm
            draft={draft}
            onChange={handleDraftChange}
            error={fieldErrors.find((e) => e.field === 'programName')?.message}
          />

          {/* Block navigation rail (large screen only) */}
          {draft.blocks.length > 0 && (
            <nav className="mt-8 hidden flex-col gap-1 lg:flex" aria-label="Block navigation">
              <span className="mb-1 text-xs font-medium uppercase tracking-wider text-warm-ash/60">
                Blocks
              </span>
              {draft.blocks.map((block, i) => (
                <button
                  key={block.clientId}
                  type="button"
                  onClick={() => scrollBlock(block.clientId)}
                  className="flex items-center gap-2 px-3 py-2 text-left transition-colors text-warm-ash hover:bg-surface-charcoal hover:text-bone-white"
                >
                  <span
                    className={`shrink-0 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${BLOCK_TYPE_STYLES[block.blockType] ?? 'bg-surface-steel text-warm-ash'}`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate font-display text-xs font-medium">
                    {block.name || 'Untitled block'}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-warm-ash/40">
                    {block.weeks.length}w
                  </span>
                </button>
              ))}
            </nav>
          )}
        </aside>

        {/* Workspace: block editors */}
        <div className="px-4 lg:overflow-y-auto lg:px-0 lg:pb-8">
          {/* Weekend toggle (large screen only) */}
          <div className="mb-3 hidden items-center justify-end md:flex">
            <button
              type="button"
              onClick={() => setShowWeekends((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                showWeekends
                  ? 'bg-forge/15 text-forge'
                  : 'bg-surface-steel text-warm-ash hover:text-bone-white'
              }`}
              aria-label={showWeekends ? 'Hide weekends' : 'Show weekends'}
            >
              <Icon name={showWeekends ? 'date_range' : 'calendar_view_week'} size={14} />
              {showWeekends ? '7 days' : '5 days'}
            </button>
          </div>

          {/* Large screen DnD builder */}
          <div className="hidden md:block">
            <BlockList
              draft={draft}
              onUpdate={handleUpdateDraft}
              onPickSession={handlePickSession}
              onPreviewSession={(id) => setPreviewTemplateId(id)}
              onCopyWeek={handleCopyWeek}
              showWeekends={showWeekends}
              fieldErrors={fieldErrors}
            />
          </div>
          {/* Mobile list editor */}
          <div className="block md:hidden">
            <MobileBlockEditor
              draft={draft}
              onUpdate={handleUpdateDraft}
              onPickSession={handlePickSession}
              onPreviewSession={(id) => setPreviewTemplateId(id)}
              onCopyWeek={handleCopyWeek}
              showWeekends={showWeekends}
              onToggleWeekends={() => setShowWeekends((prev) => !prev)}
              fieldErrors={fieldErrors}
            />
          </div>
        </div>
      </div>

      {/* Workout preview sheet */}
      <WorkoutPreviewSheet
        open={previewTemplateId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplateId(null)
        }}
        sessionTemplateId={previewTemplateId}
      />

      {/* Session picker sheet */}
      <SessionPickerSheet
        open={pickerState !== null}
        onOpenChange={(open) => {
          if (!open) setPickerState(null)
        }}
        onSelect={handleSessionSelected}
        onCreateTemplate={() => setShowCreateTemplate(true)}
        onCreateEvent={() => setShowCreateEvent(true)}
        userId={userId}
      />

      {/* Template / event creation dialogs */}
      <SessionTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        onSaved={handleTemplateCreated}
      />
      <EventTemplateDialog
        open={showCreateEvent}
        onOpenChange={setShowCreateEvent}
        onSaved={handleEventCreated}
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
    </div>
  )
}
