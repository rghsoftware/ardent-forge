# Tech Plan: Events & Packing Lists

**Feature:** 002-events-packing-lists
**Step:** 13.5
**Status:** Planning
**Date:** 2026-04-01

---

## Architecture Overview

Events extend the existing SessionTemplate/WorkoutLog system rather than introducing a new top-level entity. The discriminator is `category: 'EVENT'` on session templates and workout logs. When this category is set, the template/log carries `eventMetadata` (JSON) and associated `event_items` rows instead of activity groups, activities, and sets.

```
SessionTemplate (category = EVENT)
  |-- eventMetadata (JSON column)        -- value object: date, location, URL, requirements[]
  |-- event_items[] (dedicated table)    -- entity: packing list items with isPacked state
  
WorkoutLog (category = EVENT)
  |-- eventMetadata (JSON column)        -- copied from template or created ad-hoc
  |-- event_items[] (dedicated table)    -- live packing state, toggled during prep
```

This design reuses all existing infrastructure: programs, scheduled sessions, sync, sharing, and RLS. No new routes are needed -- events render conditionally within existing session template and workout log views.

---

## Key Decisions

### KD-1: Storage split -- JSON column + dedicated table

**Decision:** EventMetadata (including requirements) stored as JSON column; EventItem stored in a dedicated `event_items` table.

**Why:** Requirements are read-only display data written atomically with the event. Packing items need individual row-level operations (toggle isPacked, reorder, add/delete) without rewriting the entire JSON blob. The polymorphic FK (`session_template_id XOR workout_log_id`) allows items to belong to either a template (planning phase) or a log (execution phase).

**Alternatives considered:**
- All-JSON (single column): Simpler schema, but toggle operations require full JSON rewrite and lose row-level RLS/locking.
- Separate `events` table: Adds a new aggregate root and complicates program scheduling, sync, and sharing. Rejected per PRD decision E-1.

### KD-2: SessionType enum extension -- add 'EVENT'

**Decision:** Add `'EVENT'` to `sessionTypeSchema` and the DB CHECK constraint on `session_templates.category`.

**Impact:** The Zod enum change propagates to all consumers. Invariant EV-1 ensures mutual exclusivity: EVENT templates have no activity groups; non-EVENT templates have no event metadata. This is enforced via Zod refinement at the domain layer and can optionally be enforced at the DB layer via a trigger (deferred -- Zod is the primary gate).

**Migration approach:** `ALTER TABLE session_templates DROP CONSTRAINT ...` then re-add with the expanded enum. Same for `workout_logs` if it has a category column (it does not currently -- category is derived from the linked template). For standalone event logs, we add a `category` column to `workout_logs`.

**Correction:** Looking at the current schema, `workout_logs` does NOT have a `category` column. Event workout logs created via quick-log (no template link) need event metadata stored directly. The `event_metadata` JSON column on `workout_logs` serves as the implicit discriminator -- if `event_metadata IS NOT NULL`, it is an event log. This avoids adding a new column to `workout_logs` for category.

### KD-3: Event creation as Sheet overlay

**Decision:** Event creation form renders in a Sheet (bottom drawer), matching the existing `SessionTemplateForm` pattern.

**Why:** Consistent UX. The library page already opens session template forms in a Sheet. Events are just another session type. The Sheet receives a `category: 'EVENT'` prop to render event-specific fields instead of activity group editors.

**Implementation:** Extend `SessionTemplateForm` with conditional rendering based on `category`, OR create a parallel `EventTemplateForm` component. Given the forms share almost no fields beyond name/description, a **separate `EventTemplateForm` component** is cleaner.

### KD-4: Event detail as conditional rendering in existing views

**Decision:** When viewing a session template or workout log with `category = EVENT`, render the event detail UI (metadata + packing list) instead of the exercise/set UI.

**Where:**
- Library page: `SessionTemplateCard` checks category and renders event-specific card variant
- Workout log detail (`/history/$workoutId`): Conditionally renders `EventDetail` component instead of logged sets
- Active workout (`/log/$workoutId`): Conditionally renders `EventCheckoff` component instead of set logging

### KD-5: Optimistic updates for packing toggle

**Decision:** Use TanStack Query optimistic updates for `toggleEventItemPacked` to achieve < 100ms visual feedback.

**Pattern:** `onMutate` updates the query cache immediately; `onError` rolls back; `onSettled` invalidates. This matches the existing `useCreateLoggedSet` and `useUpdateLoggedSet` optimistic update pattern already in the codebase.

### KD-6: Packing reorder -- immediate persist (not draft)

**Decision:** Unlike the program builder (which uses an in-memory draft and persists on explicit save), packing list reorder persists immediately on drag-end via `reorderEventItems`.

**Why:** The event detail screen is not a form with a save button -- it is a live checklist. Users expect changes to stick immediately (like toggling isPacked). Batch-updating `sort_order` values is a lightweight operation.

### KD-7: Notification channel registration

**Decision:** Add `event_reminders` channel to the existing `register_channels()` function in `src-tauri/src/notification.rs`.

**Implementation:** New channel alongside the existing four. Importance: Default. The event reminder scheduler follows the same pattern as `SessionReminderState` -- a Tokio background task polling on an interval, checking for upcoming events with `eventDate` within the configured reminder windows.

---

## Stack-Specific Details

### Database Layer (Supabase/Postgres)

**New migration: `YYYYMMDDHHMMSS_create_event_tables.sql`**

1. **ALTER `session_templates`:**
   - Drop and re-add `category` CHECK to include `'EVENT'`
   - Add `event_metadata JSONB` column (nullable)

2. **ALTER `workout_logs`:**
   - Add `event_metadata JSONB` column (nullable)

3. **CREATE `event_items` table:**

```sql
CREATE TABLE event_items (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_template_id   UUID        REFERENCES session_templates(id) ON DELETE CASCADE,
    workout_log_id        UUID        REFERENCES workout_logs(id) ON DELETE CASCADE,
    user_id               UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    name                  TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    category              TEXT,
    quantity              INTEGER     NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    is_packed             BOOLEAN     NOT NULL DEFAULT false,
    sort_order            INTEGER     NOT NULL CHECK (sort_order >= 0),
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CHECK (
        (session_template_id IS NOT NULL AND workout_log_id IS NULL)
        OR (session_template_id IS NULL AND workout_log_id IS NOT NULL)
    )
);
```

4. **Indices:**

```sql
CREATE INDEX idx_event_items_template ON event_items(session_template_id) 
    WHERE session_template_id IS NOT NULL;
CREATE INDEX idx_event_items_workout_log ON event_items(workout_log_id) 
    WHERE workout_log_id IS NOT NULL;
CREATE INDEX idx_event_items_user ON event_items(user_id);
```

5. **RLS:** Standard `user_id = auth.uid()` pattern (direct ownership via denormalized `user_id`, not JOIN-based). Four policies: SELECT, INSERT, UPDATE, DELETE.

6. **Trigger:** Reuse `update_updated_at_column()` for `set_updated_at` trigger.

### Domain Layer (`src/domain/types/`)

**New file: `src/domain/types/event.ts`**

```typescript
// EventMetadata -- value object, stored as JSON column
export const eventRequirementSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  unit: z.string().optional(),
  notes: z.string().optional(),
})

export const eventMetadataSchema = z.object({
  eventDate: isoDateTime.optional(),      // nullable = "TBD"
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  eventUrl: z.string().url().optional(),
  requirements: z.array(eventRequirementSchema).default([]),
})

// EventItem -- entity, stored in event_items table
export const eventItemSchema = syncableEntitySchema.extend({
  sessionTemplateId: entityId.optional(),
  workoutLogId: entityId.optional(),
  userId: entityId,
  name: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  isPacked: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative(),
  notes: z.string().optional(),
})
```

**Modify `src/domain/types/session.ts`:**
- Add `'EVENT'` to `sessionTypeSchema` enum
- Add `eventMetadata: eventMetadataSchema.optional()` to `sessionTemplateSchema`
- Add Zod refinement for EV-1: if category is EVENT, eventMetadata may be present; if not EVENT, eventMetadata must be undefined

**Modify `src/domain/types/workout-log.ts`:**
- Add `eventMetadata: eventMetadataSchema.optional()` to `workoutLogSchema`

**Update `src/domain/types/index.ts`:**
- Add `export * from './event'`

### Data Layer

**New row type in `src/lib/database.types.ts`:**

```typescript
export interface EventItemRow {
  id: string
  session_template_id: string | null
  workout_log_id: string | null
  user_id: string
  name: string
  category: string | null
  quantity: number
  is_packed: boolean
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}
```

**Update existing row types:**
- `SessionTemplateRow`: add `event_metadata: unknown` (JSONB, Supabase returns pre-parsed for JSONB columns on this table... actually, checking the existing pattern: `rest_between_groups` is `string | null` on SessionTemplateRow. So `event_metadata` should be `string | null` for consistency, using `JSON.parse()` in the mapper.)

**Correction based on research:** The existing `SessionTemplateRow` uses `string | null` for JSONB columns (Pattern B -- `JSON.parse` then Zod parse). `WorkoutLogRow` uses `unknown` (Pattern A -- direct Zod parse). Follow the same per-table pattern:
- `SessionTemplateRow.event_metadata: string | null` (Pattern B)
- `WorkoutLogRow.event_metadata: unknown` (Pattern A)

**New mappers in `src/lib/data-mapper.ts`:**

```typescript
export function toEventItem(row: EventItemRow): EventItem
export function fromEventItem(
  item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>,
  parentId: string,
  parentType: 'template' | 'log',
): Partial<EventItemRow>
```

EventMetadata parsing is embedded in the existing `toSessionTemplate` and `toWorkoutLog` mappers (add conditional parse of the new `event_metadata` column).

**New adapter methods in `DataAdapter` interface:**

```typescript
// Event items
getEventItems(parentId: string, parentType: 'template' | 'log'): Promise<EventItem[]>
saveEventItem(item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<EventItem>
updateEventItem(item: EventItem): Promise<EventItem>
deleteEventItem(itemId: string): Promise<void>
toggleEventItemPacked(itemId: string, userId: string): Promise<EventItem>
reorderEventItems(items: Array<{ id: string; sortOrder: number }>): Promise<void>
```

**SupabaseAdapter implementation notes:**
- `getEventItems`: Single query with `eq('session_template_id' | 'workout_log_id', parentId)` + `order('category', 'sort_order')`
- `toggleEventItemPacked`: Read current `is_packed`, then update with `!is_packed`. (No server-side `NOT` toggle available via Supabase JS client -- requires two operations or an RPC function.)
- `reorderEventItems`: Loop of individual updates (acceptable for small lists) or a single RPC function for batch update

**Composite type extension:**
- `SessionTemplateFull` gains `eventItems: EventItem[]` (empty array for non-EVENT templates)
- `getSessionTemplateFull` adds a fourth query for event items when `category = 'EVENT'`

### Hook Layer (`src/hooks/`)

**New file: `src/hooks/use-event-items.ts`**

Query keys:
- `['event-items', parentId]` -- list of items for a template or log
- `['next-event']` -- lightweight query for Today screen countdown

Mutations:
- `useCreateEventItem` -- invalidates `['event-items', parentId]`
- `useUpdateEventItem` -- invalidates `['event-items', parentId]`
- `useDeleteEventItem` -- invalidates `['event-items', parentId]`
- `useToggleEventItemPacked` -- optimistic update on `['event-items', parentId]`
- `useReorderEventItems` -- optimistic update on `['event-items', parentId]`

### UI Layer (`src/components/`)

**New directory: `src/components/event-builder/`**

| File | Purpose |
|------|---------|
| `event-template-form.tsx` | Creation/edit form in Sheet overlay |
| `event-detail.tsx` | Event detail view (metadata + packing list) |
| `event-item-editor.tsx` | Single packing item row (add/edit) |
| `requirement-editor.tsx` | Single requirement row (key-value-unit-notes) |
| `packing-list.tsx` | Categorized checklist with progress bars and DnD |
| `packing-item.tsx` | Single packing item with checkbox toggle |
| `event-progress-bar.tsx` | Horizontal progress bar (ember on surface-steel) |
| `event-card.tsx` | Card variant for library list and program timeline |
| `event-countdown-badge.tsx` | Countdown badge component (reused on Today screen) |

**DnD setup for packing list:**
- Reuse existing pattern from `block-list.tsx`: `DndContext` + `SortableContext` + `verticalListSortingStrategy`
- `PointerSensor` with `activationConstraint: { distance: 8 }`
- `restrictToVerticalAxis` modifier (same inline function)
- `useSortable` per `PackingItem` with dedicated drag handle
- On `handleDragEnd`: compute new `sortOrder` values, call `reorderEventItems` mutation immediately

**Form state for event creation:**
- `useState` for each field (name, eventDate, location, lat, lng, eventUrl)
- `useState<EventRequirement[]>` for requirements array
- `useState<Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>[]>` for draft packing items
- Manual validation matching existing pattern (error string array)
- Save: build `eventMetadata` JSON, create template via extended `createSessionTemplateFull`, then create event items in sequence

### Routing Integration

No new routes. Conditional rendering at these points:

| Location | Condition | Renders |
|----------|-----------|---------|
| Library page (`library.tsx`) | `template.category === 'EVENT'` | `EventCard` instead of `SessionTemplateCard` |
| Library Sheet | `category === 'EVENT'` | `EventTemplateForm` instead of `SessionTemplateForm` |
| Workout log detail (`history/$workoutId.tsx`) | `log.eventMetadata != null` | `EventDetail` instead of logged sets view |
| Active workout (`log/$workoutId.tsx`) | `log.eventMetadata != null` | `EventCheckoff` (live packing) instead of set logging |
| Program timeline | `session.category === 'EVENT'` | Flag icon + event card styling |
| Today screen (`index.tsx`) | Next event within 30 days | `EventCountdownBadge` below `ProgramSessionCard` |

### Notification Layer (Tauri/Rust)

**Modify `src-tauri/src/notification.rs`:**
- Add `event_reminders` channel to `register_channels()`

**New file: `src-tauri/src/event_reminder.rs`:**
- `EventReminderState` (mirrors `SessionReminderState` pattern)
- Background Tokio task polling every 60 seconds
- Query: find event templates with `eventDate` in the future, within configured reminder windows
- Notification includes packing progress count
- Respects quiet hours
- Notification ID: hash of `template_id + days_remaining`

**Modify `src/domain/types/notification.ts`:**
- Add `eventReminders` section to `NotificationPreferences` schema: `{ enabled: boolean, intervals: number[] }` with defaults `{ enabled: true, intervals: [7, 3, 1] }`

---

## Integration Points

| System | Integration | Risk |
|--------|------------|------|
| Session templates | Add EVENT category, eventMetadata column | Low -- additive change, existing code ignores unknown categories |
| Workout logs | Add eventMetadata column | Low -- nullable, existing code unaffected |
| Program builder | Allow EVENT sessions in block weeks | Medium -- ScheduledSession rendering needs conditional logic |
| Sync engine | event_items table needs sync rules | Medium -- depends on sync step completion status |
| Clone operation | Must reset isPacked on all items | Low -- clear requirement, isolated logic |
| Share links | Event templates shareable | Low -- existing share infrastructure handles any template |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Non-atomic event creation (template + items in separate requests) | High | Medium | Accept for now (matches existing session template pattern). Add RPC function in future for atomic creation. |
| DnD reorder race condition (rapid reorders before previous persists) | Low | Low | Debounce reorder mutations; optimistic UI ensures visual consistency |
| Notification scheduler complexity in Rust | Medium | Medium | Follow exact pattern from `session_reminder.rs`; keep query simple |
| Category CHECK constraint migration on existing data | Low | High | Migration only adds a new allowed value; no data modification needed |
| Event items query performance with many items | Low | Low | Partial indices on polymorphic FK; typical event has < 50 items |

## Files to Create

| File | Layer |
|------|-------|
| `supabase/migrations/YYYYMMDDHHMMSS_create_event_tables.sql` | Database |
| `src/domain/types/event.ts` | Domain |
| `src/hooks/use-event-items.ts` | Hooks |
| `src/components/event-builder/event-template-form.tsx` | UI |
| `src/components/event-builder/event-detail.tsx` | UI |
| `src/components/event-builder/event-item-editor.tsx` | UI |
| `src/components/event-builder/requirement-editor.tsx` | UI |
| `src/components/event-builder/packing-list.tsx` | UI |
| `src/components/event-builder/packing-item.tsx` | UI |
| `src/components/event-builder/event-progress-bar.tsx` | UI |
| `src/components/event-builder/event-card.tsx` | UI |
| `src/components/event-builder/event-countdown-badge.tsx` | UI |
| `src-tauri/src/event_reminder.rs` | Native |

## Files to Modify

| File | Change |
|------|--------|
| `src/domain/types/session.ts` | Add EVENT to SessionType enum, add eventMetadata field |
| `src/domain/types/workout-log.ts` | Add eventMetadata field |
| `src/domain/types/index.ts` | Export event types |
| `src/domain/types/notification.ts` | Add eventReminders preferences |
| `src/lib/database.types.ts` | Add EventItemRow, update SessionTemplateRow and WorkoutLogRow |
| `src/lib/data-mapper.ts` | Add toEventItem/fromEventItem, update toSessionTemplate/toWorkoutLog for eventMetadata |
| `src/lib/data-adapter.ts` | Add event item methods to interface, update SessionTemplateFull type |
| `src/lib/supabase-adapter.ts` | Implement event item methods, update getSessionTemplateFull |
| `src/routes/_authenticated/library.tsx` | Conditional rendering for EVENT templates |
| `src/routes/_authenticated/index.tsx` | Add event countdown badge |
| `src/routes/_authenticated/log.$workoutId.tsx` | Conditional rendering for event logs |
| `src/routes/_authenticated/history/$workoutId.tsx` | Conditional rendering for event history |
| `src/components/program-builder/` | Event visual treatment in timeline |
| `src-tauri/src/notification.rs` | Add event_reminders channel |
| `src-tauri/src/lib.rs` | Register event reminder module |
