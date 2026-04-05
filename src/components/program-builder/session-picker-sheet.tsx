import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'
import { EventTemplateForm } from '@/components/event-builder/event-template-form'
import {
  useSessionTemplates,
  useTouchSessionTemplateLastAssigned,
} from '@/hooks/use-session-templates'
import type { SessionType, SessionTemplate } from '@/domain/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_FILTERS: Array<{ value: SessionType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'ALL' },
  { value: 'STRENGTH', label: 'STRENGTH' },
  { value: 'CONDITIONING', label: 'CONDITIONING' },
  { value: 'SE', label: 'SE' },
  { value: 'MIXED', label: 'MIXED' },
  { value: 'EVENT', label: 'EVENT' },
]

// ---------------------------------------------------------------------------
// SessionPickerSheet
// ---------------------------------------------------------------------------

const MAX_RECENT = 5

interface SessionPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (templateId: string, templateName: string, sessionType: SessionType) => void
  userId: string
}

export function SessionPickerSheet({
  open,
  onOpenChange,
  onSelect,
  userId,
}: SessionPickerSheetProps) {
  const navigate = useNavigate()
  const { data: templates = [], isLoading } = useSessionTemplates(userId)
  const touchLastAssigned = useTouchSessionTemplateLastAssigned()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SessionType | 'ALL'>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)

  const isDefaultView = filter === 'ALL' && !search.trim()

  const recentTemplates = useMemo(() => {
    if (!isDefaultView) return []
    return templates
      .filter((t) => t.lastAssignedAt)
      .sort((a, b) => (b.lastAssignedAt! > a.lastAssignedAt! ? 1 : -1))
      .slice(0, MAX_RECENT)
  }, [templates, isDefaultView])

  const recentIds = useMemo(() => new Set(recentTemplates.map((t) => t.id)), [recentTemplates])

  // Filter templates by type and search query
  const filtered = useMemo(() => {
    let result = templates

    // Filter by type
    if (filter !== 'ALL') {
      result = result.filter((t) => t.category === filter)
    }

    // Filter by search
    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter((t) => t.name.toLowerCase().includes(query))
    }

    return result
  }, [templates, filter, search])

  const touchMutate = touchLastAssigned.mutate

  const handleSelect = useCallback(
    (template: SessionTemplate) => {
      onSelect(template.id, template.name, template.category)
      touchMutate(template.id)
      onOpenChange(false)
      setSearch('')
      setFilter('ALL')
      setShowCreate(false)
      setShowCreateEvent(false)
    },
    [onSelect, onOpenChange, touchMutate],
  )

  const handleCreated = useCallback(
    (template: SessionTemplate) => {
      // Auto-select the newly created template
      onSelect(template.id, template.name, template.category)
      onOpenChange(false)
      setSearch('')
      setFilter('ALL')
      setShowCreate(false)
      setShowCreateEvent(false)
    },
    [onSelect, onOpenChange],
  )

  const handleCancelCreate = useCallback(() => {
    setShowCreate(false)
  }, [])

  const handleEventCreated = useCallback(
    (template: SessionTemplate) => {
      onSelect(template.id, template.name, template.category)
      onOpenChange(false)
      setSearch('')
      setFilter('ALL')
      setShowCreate(false)
      setShowCreateEvent(false)
    },
    [onSelect, onOpenChange],
  )

  const handleCancelCreateEvent = useCallback(() => {
    setShowCreateEvent(false)
  }, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex max-h-screen w-full flex-col overflow-hidden bg-surface-anvil p-0 sm:max-w-md"
        showCloseButton={false}
      >
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="font-display text-sm text-ember">
            Select Session Template
          </SheetTitle>
          <SheetDescription className="sr-only">
            Choose a session template to assign to this day
          </SheetDescription>
        </SheetHeader>

        {showCreate ? (
          /* Inline template creation form */
          <div className="flex flex-1 flex-col overflow-y-auto pt-2">
            <SessionTemplateForm onSave={handleCreated} onCancel={handleCancelCreate} />
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  navigate({ to: '/library' })
                }}
                className="text-[11px] text-warm-ash/50 transition-colors hover:text-ember"
              >
                Want more options? Create in the Library
              </button>
            </div>
          </div>
        ) : showCreateEvent ? (
          /* Inline event creation form */
          <div className="flex flex-1 flex-col overflow-y-auto pt-2">
            <EventTemplateForm onSave={handleEventCreated} onCancel={handleCancelCreateEvent} />
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  navigate({ to: '/library' })
                }}
                className="text-[11px] text-warm-ash/50 transition-colors hover:text-ember"
              >
                Want more options? Create in the Library
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates"
                className="w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
                aria-label="Search templates"
              />
            </div>

            <div className="px-4 pt-3">
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(v) => {
                  if (v) setFilter(v as SessionType | 'ALL')
                }}
                className="flex flex-wrap gap-1"
              >
                {SESSION_FILTERS.map((f) => (
                  <ToggleGroupItem
                    key={f.value}
                    value={f.value}
                    className="min-h-8 px-2 py-1 text-xs font-medium uppercase tracking-wider"
                  >
                    {f.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-14 w-full bg-surface-iron" />
                  <Skeleton className="h-14 w-full bg-surface-iron" />
                  <Skeleton className="h-14 w-full bg-surface-iron" />
                </div>
              ) : filtered.length === 0 && recentTemplates.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Icon name="search_off" size={36} className="text-warm-ash/40" />
                  <p className="text-center text-xs text-warm-ash/60">No templates found</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {recentTemplates.length > 0 && (
                    <>
                      <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-warm-ash/50">
                        Recent
                      </p>
                      {recentTemplates.map((template) => (
                        <TemplateButton
                          key={template.id}
                          template={template}
                          onSelect={handleSelect}
                        />
                      ))}
                      <div className="my-2 border-t border-warm-ash/10" />
                      <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-warm-ash/50">
                        All templates
                      </p>
                    </>
                  )}
                  {filtered
                    .filter((t) => !recentIds.has(t.id))
                    .map((template) => (
                      <TemplateButton
                        key={template.id}
                        template={template}
                        onSelect={handleSelect}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Create new template / event -- opens inline form directly */}
            <div className="flex flex-col gap-2 border-t border-warm-ash/10 px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreate(true)}
                className="min-h-12 w-full text-xs"
              >
                <Icon name="add" size={16} />
                Create new template
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateEvent(true)}
                className="min-h-12 w-full text-xs"
              >
                <Icon name="flag" size={16} fill className="text-ember" />
                Create new event
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// TemplateButton -- shared row used in both Recent and All sections
// ---------------------------------------------------------------------------

function TemplateButton({
  template,
  onSelect,
}: {
  template: SessionTemplate
  onSelect: (template: SessionTemplate) => void
}) {
  const isEvent = template.category === 'EVENT'
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
        isEvent
          ? 'border-l-2 border-ember bg-surface-iron hover:bg-surface-gunmetal'
          : 'bg-surface-iron hover:bg-surface-gunmetal'
      }`}
    >
      {isEvent && <Icon name="flag" size={16} fill className="shrink-0 text-ember" />}
      <div className="flex flex-1 flex-col gap-1">
        <span
          className={`text-sm font-medium text-bone-white ${
            isEvent ? 'font-display uppercase tracking-wider' : 'font-display'
          }`}
        >
          {template.name}
        </span>
        <span
          className={`inline-block self-start px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
            isEvent ? 'bg-ember/15 text-ember' : 'bg-surface-steel text-warm-ash'
          }`}
        >
          {template.category}
        </span>
      </div>
      <Icon name="chevron_right" size={18} className="text-warm-ash/40" />
    </button>
  )
}
