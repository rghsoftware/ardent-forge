# Feature Spec: Events & Packing Lists

**Feature:** 002-events-packing-lists
**Step:** 13.5
**Priority:** P1
**Status:** Planning
**Date:** 2026-04-01

---

## Overview

Add an Event session type to Ardent Forge. Events are sessions with `category: EVENT` that display event metadata (date, location, URL) and a checkable packing list instead of exercises and sets. Events participate in all existing session mechanics: they can be scheduled in programs, referenced by workout logs, cloned, and shared.

## Problem Statement

Users who train for competitions, rucks, obstacle course races, and other fitness events need a way to track event details and preparation within the same tool they use for training. Currently, session templates only support exercise-based workouts. Event logistics (gear lists, requirements, countdown tracking) are managed outside the app, creating a fragmented preparation experience.

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-1 | User | Create an event session within a program or as a standalone log | I can plan events alongside my training |
| US-2 | User | Add freeform requirements (ruck weight, distance, cutoff time) to an event | I can reference event specs during preparation |
| US-3 | User | Build a categorized packing list for an event | I can track what gear I need |
| US-4 | User | Check off packing items with single-tap toggle | I can quickly mark items as packed during prep |
| US-5 | User | See packing progress per category and overall | I know at a glance how prepared I am |
| US-6 | User | Reorder packing list items via drag-and-drop | I can prioritize items within categories |
| US-7 | User | See events in my program timeline with distinct visual treatment | Events stand out from regular training sessions |
| US-8 | User | See a countdown to upcoming events on the Today screen | I stay aware of approaching deadlines |
| US-9 | User | Receive configurable countdown notifications before an event | I get timely reminders with packing status |
| US-10 | User | Clone an event template with isPacked reset | I can reuse packing lists for recurring events |
| US-11 | User | Tap a location to open it in my platform's maps app | I can navigate to the event venue |

## Requirements

### Must Have (P0)

| ID | Requirement | Traces to |
|----|------------|-----------|
| R-1 | `EVENT` is a valid SessionCategory in domain types | US-1, EV-1 |
| R-2 | `event_metadata` JSON column on `session_templates` and `workout_logs` | US-1, US-2 |
| R-3 | `event_items` table with polymorphic FK (template XOR log), CHECK constraints, RLS | US-3, EV-2 |
| R-4 | Zod schemas for EventMetadata, EventRequirement, EventItem with full validation | US-2, US-3, EV-1/3/4 |
| R-5 | Data adapter CRUD: getEventItems, saveEventItem, deleteEventItem, toggleEventItemPacked, reorderEventItems | US-3, US-4, US-6 |
| R-6 | Event creation form with name, date/time, location, URL, requirements, packing list | US-1, US-2, US-3 |
| R-7 | Event detail screen with metadata display, requirements, and categorized packing checklist | US-4, US-5 |
| R-8 | Single-tap packing toggle with < 100ms visual feedback | US-4 |
| R-9 | Progress indicator per category and overall (horizontal bar, `ember` on `surface-steel` track) | US-5 |
| R-10 | Events display in program timeline with distinct visual treatment (flag icon, steel card, ember accent) | US-7 |
| R-11 | Clone operation resets `isPacked` to false on all items | US-10, EV-5 |
| R-12 | Location renders as tappable map link when coordinates present | US-11 |
| R-13 | All text uses industrial vocabulary (ALL-CAPS headers, no emoji, no exclamation marks) | Design system |
| R-14 | RLS policies enforce `user_id = auth.uid()` isolation on `event_items` | Security |

### Should Have (P1)

| ID | Requirement | Traces to |
|----|------------|-----------|
| R-15 | Drag-and-drop reorder for packing list items within categories (dnd-kit) | US-6 |
| R-16 | Countdown badge on Today screen when next event is within 30 days | US-8 |
| R-17 | Event countdown notifications at configurable intervals (default: 7d, 3d, 1d) | US-9 |
| R-18 | Notification includes packing progress when items exist | US-9 |
| R-19 | Packing list item categories with collapsible sections | US-5 |

### Won't Have (this iteration)

| ID | Exclusion | Rationale |
|----|----------|-----------|
| W-1 | Registration/ticketing integration | Out of scope per PRD |
| W-2 | Multi-participant coordination | Social features are Phase 4 |
| W-3 | Race result tracking | Separate feature |
| W-4 | Automatic packing list population | AI/ML feature, future consideration |
| W-5 | Travel logistics | Out of scope |
| W-6 | Calendar feed import/export | Out of scope |
| W-7 | Coach write access to event items on workout_logs | Deferred to Phase 4 RLS expansion |
| W-8 | Tauri adapter implementation | Deferred until Step 8 (native offline) is complete |

## Testable Assertions

| ID | Assertion | Validates |
|----|----------|-----------|
| TA-1 | Creating a session template with `category: EVENT` persists `eventMetadata` JSON and associated `event_items` rows | R-1, R-2, R-3 |
| TA-2 | Creating a session template with `category != EVENT` and non-null `eventMetadata` fails Zod validation | EV-1 |
| TA-3 | An `event_items` row with both `session_template_id` and `workout_log_id` non-null is rejected by the DB CHECK constraint | EV-2 |
| TA-4 | An `event_items` row with both FKs null is rejected by the DB CHECK constraint | EV-2 |
| TA-5 | `event_item.quantity < 1` is rejected by DB CHECK constraint | EV-3 |
| TA-6 | Toggling `isPacked` on a packing item reflects in the UI within 100ms (optimistic update) | R-8 |
| TA-7 | Packing progress bar updates immediately when items are toggled | R-9 |
| TA-8 | Cloning an event template produces new items with `isPacked = false` regardless of source state | R-11, EV-5 |
| TA-9 | Event detail screen displays location as tappable map link when lat/lng are present | R-12 |
| TA-10 | Event detail screen shows "TBD" when `eventDate` is null | EV-7 |
| TA-11 | Dragging a packing item to a new position persists the updated `sort_order` values | R-15 |
| TA-12 | Event items belonging to user A are not visible to user B (RLS enforcement) | R-14 |
| TA-13 | Events in the program timeline render with flag icon and distinct card styling | R-10 |
| TA-14 | Countdown notification fires at 7d, 3d, 1d before event date (when enabled) | R-17 |
| TA-15 | Notification body includes packing progress count when event has items | R-18 |
| TA-16 | Providing `latitude`/`longitude` without `location` triggers a soft validation warning | EV-8 |

## Invariants

These invariants are sourced from `docs/06-invariants.md` and must be enforced:

| ID | Rule | Enforcement |
|----|------|-------------|
| EV-1 | `category == EVENT` implies `activityGroups` empty; `category != EVENT` implies `eventMetadata` null and `eventItems` empty | Zod discriminated union + DB constraint |
| EV-2 | Each event item references exactly one parent: `session_template_id XOR workout_log_id` | DB CHECK constraint |
| EV-3 | `event_item.quantity >= 1` | Zod + DB CHECK |
| EV-4 | `event_item.sort_order >= 0` | Zod validation |
| EV-5 | Clone resets all `isPacked` to false | Clone logic in data adapter |
| EV-6 | Coaches cannot modify `isPacked` on workout_log event items | Existing RLS (deferred to Phase 4) |
| EV-7 | `eventDate` is nullable; when both event date and program scheduled date exist, event date takes precedence | Schema allows null; UI display logic |
| EV-8 | If lat/lng present, `location` should be non-empty | Soft validation warning |

## Open Questions

| # | Question | Impact | Default if unresolved |
|---|---------|--------|----------------------|
| OQ-1 | Should the event creation form be a new route or a Sheet overlay like session templates? | UI architecture | Sheet overlay (matches existing pattern) |
| OQ-2 | Should event detail be a dedicated route or reuse the workout log route with conditional rendering? | Routing | Conditional rendering within existing log route |
| OQ-3 | Does the Today screen countdown need a dedicated query or can it piggyback on existing session queries? | Performance | Dedicated lightweight query for next upcoming event |

## Dependencies

| Dependency | Status | Impact if missing |
|-----------|--------|-------------------|
| Step 10: Session Templates + SetScheme | Complete | Cannot create event session templates |
| Step 6: Workout Logging | Complete | Cannot create event workout logs |
| Step 12: Program Builder (DnD) | Complete | Cannot add events to program blocks |
| dnd-kit (already in stack) | Available | Drag-and-drop reorder for packing items |
| Tauri notification API | Available but not wired | Event countdown notifications in native mode |

## Design References

- `docs/04-prd-events.md` -- Full product requirements
- `docs/05-domain-model.md` SS Event Entities -- Domain types and relationships
- `docs/06-invariants.md` SS Event Invariants -- EV-1 through EV-8
- `docs/08-erd.md` SS Event Tables -- Table schemas and SQL
- `docs/10-user-flows.md` SS Flow 10, Flow 11 -- Creation and check-off flows
- `docs/11-notification-design.md` SS Type 4 -- Event countdown notifications
- `DESIGN.md` -- Iron & Ember design system tokens and vocabulary
