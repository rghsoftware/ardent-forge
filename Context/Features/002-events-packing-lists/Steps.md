# Implementation Steps: Events & Packing Lists

**Feature:** 002-events-packing-lists
**Step:** 13.5
**Status:** Complete
**Date:** 2026-04-02

---

## Team Composition

| Role | Agent Type | Domains |
|------|-----------|---------|
| backend-engineer | Specialist | Database migrations, RLS, SQL |
| domain-engineer | Specialist | Zod schemas, domain types, data mappers, row types |
| data-engineer | Specialist | DataAdapter interface, SupabaseAdapter implementation, TanStack Query hooks |
| frontend-engineer | Specialist | React components, forms, DnD, design system |
| native-engineer | Specialist | Rust/Tauri notification system |
| quality-engineer | Validator | Cross-cutting validation of each milestone |

---

## Wave 1: Database + Domain Foundation

> **Goal:** Schema exists, domain types compile, data layer can read/write event data.

### S001 -- Database migration for event tables
- **Agent:** backend-engineer
- **Parallel:** Yes (independent)
- **Files to create:** `supabase/migrations/YYYYMMDDHHMMSS_create_event_tables.sql`
- **Work:**
  1. ALTER `session_templates`: drop and re-add `category` CHECK to include `'EVENT'`; add `event_metadata JSONB` nullable column
  2. ALTER `workout_logs`: add `event_metadata JSONB` nullable column
  3. CREATE `event_items` table with UUID PK, polymorphic FK (session_template_id XOR workout_log_id), user_id, name, category, quantity, is_packed, sort_order, notes, timestamps
  4. CHECK constraints: FK exclusivity, quantity >= 1, sort_order >= 0, name length 1-200
  5. Partial indices on session_template_id and workout_log_id; index on user_id
  6. RLS: ENABLE + 4 policies (SELECT/INSERT/UPDATE/DELETE) with `user_id = auth.uid()`
  7. Trigger: reuse `update_updated_at_column()` for set_updated_at
- **Acceptance:**
  - Migration applies cleanly on fresh and existing databases
  - `INSERT INTO event_items` with both FKs non-null is rejected
  - `INSERT INTO event_items` with both FKs null is rejected
  - `INSERT INTO event_items` with quantity = 0 is rejected
  - `INSERT INTO session_templates` with category = 'EVENT' succeeds
  - RLS blocks cross-user access to event_items
- **Depends on:** Nothing

### S002 -- Domain types and Zod schemas
- **Agent:** domain-engineer
- **Parallel:** Yes (independent of S001)
- **Files to create:** `src/domain/types/event.ts`
- **Files to modify:** `src/domain/types/session.ts`, `src/domain/types/workout-log.ts`, `src/domain/types/index.ts`
- **Work:**
  1. Create `event.ts` with `eventRequirementSchema`, `eventMetadataSchema`, `eventItemSchema` (extending `syncableEntitySchema`)
  2. Export types: `EventRequirement`, `EventMetadata`, `EventItem`
  3. In `session.ts`: add `'EVENT'` to `sessionTypeSchema` enum; add `eventMetadata: eventMetadataSchema.optional()` to `sessionTemplateSchema`
  4. Add Zod refinement for EV-1: if category is 'EVENT', no activity groups expected at this layer (activity groups are separate entities, so refinement is on the composite level, not the schema level -- add a comment noting this)
  5. In `workout-log.ts`: add `eventMetadata: eventMetadataSchema.optional()` to `workoutLogSchema`
  6. In `index.ts`: add `export * from './event'`
- **Acceptance:**
  - `eventMetadataSchema.parse({ requirements: [] })` succeeds (all optional fields)
  - `eventMetadataSchema.parse({ eventDate: 'not-a-date' })` fails
  - `eventItemSchema.parse({ ..., quantity: 0 })` fails (EV-3)
  - `eventItemSchema.parse({ ..., sortOrder: -1 })` fails (EV-4)
  - `sessionTemplateSchema.parse({ ..., category: 'EVENT' })` succeeds
  - Types compile with no errors
- **Depends on:** Nothing

### S003 -- Row types, data mappers, adapter interface
- **Agent:** domain-engineer
- **Parallel:** No (depends on S002)
- **Files to modify:** `src/lib/database.types.ts`, `src/lib/data-mapper.ts`, `src/lib/data-adapter.ts`
- **Work:**
  1. Add `EventItemRow` interface to `database.types.ts` (snake_case columns)
  2. Update `SessionTemplateRow`: add `event_metadata: string | null` (Pattern B -- JSON string)
  3. Update `WorkoutLogRow`: add `event_metadata: unknown` (Pattern A -- pre-parsed JSONB)
  4. Add `toEventItem(row: EventItemRow): EventItem` mapper
  5. Add `fromEventItem(item, parentId, parentType): Partial<EventItemRow>` mapper
  6. Update `toSessionTemplate`: parse `event_metadata` with `JSON.parse()` then `eventMetadataSchema.parse()` when non-null
  7. Update `fromSessionTemplate`: `JSON.stringify(eventMetadata)` when present
  8. Update `toWorkoutLog`: parse `event_metadata` directly with `eventMetadataSchema.parse()` when non-null
  9. Update `fromWorkoutLog`: stringify eventMetadata when present
  10. Add event item methods to `DataAdapter` interface: `getEventItems`, `saveEventItem`, `updateEventItem`, `deleteEventItem`, `toggleEventItemPacked`, `reorderEventItems`
  11. Update `SessionTemplateFull` type: add `eventItems: EventItem[]`
- **Acceptance:**
  - `toEventItem` correctly maps snake_case row to camelCase domain type
  - `fromEventItem` correctly maps back with parent FK set
  - `toSessionTemplate` with non-null `event_metadata` returns parsed `EventMetadata`
  - `toSessionTemplate` with null `event_metadata` returns `undefined`
  - `DataAdapter` interface compiles (SupabaseAdapter will have type errors until S004)
- **Depends on:** S002

### S004 -- SupabaseAdapter implementation
- **Agent:** data-engineer
- **Parallel:** No (depends on S003)
- **Files to modify:** `src/lib/supabase-adapter.ts`
- **Work:**
  1. Implement `getEventItems(parentId, parentType)`: query `event_items` with eq on appropriate FK column, order by `category, sort_order`
  2. Implement `saveEventItem(item)`: insert with `fromEventItem`, return mapped result
  3. Implement `updateEventItem(item)`: update by id, return mapped result
  4. Implement `deleteEventItem(itemId)`: delete by id
  5. Implement `toggleEventItemPacked(itemId, userId)`: select current row, update with `!is_packed`, return mapped result
  6. Implement `reorderEventItems(items)`: loop of updates setting `sort_order` by id (acceptable for < 50 items)
  7. Update `getSessionTemplateFull`: when template.category === 'EVENT', add fourth query for event items; set `eventItems: []` for non-EVENT templates
  8. Update `createSessionTemplateFull`: accept optional eventItems parameter, insert after template creation
  9. Update `updateSessionTemplateFull`: delete existing event items, re-insert (delete-and-recreate pattern)
- **Acceptance:**
  - `getEventItems` returns items sorted by category then sort_order
  - `toggleEventItemPacked` flips the boolean and returns updated item
  - `reorderEventItems` persists new sort_order values
  - `getSessionTemplateFull` for an EVENT template includes eventItems array
  - `getSessionTemplateFull` for a non-EVENT template has empty eventItems array
  - All methods throw on Supabase errors
- **Depends on:** S001, S003

---

### M1 -- Milestone: Data Layer Complete
- **Validates:** TA-1, TA-2, TA-3, TA-4, TA-5, TA-12
- **Gate:** Migration applies, domain types compile, adapter methods work end-to-end against local Supabase
- **Quality check:** quality-engineer validates S001-S004

### S004-V -- Validate Wave 1
- **Agent:** quality-engineer
- **Parallel:** No
- **Work:**
  1. Verify migration applies on local Supabase (`npx supabase db push`)
  2. Verify CHECK constraints reject invalid data (both FKs null, both non-null, quantity < 1)
  3. Verify RLS blocks cross-user access
  4. Verify TypeScript compiles with no errors (`bun run build`)
  5. Verify existing tests still pass (`bun run test`)
  6. Spot-check mapper round-trip: domain -> row -> domain for EventItem and EventMetadata
- **Depends on:** S004

---

## Wave 2: TanStack Query Hooks + Event Creation UI

> **Goal:** Users can create event templates with metadata and packing lists.

### S005 -- TanStack Query hooks for events
- **Agent:** data-engineer
- **Parallel:** Yes (after M1)
- **Files to create:** `src/hooks/use-event-items.ts`
- **Work:**
  1. `useEventItems(parentId, parentType)` -- query key `['event-items', parentId]`, enabled when parentId truthy
  2. `useCreateEventItem()` -- mutation, invalidates `['event-items']` in onSettled
  3. `useUpdateEventItem()` -- mutation, invalidates `['event-items', parentId]`
  4. `useDeleteEventItem()` -- mutation, invalidates `['event-items', parentId]`
  5. `useToggleEventItemPacked(parentId)` -- mutation with optimistic update in onMutate (flip isPacked in cache), rollback in onError, invalidate in onSettled
  6. `useReorderEventItems(parentId)` -- mutation with optimistic update (reorder array in cache)
  7. `useNextUpcomingEvent(userId)` -- lightweight query for Today screen countdown, query key `['next-event', userId]`
- **Acceptance:**
  - `useToggleEventItemPacked` updates cache immediately (optimistic)
  - `useReorderEventItems` updates cache immediately (optimistic)
  - Error rollback restores previous cache state
  - All mutations invalidate appropriate query keys in onSettled
- **Depends on:** S004-V

### S006 -- Event creation form component
- **Agent:** frontend-engineer
- **Parallel:** Yes (after M1, parallel with S005)
- **Files to create:** `src/components/event-builder/event-template-form.tsx`, `src/components/event-builder/requirement-editor.tsx`, `src/components/event-builder/event-item-editor.tsx`
- **Work:**
  1. `EventTemplateForm` component with props: `initial?: SessionTemplateFull`, `onSave?`, `onCancel?`
  2. State: `useState` for name, eventDate, location, latitude, longitude, eventUrl, requirements[], draftItems[], errors[]
  3. Form layout per Flow 10:
     - "NEW EVENT" header (Space Grotesk, ALL-CAPS)
     - Name: underline input, required
     - Date/time: date + time pickers, optional (shows "TBD" placeholder)
     - Location: underline input + "ADD COORDINATES" toggle revealing lat/lng inputs
     - Event URL: underline input, optional
     - Requirements: expandable section with "+ ADD REQUIREMENT" button
     - Packing list: expandable section with "+ ADD ITEM" button
     - "SAVE EVENT" forge button
  4. `RequirementEditor`: inline row with key, value, unit, notes fields + delete button
  5. `EventItemEditor`: inline row with name, category, quantity, notes fields + delete button
  6. Manual validation: name required, EV-8 soft warning (lat/lng without location)
  7. Save: build eventMetadata JSON + items array, call createSessionTemplateFull mutation
  8. Edit mode: hydrate from `initial` prop, call updateSessionTemplateFull mutation
  9. All text industrial vocabulary, 0px border-radius, underline inputs, min-h-12 touch targets
- **Acceptance:**
  - Form renders all fields per Flow 10 spec
  - Validation prevents save without name
  - Soft warning shown when coordinates provided without location
  - Requirements can be added/removed dynamically
  - Packing items can be added/removed dynamically
  - Save creates template with event_metadata and event_items
  - Edit mode pre-fills all fields from existing template
- **Depends on:** S004-V

### S007 -- Event card for library list
- **Agent:** frontend-engineer
- **Parallel:** Yes (parallel with S006)
- **Files to create:** `src/components/event-builder/event-card.tsx`
- **Files to modify:** `src/routes/_authenticated/library.tsx`
- **Work:**
  1. `EventCard` component showing: flag icon, event name, date (or "TBD"), location, item count badge
  2. Card styling: `surface-steel` background, `ember` accent, hard edges (0px radius)
  3. Tap opens `EventTemplateForm` in Sheet for editing
  4. Modify library page: when rendering template list, check `template.category` -- render `EventCard` for EVENT, existing `SessionTemplateCard` for others
  5. Add "NEW EVENT" button/option to library page creation flow (alongside existing "NEW SESSION" button)
- **Acceptance:**
  - EVENT templates render as EventCard in library list
  - Non-EVENT templates unchanged
  - Tapping EventCard opens edit form in Sheet
  - "NEW EVENT" button opens creation form with category pre-set to EVENT
- **Depends on:** S004-V

---

### M2 -- Milestone: Event Creation Complete
- **Validates:** TA-1, TA-2, TA-16
- **Gate:** Users can create, edit, and view event templates in the library with full metadata and packing lists
- **Quality check:** quality-engineer validates S005-S007

### S007-V -- Validate Wave 2
- **Agent:** quality-engineer
- **Parallel:** No
- **Work:**
  1. Create an event template via the form, verify it appears in the library
  2. Edit the template, verify changes persist
  3. Verify event_metadata and event_items in database match form input
  4. Verify soft warning for coordinates without location
  5. Verify TypeScript compiles, existing tests pass
  6. Visual check: industrial vocabulary, hard edges, correct design tokens
- **Depends on:** S005, S006, S007

---

## Wave 3: Event Detail + Packing Check-off

> **Goal:** Users can view event details and check off packing items with optimistic updates.

### S008 -- Event detail and packing list components
- **Agent:** frontend-engineer
- **Parallel:** Yes (after M2)
- **Files to create:** `src/components/event-builder/event-detail.tsx`, `src/components/event-builder/packing-list.tsx`, `src/components/event-builder/packing-item.tsx`, `src/components/event-builder/event-progress-bar.tsx`
- **Work:**
  1. `EventDetail` component (used in history view and active log):
     - Event header: name in Space Grotesk, countdown badge
     - Date/time row (formatted, or "TBD")
     - Location row: text + map icon (tappable when lat/lng present, opens `geo:` or Google Maps URL)
     - URL row: external link icon + truncated URL
     - Requirements: key-value list in `surface-steel` card
     - Packing list section
     - "EDIT EVENT" secondary button
  2. `PackingList` component:
     - Group items by `category` value (derive categories from unique values in items)
     - Collapsible category sections (default expanded)
     - `EventProgressBar` per category and overall
     - Renders `PackingItem` for each item
  3. `PackingItem` component:
     - Checkbox (filled `check_circle` in `primary` when packed, outlined when unpacked)
     - Name + quantity badge (when > 1)
     - Packed state: reduced opacity on name
     - Single-tap calls `useToggleEventItemPacked` (optimistic)
  4. `EventProgressBar` component:
     - Horizontal bar: `ember` (#FFB59C) fill on `surface-steel` (#353534) track
     - 0px border-radius
     - Label: "PACKED: X / Y" in ALL-CAPS
     - "ALL PACKED" badge when 100%
  5. Map link logic: if lat/lng present, wrap location text in `<a href="https://maps.google.com/?q={lat},{lng}">` (works cross-platform)
- **Acceptance:**
  - Event detail renders all metadata sections
  - Location is tappable map link when coordinates present (TA-9)
  - "TBD" shown when eventDate is null (TA-10)
  - Single-tap toggle updates isPacked with < 100ms visual feedback (TA-6)
  - Progress bar updates immediately on toggle (TA-7)
  - Category sections are collapsible
  - All packed shows "ALL PACKED" badge
  - Industrial vocabulary throughout
- **Depends on:** S007-V

### S009 -- Integrate event detail into existing routes
- **Agent:** frontend-engineer
- **Parallel:** No (depends on S008)
- **Files to modify:** `src/routes/_authenticated/history/$workoutId.tsx`, `src/routes/_authenticated/log.$workoutId.tsx`
- **Work:**
  1. In workout log detail (`history/$workoutId.tsx`): check if `log.eventMetadata != null`, render `EventDetail` (read-only mode, no packing toggle) instead of logged sets view
  2. In active workout (`log/$workoutId.tsx`): check if `log.eventMetadata != null`, render `EventDetail` (interactive mode with packing toggle) instead of set logging UI
  3. Ensure "EDIT EVENT" button in detail view opens `EventTemplateForm` in Sheet
- **Acceptance:**
  - Navigating to an event workout log shows event detail, not set logging UI
  - History view for an event log shows metadata and packing state (read-only)
  - Active event log allows packing toggle
  - Non-event workout logs render unchanged
- **Depends on:** S008

---

### M3 -- Milestone: Event Detail + Check-off Complete
- **Validates:** TA-6, TA-7, TA-9, TA-10
- **Gate:** Users can view event details, toggle packing items with optimistic feedback, and see progress
- **Quality check:** quality-engineer validates S008-S009

### S009-V -- Validate Wave 3
- **Agent:** quality-engineer
- **Parallel:** No
- **Work:**
  1. Create event template, start event workout, verify packing toggle works with < 100ms feedback
  2. Verify progress bar updates on each toggle
  3. Verify "TBD" display when eventDate is null
  4. Verify map link opens when coordinates present
  5. Verify history view shows event detail read-only
  6. Verify non-event workout logs are unaffected
  7. TypeScript compiles, tests pass
- **Depends on:** S009

---

## Wave 4: DnD Reorder + Clone + Program Timeline

> **Goal:** Drag-and-drop reorder, clone with isPacked reset, events in program timeline.

### S010 -- Drag-and-drop packing list reorder
- **Agent:** frontend-engineer
- **Parallel:** Yes (after M3)
- **Files to modify:** `src/components/event-builder/packing-list.tsx`, `src/components/event-builder/packing-item.tsx`
- **Work:**
  1. Add `DndContext` with `PointerSensor` (distance: 8) and `closestCenter` collision detection
  2. Add `restrictToVerticalAxis` modifier (inline, same as block-list.tsx)
  3. Wrap items per category in `SortableContext` with `verticalListSortingStrategy`
  4. Add `useSortable` to `PackingItem` with dedicated drag handle button
  5. `handleDragEnd`: compute new sortOrder values, call `useReorderEventItems` mutation (immediate persist)
  6. Visual feedback: opacity 0.5 while dragging
- **Acceptance:**
  - Items can be dragged within their category (TA-11)
  - Sort order persists after page reload
  - Rapid reorders don't cause visual glitches (optimistic updates)
  - Drag handle is distinct from checkbox tap target
- **Depends on:** S009-V

### S011 -- Clone with isPacked reset
- **Agent:** data-engineer
- **Parallel:** Yes (parallel with S010)
- **Files to modify:** `src/lib/supabase-adapter.ts`, `src/lib/data-adapter.ts`
- **Work:**
  1. If a clone/duplicate method exists for session templates, extend it to handle event items
  2. If no clone method exists, add `cloneSessionTemplate(id: string): Promise<SessionTemplateFull>` to the adapter
  3. Clone logic: copy template with new ID, copy eventMetadata as-is, copy all event_items with `is_packed = false` (EV-5)
  4. Wire clone action from EventCard context menu or EventTemplateForm
- **Acceptance:**
  - Cloned event has all items with isPacked = false (TA-8)
  - Cloned event has identical metadata (name, date, location, etc.)
  - Original event items unchanged
- **Depends on:** S009-V

### S012 -- Events in program timeline
- **Agent:** frontend-engineer
- **Parallel:** Yes (parallel with S010, S011)
- **Files to modify:** `src/components/program-builder/` (relevant timeline/schedule components)
- **Work:**
  1. Identify where scheduled sessions render in the program timeline (block week view)
  2. When `scheduledSession` references a template with `category = 'EVENT'`, render with:
     - Flag icon (Material Symbols `flag` or Unicode flag)
     - `surface-steel` card background with `ember` accent border/highlight
     - Event date shown alongside week/day label
  3. Ensure event sessions can be added to block weeks from the program builder (the "add session" flow should offer EVENT as a category option)
- **Acceptance:**
  - Events in program timeline show flag icon and distinct styling (TA-13)
  - Event date displays alongside the schedule position
  - Non-event sessions unchanged
- **Depends on:** S009-V

---

### M4 -- Milestone: Full Interaction Complete
- **Validates:** TA-8, TA-11, TA-13
- **Gate:** DnD reorder works, clone resets isPacked, events display correctly in program timeline
- **Quality check:** quality-engineer validates S010-S012

### S012-V -- Validate Wave 4
- **Agent:** quality-engineer
- **Parallel:** No
- **Work:**
  1. Drag-and-drop reorder: verify sort persists after reload
  2. Clone an event: verify all items have isPacked = false
  3. Add event to a program block: verify timeline rendering
  4. TypeScript compiles, tests pass
- **Depends on:** S010, S011, S012

---

## Wave 5: Today Screen Countdown + Notifications

> **Goal:** Event countdown on Today screen, configurable notification reminders.

### S013 -- Today screen event countdown badge
- **Agent:** frontend-engineer
- **Parallel:** Yes (after M4)
- **Files to create:** `src/components/event-builder/event-countdown-badge.tsx`
- **Files to modify:** `src/routes/_authenticated/index.tsx`
- **Work:**
  1. `EventCountdownBadge` component: flag icon + "EVENT NAME in N DAYS" text
     - `surface-steel` background, `ember` text for urgency (< 3 days: `primary-container` background)
     - 0px border-radius
     - Tappable: navigates to event detail
  2. Add `useNextUpcomingEvent` query to Today screen
  3. Render `EventCountdownBadge` below `ProgramSessionCard` when next event is within 30 days
  4. Handle no upcoming events gracefully (no badge rendered)
- **Acceptance:**
  - Countdown badge visible when event within 30 days (TA-16 area)
  - Badge shows correct day count
  - Tapping badge navigates to event
  - No badge when no upcoming events
  - Urgency styling when < 3 days
- **Depends on:** S012-V

### S014 -- Event countdown notifications (Rust)
- **Agent:** native-engineer
- **Parallel:** Yes (parallel with S013)
- **Files to create:** `src-tauri/src/event_reminder.rs`
- **Files to modify:** `src-tauri/src/notification.rs`, `src-tauri/src/lib.rs`, `src/domain/types/notification.ts`
- **Work:**
  1. Add `event_reminders` channel to `register_channels()` (Importance: Default)
  2. Add `eventReminders` to `NotificationPreferences` schema: `{ enabled: boolean, intervals: number[] }` default `{ enabled: true, intervals: [7, 3, 1] }`
  3. Create `EventReminderState` mirroring `SessionReminderState`:
     - Background Tokio task polling every 60 seconds
     - Query event templates with future `eventDate` from local SQLite
     - For each event, check if current date matches any configured interval
     - Check quiet hours, check enabled state
     - Fire notification: title = "[Event Name] in [N] days", body = "[X] of [Y] items packed" (when items exist)
     - Notification ID: hash of template_id + days_remaining (prevents duplicates)
  4. Register Tauri commands: `schedule_event_reminders`, `cancel_event_reminders`
  5. Wire into app startup (same lifecycle as session reminders)
- **Acceptance:**
  - Notification fires at configured intervals before event (TA-14)
  - Notification body includes packing progress (TA-15)
  - Quiet hours respected
  - No notification for past events or null eventDate
  - Notification tap navigates to event detail
- **Depends on:** S012-V

---

### M5 -- Milestone: Feature Complete
- **Validates:** TA-14, TA-15, all remaining assertions
- **Gate:** All P0 and P1 requirements met. Full end-to-end flow works: create event, add to program, check off packing, see countdown, receive notifications.
- **Quality check:** quality-engineer validates S013-S014 + full regression

### S014-V -- Validate Feature Complete
- **Agent:** quality-engineer
- **Parallel:** No
- **Work:**
  1. Full end-to-end walkthrough: create event with all fields, add items, save, view in library, view detail, toggle packing, verify progress
  2. DnD reorder, clone with isPacked reset
  3. Program timeline display
  4. Today screen countdown
  5. TypeScript compiles (`bun run build`)
  6. All tests pass (`bun run test`)
  7. Verify all 16 testable assertions from Spec.md
  8. Verify industrial vocabulary throughout (no emoji, no exclamation marks, ALL-CAPS headers)
  9. Verify design tokens: ember, surface-steel, 0px radius, horizontal progress bars
- **Depends on:** S013, S014

---

## Execution Summary

| Wave | Steps | Agents | Parallel? | Description |
|------|-------|--------|-----------|-------------|
| 1 | S001-S004 + S004-V | backend, domain, data, quality | Partial (S001 ∥ S002, then sequential) | Database + domain + data layer |
| 2 | S005-S007 + S007-V | data, frontend, quality | S005 ∥ S006 ∥ S007 | Hooks + creation UI + library integration |
| 3 | S008-S009 + S009-V | frontend, quality | Sequential | Event detail + route integration |
| 4 | S010-S012 + S012-V | frontend, data, quality | S010 ∥ S011 ∥ S012 | DnD + clone + program timeline |
| 5 | S013-S014 + S014-V | frontend, native, quality | S013 ∥ S014 | Today countdown + notifications |

**Total steps:** 14 implementation + 5 validation = 19
**Total milestones:** 5
**Estimated parallelism:** Waves 2 and 4 have 3 parallel tracks each

### Dependency Graph

```
S001 ──────────────┐
                   ├──> S004 ──> S004-V ──> [M1]
S002 ──> S003 ─────┘                          |
                                              v
                              S005 ──────────┐
                              S006 ──────────┼──> S007-V ──> [M2]
                              S007 ──────────┘                |
                                                              v
                                              S008 ──> S009 ──> S009-V ──> [M3]
                                                                            |
                                                                            v
                                                            S010 ─────────┐
                                                            S011 ─────────┼──> S012-V ──> [M4]
                                                            S012 ─────────┘                |
                                                                                           v
                                                                           S013 ──────────┐
                                                                           S014 ──────────┼──> S014-V ──> [M5]
                                                                                          └──────────────────┘
```

### Recommended Execution

**`/build`** (hub-and-spoke) is the recommended execution model. Each wave's parallel steps are independent -- agents don't need to coordinate on shared interfaces. The data layer contracts (adapter interface, domain types) are established in Wave 1 and consumed by all subsequent waves.
