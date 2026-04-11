import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useCreateSessionTemplate, useUpdateSessionTemplate } from '@/hooks/use-session-templates'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import type { SessionTemplate, EventMetadata, EventRequirement } from '@/domain/types'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import { RequirementEditor, type RequirementData } from './requirement-editor'
import { EventItemEditor, type DraftEventItem } from './event-item-editor'
import { underlineInput } from './styles'
import { splitDateTime, combineDateTime } from './date-time-utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventTemplateFormProps {
  initial?: SessionTemplateFull
  onSave?: (template: SessionTemplate) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hydrateRequirements(meta?: EventMetadata): RequirementData[] {
  if (!meta?.requirements?.length) return []
  return meta.requirements.map((r: EventRequirement) => ({
    _clientId: crypto.randomUUID(),
    key: r.key,
    value: r.value,
    unit: r.unit ?? '',
    notes: r.notes ?? '',
  }))
}

function hydrateDraftItems(initial?: SessionTemplateFull): DraftEventItem[] {
  if (!initial?.eventItems?.length) return []
  return initial.eventItems.map((item) => ({
    _clientId: crypto.randomUUID(),
    id: item.id,
    name: item.name,
    category: item.category ?? '',
    quantity: item.quantity,
    notes: item.notes ?? '',
  }))
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function EventTemplateForm({
  initial,
  onSave,
  onCancel,
  onDirtyChange,
}: EventTemplateFormProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const createMutation = useCreateSessionTemplate()
  const updateMutation = useUpdateSessionTemplate()

  const isEditing = !!initial

  // -- Form state ----------------------------------------------------------
  const [name, setName] = useState(initial?.template.name ?? '')
  const [description, setDescription] = useState(initial?.template.description ?? '')
  const { date: initDate, time: initTime } = splitDateTime(
    initial?.template.eventMetadata?.eventDate,
  )
  const [eventDate, setEventDate] = useState(initDate)
  const [eventTime, setEventTime] = useState(initTime)
  const [location, setLocation] = useState(initial?.template.eventMetadata?.location ?? '')
  const [showCoordinates, setShowCoordinates] = useState(
    !!(initial?.template.eventMetadata?.latitude || initial?.template.eventMetadata?.longitude),
  )
  const [latitude, setLatitude] = useState(
    initial?.template.eventMetadata?.latitude?.toString() ?? '',
  )
  const [longitude, setLongitude] = useState(
    initial?.template.eventMetadata?.longitude?.toString() ?? '',
  )
  const [eventUrl, setEventUrl] = useState(initial?.template.eventMetadata?.eventUrl ?? '')
  const initialRequirements = hydrateRequirements(initial?.template.eventMetadata)
  const initialDraftItems = hydrateDraftItems(initial)
  const [requirements, setRequirements] = useState<RequirementData[]>(initialRequirements)
  const [draftItems, setDraftItems] = useState<DraftEventItem[]>(initialDraftItems)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  // -- Dirty tracking ------------------------------------------------------
  // Snapshot the initial form state, compare to current on every render.
  // After successful save, snapshot is reset so navigating away is unblocked.
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    JSON.stringify({
      name: initial?.template.name ?? '',
      description: initial?.template.description ?? '',
      eventDate: initDate,
      eventTime: initTime,
      location: initial?.template.eventMetadata?.location ?? '',
      latitude: initial?.template.eventMetadata?.latitude?.toString() ?? '',
      longitude: initial?.template.eventMetadata?.longitude?.toString() ?? '',
      eventUrl: initial?.template.eventMetadata?.eventUrl ?? '',
      requirements: initialRequirements,
      draftItems: initialDraftItems,
    }),
  )
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        eventDate,
        eventTime,
        location,
        latitude,
        longitude,
        eventUrl,
        requirements,
        draftItems,
      }),
    [
      name,
      description,
      eventDate,
      eventTime,
      location,
      latitude,
      longitude,
      eventUrl,
      requirements,
      draftItems,
    ],
  )
  const dirty = currentSnapshot !== baselineSnapshot
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // -- Expandable sections -------------------------------------------------
  const [requirementsExpanded, setRequirementsExpanded] = useState(
    () => initialRequirements.length > 0,
  )
  const [packingExpanded, setPackingExpanded] = useState(() => initialDraftItems.length > 0)

  const isSaving = createMutation.isPending || updateMutation.isPending

  // -- Requirement handlers ------------------------------------------------
  const handleAddRequirement = useCallback(() => {
    setRequirements((prev) => [
      ...prev,
      { _clientId: crypto.randomUUID(), key: '', value: '', unit: '', notes: '' },
    ])
    setRequirementsExpanded(true)
  }, [])

  const handleUpdateRequirement = useCallback((index: number, updated: RequirementData) => {
    setRequirements((prev) => {
      const next = [...prev]
      next[index] = updated
      return next
    })
  }, [])

  const handleDeleteRequirement = useCallback((index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // -- Packing list handlers -----------------------------------------------
  const handleAddItem = useCallback(() => {
    setDraftItems((prev) => [
      ...prev,
      { _clientId: crypto.randomUUID(), name: '', category: '', quantity: 1, notes: '' },
    ])
    setPackingExpanded(true)
  }, [])

  const handleUpdateItem = useCallback((index: number, updated: DraftEventItem) => {
    setDraftItems((prev) => {
      const next = [...prev]
      next[index] = updated
      return next
    })
  }, [])

  const handleDeleteItem = useCallback((index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // -- Validation ----------------------------------------------------------
  const validate = useCallback((): boolean => {
    const errs: string[] = []
    const warns: string[] = []

    if (!name.trim()) errs.push('Event name is required')

    // Validate URL format if provided
    if (eventUrl.trim()) {
      try {
        const parsed = new URL(eventUrl.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errs.push('Event URL must use http or https protocol')
        }
      } catch {
        errs.push('Event URL is not a valid URL')
      }
    }

    // EV-8: soft warning if coordinates but no location
    if ((latitude.trim() || longitude.trim()) && !location.trim()) {
      warns.push('Coordinates provided without a location name. Consider adding a location.')
    }

    setErrors(errs)
    setWarnings(warns)
    return errs.length === 0
  }, [name, eventUrl, latitude, longitude, location])

  // -- Event item persistence helpers --------------------------------------

  const createDraftItems = useCallback(
    async (templateId: string) => {
      const { getAdapter } = await import('@/lib/adapter')
      const adapter = getAdapter()
      const validItems = draftItems
        .map((item, i) => ({ item, index: i }))
        .filter(({ item }) => item.name.trim())

      const results = await Promise.allSettled(
        validItems.map(({ item, index }) =>
          adapter.saveEventItem(
            {
              sessionTemplateId: templateId,
              workoutLogId: undefined,
              userId,
              name: item.name.trim(),
              category: item.category.trim() || undefined,
              quantity: item.quantity,
              isPacked: false,
              sortOrder: index,
              notes: item.notes.trim() || undefined,
            },
            templateId,
            'template',
          ),
        ),
      )

      const failures = results.filter((r) => r.status === 'rejected')
      if (failures.length > 0) {
        console.error(`[event-template-form] ${failures.length} item(s) failed to create`)
        throw new Error(`${failures.length} of ${validItems.length} items failed to save`)
      }
    },
    [draftItems, userId],
  )

  const reconcileEventItems = useCallback(
    async (templateId: string, prev: SessionTemplateFull) => {
      const { getAdapter } = await import('@/lib/adapter')
      const adapter = getAdapter()

      const existingItems = prev.eventItems ?? []
      const existingIds = new Set(existingItems.map((item) => item.id))
      const draftIds = new Set(draftItems.filter((d) => d.id).map((d) => d.id!))

      // Phase 1: Delete removed items
      const toDelete = existingItems.filter((item) => !draftIds.has(item.id))
      const deleteResults = await Promise.allSettled(
        toDelete.map((item) => adapter.deleteEventItem(item.id)),
      )

      // Phase 2: Update existing + create new (parallel)
      const upsertOps: Promise<unknown>[] = []
      for (let i = 0; i < draftItems.length; i++) {
        const draft = draftItems[i]
        if (!draft.name.trim()) continue

        if (draft.id && existingIds.has(draft.id)) {
          const existing = existingItems.find((e) => e.id === draft.id)!
          upsertOps.push(
            adapter.updateEventItem({
              ...existing,
              name: draft.name.trim(),
              category: draft.category.trim() || undefined,
              quantity: draft.quantity,
              sortOrder: i,
              notes: draft.notes.trim() || undefined,
            }),
          )
        } else if (!draft.id) {
          upsertOps.push(
            adapter.saveEventItem(
              {
                sessionTemplateId: templateId,
                workoutLogId: undefined,
                userId,
                name: draft.name.trim(),
                category: draft.category.trim() || undefined,
                quantity: draft.quantity,
                isPacked: false,
                sortOrder: i,
                notes: draft.notes.trim() || undefined,
              },
              templateId,
              'template',
            ),
          )
        }
      }
      const upsertResults = await Promise.allSettled(upsertOps)

      const allFailures = [
        ...deleteResults.filter((r) => r.status === 'rejected'),
        ...upsertResults.filter((r) => r.status === 'rejected'),
      ]
      if (allFailures.length > 0) {
        console.error(`[event-template-form] ${allFailures.length} item operation(s) failed`)
        throw new Error(`${allFailures.length} item operation(s) failed to save`)
      }
    },
    [draftItems, userId],
  )

  // -- Save ----------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!validate()) return
    if (!userId) return

    const eventMetadata: EventMetadata = {
      eventDate: combineDateTime(eventDate, eventTime),
      location: location.trim() || undefined,
      latitude: (() => {
        const lat = parseFloat(latitude)
        return !isNaN(lat) ? lat : undefined
      })(),
      longitude: (() => {
        const lng = parseFloat(longitude)
        return !isNaN(lng) ? lng : undefined
      })(),
      eventUrl: eventUrl.trim() || undefined,
      requirements: requirements
        .filter((r) => r.key.trim())
        .map((r) => ({
          key: r.key.trim(),
          value: r.value.trim(),
          unit: r.unit.trim() || undefined,
          notes: r.notes.trim() || undefined,
        })),
    }

    try {
      if (isEditing && initial) {
        // -- Update existing template --
        const result = await updateMutation.mutateAsync({
          template: {
            ...initial.template,
            name: name.trim(),
            description: description.trim() || undefined,
            category: 'EVENT',
            scoring: 'NONE',
            eventMetadata,
          },
          groups: [], // EVENT templates have no activity groups
        })

        // Reconcile event items: delete removed, update existing, create new
        await reconcileEventItems(result.template.id, initial)

        setBaselineSnapshot(currentSnapshot)
        onSave?.(result.template)
      } else {
        // -- Create new template --
        const result = await createMutation.mutateAsync({
          template: {
            userId,
            name: name.trim(),
            description: description.trim() || undefined,
            category: 'EVENT',
            scoring: 'NONE',
            isPublic: false,
            eventMetadata,
          },
          groups: [], // EVENT templates have no activity groups
        })

        // Create event items for the new template
        await createDraftItems(result.template.id)

        setBaselineSnapshot(currentSnapshot)
        onSave?.(result.template)
      }
    } catch (err) {
      const action = isEditing ? 'update' : 'create'
      console.error(`[event-template-form] Failed to ${action} event "${name.trim()}":`, err)
      setErrors([`Failed to ${action} event. Please try again.`])
    }
  }, [
    validate,
    userId,
    isEditing,
    initial,
    name,
    description,
    eventDate,
    eventTime,
    location,
    latitude,
    longitude,
    eventUrl,
    requirements,
    createMutation,
    updateMutation,
    onSave,
    currentSnapshot,
    createDraftItems,
    reconcileEventItems,
  ])

  // -- Render --------------------------------------------------------------

  return (
    <div className="space-y-6 p-4 pb-8">
      {/* Header */}
      <h2 className="font-display text-xl tracking-wide text-bone-white">
        {isEditing ? 'EDIT EVENT' : 'NEW EVENT'}
      </h2>

      {/* Name field */}
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          NAME
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Event name"
          className={cn(underlineInput, 'font-display text-lg font-medium')}
          aria-label="Event name"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          DESCRIPTION (OPTIONAL)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this event"
          rows={2}
          className={cn(underlineInput, 'min-h-12 resize-none font-body text-sm')}
          aria-label="Event description"
        />
      </div>

      {/* Date / Time row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
            DATE
          </label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            placeholder="TBD"
            className={cn(underlineInput, 'min-h-12 text-sm')}
            aria-label="Event date"
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
            TIME
          </label>
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            placeholder="TBD"
            className={cn(underlineInput, 'min-h-12 text-sm')}
            aria-label="Event time"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          LOCATION
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Event location"
          className={cn(underlineInput, 'text-sm')}
          aria-label="Event location"
        />

        {/* Coordinates toggle */}
        <button
          type="button"
          onClick={() => setShowCoordinates((prev) => !prev)}
          className="mt-2 flex min-h-12 items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-ember hover:text-ember/80"
        >
          <Icon name={showCoordinates ? 'expand_less' : 'add'} size={16} />
          {showCoordinates ? 'HIDE COORDINATES' : 'ADD COORDINATES'}
        </button>

        {showCoordinates && (
          <div className="mt-2 flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
                LATITUDE
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 34.0522"
                className={cn(underlineInput, 'text-sm')}
                aria-label="Latitude"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
                LONGITUDE
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. -118.2437"
                className={cn(underlineInput, 'text-sm')}
                aria-label="Longitude"
              />
            </div>
          </div>
        )}
      </div>

      {/* Event URL */}
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-warm-ash">
          EVENT URL (OPTIONAL)
        </label>
        <input
          type="url"
          value={eventUrl}
          onChange={(e) => setEventUrl(e.target.value)}
          placeholder="https://..."
          className={cn(underlineInput, 'text-sm')}
          aria-label="Event URL"
        />
      </div>

      {/* Requirements section */}
      <div>
        <button
          type="button"
          onClick={() => setRequirementsExpanded((prev) => !prev)}
          className="flex min-h-12 w-full items-center justify-between text-left"
        >
          <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash">
            REQUIREMENTS ({requirements.length})
          </span>
          <Icon
            name={requirementsExpanded ? 'expand_less' : 'expand_more'}
            size={20}
            className="text-warm-ash"
          />
        </button>

        {requirementsExpanded && (
          <div className="mt-2 flex flex-col gap-4">
            {requirements.map((req, index) => (
              <RequirementEditor
                key={req._clientId}
                requirement={req}
                onChange={(updated) => handleUpdateRequirement(index, updated)}
                onDelete={() => handleDeleteRequirement(index)}
              />
            ))}
            <button
              type="button"
              onClick={handleAddRequirement}
              className="flex min-h-12 items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-ember hover:text-ember/80"
            >
              <Icon name="add" size={16} />
              ADD REQUIREMENT
            </button>
          </div>
        )}
      </div>

      {/* Packing list section */}
      <div>
        <button
          type="button"
          onClick={() => setPackingExpanded((prev) => !prev)}
          className="flex min-h-12 w-full items-center justify-between text-left"
        >
          <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash">
            PACKING LIST ({draftItems.length})
          </span>
          <Icon
            name={packingExpanded ? 'expand_less' : 'expand_more'}
            size={20}
            className="text-warm-ash"
          />
        </button>

        {packingExpanded && (
          <div className="mt-2 flex flex-col gap-4">
            {draftItems.map((item, index) => (
              <EventItemEditor
                key={item._clientId}
                item={item}
                onChange={(updated) => handleUpdateItem(index, updated)}
                onDelete={() => handleDeleteItem(index)}
              />
            ))}
            <button
              type="button"
              onClick={handleAddItem}
              className="flex min-h-12 items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-ember hover:text-ember/80"
            >
              <Icon name="add" size={16} />
              ADD ITEM
            </button>
          </div>
        )}
      </div>

      {/* Warnings (EV-8) */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {warnings.map((warn, i) => (
            <p key={i} className="text-xs text-amber-400">
              {warn}
            </p>
          ))}
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="min-h-12 flex-1 text-xs uppercase tracking-wider"
          >
            CANCEL
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-12 flex-1 text-xs uppercase tracking-wider"
        >
          {isSaving ? 'SAVING...' : 'SAVE EVENT'}
        </Button>
      </div>
    </div>
  )
}
