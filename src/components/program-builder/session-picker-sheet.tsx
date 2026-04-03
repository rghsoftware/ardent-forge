import { useState, useMemo, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'
import { useSessionTemplates } from '@/hooks/use-session-templates'
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
  const { data: templates = [], isLoading } = useSessionTemplates(userId)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SessionType | 'ALL'>('ALL')
  const [showCreate, setShowCreate] = useState(false)

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

  const handleSelect = useCallback(
    (template: SessionTemplate) => {
      onSelect(template.id, template.name, template.category)
      onOpenChange(false)
      setSearch('')
      setFilter('ALL')
      setShowCreate(false)
    },
    [onSelect, onOpenChange],
  )

  const handleCreated = useCallback(
    (template: SessionTemplate) => {
      // Auto-select the newly created template
      onSelect(template.id, template.name, template.category)
      onOpenChange(false)
      setSearch('')
      setFilter('ALL')
      setShowCreate(false)
    },
    [onSelect, onOpenChange],
  )

  const handleCancelCreate = useCallback(() => {
    setShowCreate(false)
  }, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex max-h-screen w-full flex-col overflow-hidden bg-surface-anvil p-0 sm:max-w-md"
        showCloseButton={false}
      >
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-xs text-ember">Select Session Template</SheetTitle>
          <SheetDescription className="sr-only">
            Choose a session template to assign to this day
          </SheetDescription>
        </SheetHeader>

        {showCreate ? (
          /* Inline template creation form */
          <div className="flex-1 overflow-y-auto pt-2">
            <SessionTemplateForm onSave={handleCreated} onCancel={handleCancelCreate} />
          </div>
        ) : (
          <>
            <div className="px-4 pt-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SEARCH TEMPLATES"
                className="w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
                aria-label="Search templates"
              />
            </div>

            <div className="flex flex-wrap gap-1 px-4 pt-3">
              {SESSION_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`min-h-8 px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    filter === f.value
                      ? 'bg-forge text-on-forge'
                      : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-14 w-full bg-surface-iron" />
                  <Skeleton className="h-14 w-full bg-surface-iron" />
                  <Skeleton className="h-14 w-full bg-surface-iron" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Icon name="search_off" size={36} className="text-warm-ash/40" />
                  <p className="text-center text-xs text-warm-ash/60">No templates found</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtered.map((template) => {
                    const isEvent = template.category === 'EVENT'
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleSelect(template)}
                        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                          isEvent
                            ? 'border-l-2 border-ember bg-surface-iron hover:bg-surface-gunmetal'
                            : 'bg-surface-iron hover:bg-surface-gunmetal'
                        }`}
                      >
                        {isEvent && (
                          <Icon name="flag" size={16} fill className="shrink-0 text-ember" />
                        )}
                        <div className="flex flex-1 flex-col gap-1">
                          <span
                            className={`text-sm font-medium text-bone-white ${
                              isEvent ? 'font-display uppercase tracking-wider' : 'font-display'
                            }`}
                          >
                            {template.name}
                          </span>
                          <span
                            className={`inline-block self-start px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                              isEvent ? 'bg-ember/15 text-ember' : 'bg-surface-steel text-warm-ash'
                            }`}
                          >
                            {template.category}
                          </span>
                        </div>
                        <Icon name="chevron_right" size={18} className="text-warm-ash/40" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Create new template button */}
            <div className="border-t border-warm-ash/10 px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreate(true)}
                className="min-h-12 w-full text-xs"
              >
                <Icon name="add" size={16} />
                Create new template
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
