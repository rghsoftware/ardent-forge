import { useState, useEffect } from 'react'
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
import { ShareDialog } from '@/components/sharing/share-dialog'
import { TimeTravelSheet } from '@/components/program/time-travel-sheet'
import { SOURCE_LABELS } from '@/components/program-builder/constants'
import { SessionTemplateCard } from '@/components/session-builder/session-template-card'
import { EventCard } from '@/components/event-builder/event-card'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import { EventTemplateForm } from '@/components/event-builder/event-template-form'
import { ExerciseSearchInput } from '@/components/exercises/exercise-search-input'
import { ExerciseFilterBar } from '@/components/exercises/exercise-filter-bar'
import { ExerciseListItem } from '@/components/exercises/exercise-list-item'
import { CreateExerciseSheet } from '@/components/exercises/create-exercise-sheet'
import { ScopeToggle } from '@/components/shared/scope-toggle'
import { SearchInput } from '@/components/shared/search-input'
import { ProgramFilterBar } from '@/components/library/program-filter-bar'
import { TemplateFilterBar } from '@/components/library/template-filter-bar'
import { PublishDialog } from '@/components/library/publish-dialog'
import {
  useSessionTemplates,
  useSessionTemplateFull,
  useDeleteSessionTemplate,
  useCloneSessionTemplate,
  usePublishSessionTemplate,
  useUnpublishSessionTemplate,
  useClonePublicSessionTemplate,
} from '@/hooks/use-session-templates'
import {
  usePrograms,
  useActiveProgram,
  useProgramFull,
  useSetActiveProgram,
  useClearActiveProgram,
  useDeleteProgram,
  usePublishProgram,
  useUnpublishProgram,
} from '@/hooks/use-programs'
import { useExercises, useRecentlyUsedExercises } from '@/hooks/use-exercises'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/lib/auth'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useGymPicker } from '@/hooks/use-gym-picker'
import { configureDisplayPublisher } from '@/lib/display-publisher'
import { writeLastGymChoice } from '@/lib/gym-picker-storage'
import { toast } from 'sonner'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { useOnboarding } from '@/hooks/use-onboarding'
import type {
  Program,
  ExerciseCategory,
  MuscleGroup,
  MovementPattern,
  ProgramSource,
  SessionType,
} from '@/domain/types'

export const Route = createFileRoute('/_authenticated/library')({
  component: LibraryPage,
})

type LibraryTab = 'templates' | 'programs' | 'exercises'

function LibraryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()

  const { markRouteVisited } = useOnboarding()

  useEffect(() => {
    markRouteVisited('/library')
  }, [markRouteVisited])

  const [activeTab, setActiveTab] = useState<LibraryTab>('templates')

  // Template state
  const [templateSearchQuery, setTemplateSearchQuery] = useState('')
  const [templateCategory, setTemplateCategory] = useState<SessionType | undefined>()
  const [templateScope, setTemplateScope] = useState<'mine' | 'public'>('mine')
  const debouncedTemplateQuery = useDebouncedValue(templateSearchQuery, 200)

  const {
    data: templates = [],
    isLoading,
    error,
  } = useSessionTemplates(userId || undefined, {
    searchQuery: debouncedTemplateQuery || undefined,
    category: templateCategory,
    scope: templateScope,
  })
  const deleteMutation = useDeleteSessionTemplate()
  const cloneMutation = useCloneSessionTemplate()
  const publishTemplateMutation = usePublishSessionTemplate()
  const unpublishTemplateMutation = useUnpublishSessionTemplate()
  const clonePublicTemplateMutation = useClonePublicSessionTemplate()

  // Workout start hooks for starting from templates
  const { startProgrammedWorkout, isStarting } = useActiveWorkout()
  const { openGymPicker, GymPickerPortal } = useGymPicker()

  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null)

  const [publishTemplateTarget, setPublishTemplateTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sheetMode, setSheetMode] = useState<'session' | 'event'>('session')
  const [showCreateExercise, setShowCreateExercise] = useState(false)

  const handleCreate = () => {
    setEditingId(null)
    setSheetMode('session')
    setSheetOpen(true)
  }

  const handleCreateEvent = () => {
    setEditingId(null)
    setSheetMode('event')
    setSheetOpen(true)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setSheetMode('session')
    setSheetOpen(true)
  }

  const handleEditEvent = (id: string) => {
    setEditingId(id)
    setSheetMode('event')
    setSheetOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
    } catch (err) {
      console.error('[library] Failed to delete template:', err)
      toast('Failed to delete template. Please try again.')
    }
  }

  const handleStartFromTemplate = async (templateId: string) => {
    if (!userId) {
      console.error('[library] Cannot start workout: no authenticated user')
      toast('You must be signed in to start a workout.')
      return
    }

    setStartingTemplateId(templateId)

    // Prompt for gym selection before starting workout
    const choice = await openGymPicker({ userId })
    if (choice === null) {
      setStartingTemplateId(null)
      return
    }

    try {
      const workoutLog = await startProgrammedWorkout(userId, templateId)
      if (choice === 'private') {
        configureDisplayPublisher({ gymId: null, intent: 'private' })
      } else {
        configureDisplayPublisher({ gymId: choice, intent: 'broadcasting' })
      }
      if (!writeLastGymChoice(choice)) {
        console.warn('[library] Failed to persist last gym choice (template)')
        toast('Could not save your last gym choice. Your preference will not persist.')
      }
      navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
    } catch (err) {
      console.error('[library] Failed to start workout from template:', err)
      toast('Failed to start workout. Please try again.')
    } finally {
      setStartingTemplateId(null)
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
    <div className="min-h-[100dvh] bg-surface-anvil pb-20">
      {/* Header */}
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 pt-6 pb-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Icon name="library_books" size={24} className="text-warm-ash" />
          <h1 className="font-display text-2xl font-medium text-bone-white">Library</h1>
        </div>
        {activeTab === 'templates' && (
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={handleCreate} className="min-h-12 text-xs">
              <Icon name="add" size={16} />
              New session
            </Button>
            <Button
              variant="default"
              onClick={handleCreateEvent}
              className="min-h-12 border-l-2 border-ember bg-surface-iron text-xs text-bone-white hover:bg-surface-gunmetal"
            >
              <Icon name="flag" size={16} className="text-ember" />
              New event
            </Button>
          </div>
        )}
        {activeTab === 'programs' && (
          <Button
            variant="default"
            onClick={() => navigate({ to: '/builder', search: { programId: undefined } })}
            className="min-h-12 bg-forge text-on-forge text-xs hover:brightness-110"
          >
            <Icon name="add" size={16} />
            Create program
          </Button>
        )}
        {activeTab === 'exercises' && (
          <Button
            variant="default"
            onClick={() => setShowCreateExercise(true)}
            className="min-h-12 text-xs"
          >
            <Icon name="add" size={16} />
            New exercise
          </Button>
        )}
      </div>

      {/* Onboarding hint */}
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
        <OnboardingHint hintKey="library-intro">
          Your templates and programs live here. Create a session template to start building.
        </OnboardingHint>
      </div>

      {/* Tab navigation */}
      <div
        className="mx-auto max-w-5xl flex border-b border-warm-ash/10 px-4 md:px-6 lg:px-8"
        role="tablist"
      >
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
        <button
          type="button"
          role="tab"
          id="tab-exercises"
          aria-selected={activeTab === 'exercises'}
          aria-controls="tabpanel-exercises"
          onClick={() => setActiveTab('exercises')}
          className={`min-h-12 px-4 pb-3 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'exercises'
              ? 'border-b-2 border-ember text-ember'
              : 'text-warm-ash/60 hover:text-warm-ash'
          }`}
        >
          EXERCISES
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'templates' && (
        <div role="tabpanel" id="tabpanel-templates" aria-labelledby="tab-templates">
          <div className="mx-auto max-w-5xl md:px-6 lg:px-8">
            {/* Scope toggle */}
            <div className="px-4 pt-4">
              <ScopeToggle value={templateScope} onChange={setTemplateScope} />
            </div>
            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <SearchInput
                value={templateSearchQuery}
                onChange={setTemplateSearchQuery}
                placeholder="Search templates"
                autoFocus={false}
              />
            </div>
            {/* Category filter */}
            <div className="px-4 pb-3">
              <TemplateFilterBar
                activeCategory={templateCategory}
                onCategoryChange={setTemplateCategory}
              />
            </div>
          </div>
          <div className="mx-auto max-w-5xl flex flex-col gap-2 px-4 md:px-6 lg:px-8">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full bg-surface-iron" />
                <Skeleton className="h-16 w-full bg-surface-iron" />
                <Skeleton className="h-16 w-full bg-surface-iron" />
              </>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Icon name="error" size={48} className="text-destructive/60" />
                <p className="text-center text-xs text-destructive">Failed to load templates</p>
                <p className="text-center text-xs text-warm-ash/40">
                  {error instanceof Error ? error.message : 'An unexpected error occurred.'}
                </p>
              </div>
            ) : templates.length === 0 ? (
              templateScope === 'mine' && !debouncedTemplateQuery && !templateCategory ? (
                <div className="flex flex-col gap-6 py-4">
                  {/* Ghost template cards */}
                  <div className="flex flex-col gap-px opacity-25 pointer-events-none select-none">
                    {(['Upper Push A', 'Lower B — Squat Focus'] as const).map((name) => (
                      <div
                        key={name}
                        className="flex w-full items-center gap-3 bg-surface-iron px-4 py-4"
                      >
                        <div className="flex flex-1 flex-col gap-1">
                          <span className="font-display text-sm font-medium text-bone-white">
                            {name}
                          </span>
                          <span className="inline-flex w-fit items-center bg-surface-gunmetal text-bone-white text-[11px] px-2 py-0.5 uppercase tracking-widest">
                            Strength
                          </span>
                        </div>
                        <div className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60">
                          <Icon name="delete" size={18} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Value description + CTA */}
                  <div className="flex flex-col items-center gap-4 px-2 text-center">
                    <p className="text-sm font-heading text-warm-ash">
                      Build your training blocks.
                    </p>
                    <p className="text-xs text-warm-ash/50 leading-relaxed">
                      Session templates are reusable workout blueprints. Design a Push Day, a Tempo
                      Run, or an EMOM -- then snap them into any program.
                    </p>
                    <Button
                      variant="default"
                      onClick={handleCreate}
                      className="min-h-12 w-full text-xs"
                    >
                      <Icon name="add" size={16} />
                      Create your first template
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-16">
                  <span className="material-symbols-outlined text-4xl text-warm-ash/40">
                    search_off
                  </span>
                  <p className="font-display text-sm text-warm-ash">No templates found</p>
                </div>
              )
            ) : (
              templates.map((template) => {
                const isOwned = template.userId === userId
                return template.category === 'EVENT' ? (
                  <div key={template.id} className="flex flex-col gap-0">
                    <EventCard
                      template={template}
                      onEdit={() => handleEditEvent(template.id)}
                      onDelete={() => handleDelete(template.id)}
                      onClone={() => cloneMutation.mutate({ id: template.id, userId })}
                      isCloning={
                        cloneMutation.isPending && cloneMutation.variables?.id === template.id
                      }
                    />
                    {templateScope === 'public' && (
                      <TemplatePublicActions
                        templateId={template.id}
                        templateName={template.name}
                        isOwned={isOwned}
                        isPublic={template.isPublic}
                        userId={template.userId}
                        onPublish={() =>
                          setPublishTemplateTarget({ id: template.id, name: template.name })
                        }
                        onUnpublish={() => unpublishTemplateMutation.mutate(template.id)}
                        onClone={() => clonePublicTemplateMutation.mutate(template.id)}
                        isCloning={
                          clonePublicTemplateMutation.isPending &&
                          clonePublicTemplateMutation.variables === template.id
                        }
                      />
                    )}
                  </div>
                ) : (
                  <div key={template.id} className="flex flex-col gap-0">
                    <SessionTemplateCard
                      template={template}
                      onEdit={() => handleEdit(template.id)}
                      onDelete={() => handleDelete(template.id)}
                      onStartWorkout={
                        isOwned && templateScope === 'mine'
                          ? () => handleStartFromTemplate(template.id)
                          : undefined
                      }
                      isStarting={isStarting && startingTemplateId === template.id}
                    />
                    {templateScope === 'public' && (
                      <TemplatePublicActions
                        templateId={template.id}
                        templateName={template.name}
                        isOwned={isOwned}
                        isPublic={template.isPublic}
                        userId={template.userId}
                        onPublish={() =>
                          setPublishTemplateTarget({ id: template.id, name: template.name })
                        }
                        onUnpublish={() => unpublishTemplateMutation.mutate(template.id)}
                        onClone={() => clonePublicTemplateMutation.mutate(template.id)}
                        isCloning={
                          clonePublicTemplateMutation.isPending &&
                          clonePublicTemplateMutation.variables === template.id
                        }
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Publish template confirmation dialog */}
          <PublishDialog
            open={!!publishTemplateTarget}
            onOpenChange={(open) => {
              if (!open) setPublishTemplateTarget(null)
            }}
            mode="template"
            entityName={publishTemplateTarget?.name ?? ''}
            onConfirm={() => {
              if (publishTemplateTarget) {
                publishTemplateMutation.mutate(publishTemplateTarget.id)
                setPublishTemplateTarget(null)
              }
            }}
            isPublishing={publishTemplateMutation.isPending}
          />
        </div>
      )}
      {activeTab === 'programs' && (
        <div
          role="tabpanel"
          id="tabpanel-programs"
          aria-labelledby="tab-programs"
          className="mx-auto max-w-5xl md:px-6 lg:px-8"
        >
          <ProgramList userId={userId || undefined} />
        </div>
      )}
      {activeTab === 'exercises' && (
        <div
          role="tabpanel"
          id="tabpanel-exercises"
          aria-labelledby="tab-exercises"
          className="mx-auto max-w-5xl md:px-6 lg:px-8"
        >
          <ExerciseList userId={userId || undefined} />
        </div>
      )}

      {/* Template form sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[95vh] overflow-y-auto bg-surface-anvil p-0"
          showCloseButton={false}
        >
          <div className="px-4 lg:px-12">
            <SheetHeader className="px-4 pt-4 pb-0">
              <SheetTitle className="text-xs text-ember">
                {sheetMode === 'event'
                  ? editingId
                    ? 'Edit event'
                    : 'New event'
                  : editingId
                    ? 'Edit template'
                    : 'New template'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {sheetMode === 'event'
                  ? editingId
                    ? 'Edit an existing event template'
                    : 'Create a new event template'
                  : editingId
                    ? 'Edit an existing session template'
                    : 'Create a new session template'}
              </SheetDescription>
            </SheetHeader>

            <div className="pt-2">
              {sheetMode === 'event' ? (
                editingId ? (
                  <EditEventFormLoader
                    templateId={editingId}
                    onSave={handleSaved}
                    onCancel={handleCancel}
                  />
                ) : (
                  <EventTemplateForm onSave={handleSaved} onCancel={handleCancel} />
                )
              ) : editingId ? (
                <EditTemplateFormLoader
                  templateId={editingId}
                  onSave={handleSaved}
                  onCancel={handleCancel}
                />
              ) : (
                <SessionTemplateForm onSave={handleSaved} onCancel={handleCancel} />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CreateExerciseSheet open={showCreateExercise} onOpenChange={setShowCreateExercise} />

      {/* Gym picker portal for starting workouts from templates */}
      <GymPickerPortal />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Program list panel
// ---------------------------------------------------------------------------

function ProgramList({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate()

  // Search, filter, scope state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSource, setActiveSource] = useState<ProgramSource | undefined>()
  const [scope, setScope] = useState<'mine' | 'public'>('mine')
  const debouncedQuery = useDebouncedValue(searchQuery, 200)

  const {
    data: programs = [],
    isLoading,
    error,
  } = usePrograms(userId, {
    searchQuery: debouncedQuery || undefined,
    source: activeSource,
    scope,
  })
  const { data: activeProgram, error: activeProgramError } = useActiveProgram(userId)
  const { data: activeProgramFull, isError: activeProgramFullError } = useProgramFull(
    activeProgram?.programId,
  )
  const [timeTravelOpen, setTimeTravelOpen] = useState(false)
  const setActiveMutation = useSetActiveProgram()
  const clearActiveMutation = useClearActiveProgram()
  const deleteProgramMutation = useDeleteProgram()
  const publishProgramMutation = usePublishProgram()
  const unpublishProgramMutation = useUnpublishProgram()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const programToDelete = programs.find((p) => p.id === confirmDeleteId)

  const [publishProgramTarget, setPublishProgramTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  const handleActivate = async (programId: string) => {
    if (!userId) {
      console.error('[library] Cannot activate: no authenticated user')
      toast('You must be signed in to activate a program.')
      return
    }
    try {
      await setActiveMutation.mutateAsync({ userId, programId })
    } catch (err) {
      console.error('[library] Failed to activate program:', err)
      toast('Failed to activate program. Please try again.')
    }
  }

  const handleDeactivate = async () => {
    if (!userId) {
      console.error('[library] Cannot deactivate: no authenticated user')
      toast('You must be signed in to deactivate a program.')
      return
    }
    try {
      await clearActiveMutation.mutateAsync(userId)
    } catch (err) {
      console.error('[library] Failed to deactivate program:', err)
      toast('Failed to deactivate program. Please try again.')
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
      toast('Failed to delete program. Please try again.')
    }
  }

  return (
    <>
      {/* Scope toggle */}
      <div className="px-4 pt-4">
        <ScopeToggle value={scope} onChange={setScope} />
      </div>
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search programs"
          autoFocus={false}
        />
      </div>
      {/* Source filter */}
      <div className="px-4 pb-3">
        <ProgramFilterBar activeSource={activeSource} onSourceChange={setActiveSource} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2 px-4">
          <Skeleton className="h-24 w-full bg-surface-iron" />
          <Skeleton className="h-24 w-full bg-surface-iron" />
          <Skeleton className="h-24 w-full bg-surface-iron" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 px-4 py-16">
          <Icon name="error" size={48} className="text-destructive/60" />
          <p className="text-center text-xs text-destructive">Failed to load programs</p>
          <p className="text-center text-xs text-warm-ash/40">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
        </div>
      ) : programs.length === 0 ? (
        scope === 'mine' && !debouncedQuery && !activeSource ? (
          <div className="flex flex-col gap-6 px-4 py-4">
            {/* Ghost program entries */}
            <div className="pointer-events-none flex select-none flex-col gap-2 opacity-25">
              {(
                [
                  { name: '12-Week Strength Base', meta: '3 blocks · 4 days/week', active: true },
                  { name: 'Marathon Base Build', meta: '4 blocks · 5 days/week', active: false },
                ] as const
              ).map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between bg-surface-iron px-4 py-4"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-display text-sm font-medium text-bone-white">
                      {p.name}
                    </span>
                    <span className="text-xs text-warm-ash/60">{p.meta}</span>
                  </div>
                  {p.active && (
                    <span className="inline-flex items-center bg-ember/20 px-2 py-0.5 text-[11px] uppercase tracking-widest text-ember">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Value description + CTA */}
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="font-heading text-sm text-warm-ash">Structure your training.</p>
              <p className="text-xs leading-relaxed text-warm-ash/50">
                Programs organize workouts into blocks and weeks. Build a strength cycle, a marathon
                prep, or a competition block -- then execute it session by session.
              </p>
              <Button
                variant="default"
                onClick={() => navigate({ to: '/builder', search: { programId: undefined } })}
                className="min-h-12 w-full bg-forge text-xs text-on-forge hover:brightness-110"
              >
                <Icon name="add" size={16} />
                Open Program Builder
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="material-symbols-outlined text-4xl text-warm-ash/40">search_off</span>
            <p className="font-display text-sm text-warm-ash">No programs found</p>
          </div>
        )
      ) : (
        <>
          {activeProgramError && (
            <div className="mx-4 mt-4 rounded bg-warning-flare/10 px-3 py-2 text-xs text-warning-flare">
              Could not load active program status.
            </div>
          )}
          <div className="flex flex-col gap-2 px-4">
            {programs.map((program) => {
              const isActive = activeProgram?.programId === program.id
              const isOwned = program.userId === userId

              return (
                <div key={program.id} className="flex flex-col gap-0">
                  <ProgramCard
                    program={program}
                    isActive={isActive}
                    onActivate={() => handleActivate(program.id)}
                    onDeactivate={handleDeactivate}
                    onEdit={() => handleEdit(program.id)}
                    onDelete={() => setConfirmDeleteId(program.id)}
                    onTimeTravel={
                      isActive && activeProgramFull
                        ? () => setTimeTravelOpen(true)
                        : isActive && activeProgramFullError
                          ? () => toast.error('Failed to load program data. Please try again.')
                          : undefined
                    }
                    scope={scope}
                    isOwned={isOwned}
                    onPublish={() =>
                      setPublishProgramTarget({ id: program.id, name: program.name })
                    }
                    onUnpublish={() => unpublishProgramMutation.mutate(program.id)}
                    isPublic={program.isPublic}
                    authorId={program.userId}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="text-xs text-ember">Delete Program</DialogTitle>
            <DialogDescription className="text-sm text-warm-ash">
              Are you sure you want to delete &quot;{programToDelete?.name}&quot;? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteId(null)}
              className="min-h-12 text-xs"
            >
              Cancel
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
              className="min-h-12 text-xs"
            >
              {deleteProgramMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish program confirmation dialog */}
      <PublishDialog
        open={!!publishProgramTarget}
        onOpenChange={(open) => {
          if (!open) setPublishProgramTarget(null)
        }}
        mode="program"
        entityName={publishProgramTarget?.name ?? ''}
        onConfirm={() => {
          if (publishProgramTarget) {
            publishProgramMutation.mutate(publishProgramTarget.id)
            setPublishProgramTarget(null)
          }
        }}
        isPublishing={publishProgramMutation.isPending}
      />

      {/* Time Travel Sheet */}
      {activeProgram && activeProgramFull && (
        <TimeTravelSheet
          open={timeTravelOpen}
          onOpenChange={setTimeTravelOpen}
          activation={activeProgram}
          programFull={activeProgramFull}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Exercise list panel
// ---------------------------------------------------------------------------

function ExerciseList({ userId }: { userId: string | undefined }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | undefined>()
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<MuscleGroup | undefined>()
  const [activeMovementPattern, setActiveMovementPattern] = useState<MovementPattern | undefined>()

  const debouncedQuery = useDebouncedValue(searchQuery, 200)

  const hasActiveFilters =
    !!debouncedQuery || !!activeCategory || !!activeMuscleGroup || !!activeMovementPattern

  const {
    data: exercises,
    isLoading: isLoadingExercises,
    isError,
  } = useExercises({
    searchQuery: debouncedQuery || undefined,
    category: activeCategory,
    muscleGroup: activeMuscleGroup,
    movementPattern: activeMovementPattern,
  })

  const { data: recentlyUsed, isLoading: isLoadingRecent } = useRecentlyUsedExercises(userId)

  const isLoading = isLoadingExercises || (!hasActiveFilters && isLoadingRecent)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0 px-4 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-b-[rgba(91,64,57,0.15)] bg-surface-iron px-4 py-3"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded-none bg-surface-steel" />
              <Skeleton className="h-3 w-24 rounded-none bg-surface-steel" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16">
        <Icon name="error" size={48} className="text-destructive/60" />
        <p className="text-center text-xs text-destructive">Failed to load exercises</p>
        <p className="text-center text-xs text-warm-ash/40">Check your connection and try again.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Search */}
      <div className="px-4 pt-4 pb-3">
        <ExerciseSearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Filters */}
      <div className="px-4 pb-4">
        <ExerciseFilterBar
          activeCategory={activeCategory}
          activeMuscleGroup={activeMuscleGroup}
          activeMovementPattern={activeMovementPattern}
          onCategoryChange={setActiveCategory}
          onMuscleGroupChange={setActiveMuscleGroup}
          onMovementPatternChange={setActiveMovementPattern}
        />
      </div>

      {/* Exercise list */}
      {hasActiveFilters ? (
        exercises && exercises.length > 0 ? (
          exercises.map((exercise) => <ExerciseListItem key={exercise.id} exercise={exercise} />)
        ) : (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="material-symbols-outlined text-4xl text-warm-ash/40">search_off</span>
            <p className="font-display text-sm text-warm-ash">No exercises found</p>
          </div>
        )
      ) : (
        <>
          {recentlyUsed && recentlyUsed.length > 0 && (
            <>
              <div className="px-4 py-2">
                <h2 className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                  RECENTLY USED
                </h2>
              </div>
              {recentlyUsed.map((exercise) => (
                <ExerciseListItem key={exercise.id} exercise={exercise} />
              ))}
              <div className="h-4" />
            </>
          )}

          <div className="px-4 py-2">
            <h2 className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
              ALL EXERCISES
            </h2>
          </div>
          {exercises && exercises.length > 0 ? (
            exercises.map((exercise) => <ExerciseListItem key={exercise.id} exercise={exercise} />)
          ) : (
            <div className="flex flex-col items-center gap-3 py-16">
              <p className="font-display text-sm text-warm-ash">No exercises found</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template public actions (placeholder for public visibility feature)
// ---------------------------------------------------------------------------

function TemplatePublicActions({
  isOwned,
  isPublic,
  templateName,
  onPublish,
  onUnpublish,
  onClone,
  isCloning,
}: {
  templateId: string
  templateName: string
  isOwned: boolean
  isPublic: boolean
  userId: string
  onPublish: () => void
  onUnpublish: () => void
  onClone: () => void
  isCloning: boolean
}) {
  if (isOwned) {
    return (
      <div className="flex items-center justify-end bg-surface-iron px-4 pb-3">
        {isPublic ? (
          <button
            type="button"
            onClick={onUnpublish}
            className="flex min-h-[36px] items-center gap-1 px-2 text-xs text-warm-ash hover:text-bone-white"
            aria-label={`Unpublish ${templateName}`}
          >
            <span className="material-symbols-outlined text-base">visibility_off</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            className="flex min-h-[36px] items-center gap-1 px-2 text-xs text-ember hover:brightness-110"
            aria-label={`Publish ${templateName}`}
          >
            <span className="material-symbols-outlined text-base">publish</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end bg-surface-iron px-4 pb-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={isCloning}
        onClick={onClone}
        className="min-h-[36px] text-xs"
        aria-label={`Clone ${templateName}`}
      >
        {isCloning ? 'Cloning...' : 'Clone'}
      </Button>
    </div>
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
  onTimeTravel,
}: {
  program: Program
  isActive: boolean
  onActivate: () => void
  onDeactivate: () => void
  onEdit: () => void
  onDelete: () => void
  onTimeTravel?: () => void
  scope?: 'mine' | 'public'
  isOwned?: boolean
  onPublish?: () => void
  onUnpublish?: () => void
  isPublic?: boolean
  authorId?: string
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
            <Badge className="text-[11px]">{SOURCE_LABELS[program.source] ?? program.source}</Badge>
            {totalWeeks > 0 && (
              <span className="text-[11px] uppercase tracking-wider text-warm-ash/60">
                {totalWeeks} {totalWeeks === 1 ? 'WEEK' : 'WEEKS'}
              </span>
            )}
          </div>
        </button>

        {isActive && (
          <span className="mt-1 flex items-center gap-1 text-[11px] uppercase tracking-wider text-ember">
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
            className="min-h-12 flex-1 text-xs text-warm-ash/60 hover:text-warning-flare"
          >
            Deactivate
          </Button>
        ) : (
          <Button variant="default" onClick={onActivate} className="min-h-12 flex-1 text-xs">
            Activate
          </Button>
        )}

        {onTimeTravel && (
          <button
            type="button"
            onClick={onTimeTravel}
            className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash/60 hover:text-ember"
            aria-label={`Time travel -- adjust position for ${program.name}`}
          >
            <Icon name="history" size={18} />
          </button>
        )}

        <ShareDialog
          entityType="PROGRAM"
          entityId={program.id}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="min-h-12 text-xs uppercase tracking-wider"
              aria-label={`Share ${program.name}`}
            >
              <Icon name="share" size={16} />
              Share
            </Button>
          }
        />

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
        <p className="text-center text-xs text-destructive">Failed to load template</p>
        <p className="text-center text-xs text-warm-ash/40">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
    )
  }

  if (!data) {
    return <div className="p-4 text-center text-xs text-warm-ash/60">Template not found</div>
  }

  return (
    <SessionTemplateForm
      initial={data as SessionTemplateFull}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}

// ---------------------------------------------------------------------------
// Loader for event edit mode -- fetches the full template data for events
// ---------------------------------------------------------------------------

function EditEventFormLoader({
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
        <p className="text-center text-xs text-destructive">Failed to load event</p>
        <p className="text-center text-xs text-warm-ash/40">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
    )
  }

  if (!data) {
    return <div className="p-4 text-center text-xs text-warm-ash/60">Event not found</div>
  }

  return (
    <EventTemplateForm initial={data as SessionTemplateFull} onSave={onSave} onCancel={onCancel} />
  )
}
