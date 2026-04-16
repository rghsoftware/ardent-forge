# Feature 024: "Add Exercise" Pre-Populated with Frequent Exercises

## Overview

When an athlete opens the "Add exercise" picker during an active workout, the
search field starts empty with no suggestions. On the gym floor -- sweaty hands,
time pressure, mid-set -- scanning a blank list or typing a query adds
unnecessary friction. This feature pre-populates the picker with the athlete's
most frequently used exercises so the most likely candidates are visible
immediately, with zero interaction required.

## Problem Statement

The current `AddExerciseSheet` shows an empty state when the search field is
empty. The existing `useRecentlyUsedExercises` hook returns the last N distinct
exercises used, but recency is a weak signal for gym-floor defaults: an athlete
who does squats three times a week but tried deadlifts once yesterday should see
squats at the top, not deadlifts.

Frequency -- the number of sets completed per exercise across recent workouts --
is a stronger signal for default suggestions. Athletes train consistently; their
"frequent" list is largely stable week to week and closely predicts what they
are about to do.

## User Stories

- As an athlete, when I tap "Add exercise" I want to immediately see my most
  commonly trained exercises so I can add them with a single tap rather than
  searching.
- As an athlete doing a new movement today, I want the frequency suggestions
  to get out of my way -- typing any character should replace them with
  normal search results.
- As a new user with no workout history, I want the picker to feel useful from
  day one -- the empty-state should be clear, not blank.

## Requirements

### Must Have

- When the search field is empty, show a "FREQUENT" section at the top of the
  picker list, containing up to 8 exercises ranked by completed-set count across
  the last 90 days.
- Frequency is computed from the athlete's own history only (no cross-user
  aggregation).
- Typing any character into the search field replaces the frequency section
  with the normal name/alias search results (no hybrid view).
- If an exercise in the frequent list is already in the current workout
  (already added to `loggedGroups`), it is still shown in the list -- it is
  valid to add the same exercise twice.
- The frequent list is cached by TanStack Query with the same staleness
  behavior as the exercise list (no extra refetch on every picker open).
- Frequency data is fetched only once per app session open (background
  prefetch on auth), not on each picker mount.

### Should Have

- A "RECENT" fallback section for new users (fewer than 5 workouts logged):
  show the last 5 distinct exercises used in chronological order, or the text
  "No history yet -- start a workout to build suggestions" if none exist.
- Section header label: ALL-CAPS, tracking-widest, Iron & Ember palette
  (matches existing column headers in the workout logger).

### Won't Have (this iteration)

- Per-modality frequency (e.g., "frequent barbell" vs. "frequent cardio") --
  the global frequency list is sufficient for V1.
- AI/ML exercise recommendations.
- Surfacing frequent exercises in the program builder's exercise picker
  (template editing uses a different flow -- out of scope).
- Persistent user-controlled "pinned" exercises.

## Testable Assertions

| ID    | Assertion                                                                                                              | Verification                                                                                                                                       |
|-------|------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| A-001 | Frequent exercises appear when search is empty and history exists.                                                     | Render picker with mocked frequency data; assert "FREQUENT" header and exercises visible; search field empty.                                      |
| A-002 | Frequent list is hidden when user types in the search field.                                                           | Render picker with frequency data; type a character; assert "FREQUENT" header no longer in DOM, normal search results shown.                       |
| A-003 | Frequent list is absent and fallback message shown when user has fewer than 5 workouts.                                | Render picker with empty/sparse frequency data; assert "FREQUENT" absent; assert fallback copy or "RECENT" section visible.                        |
| A-004 | Frequent list is capped at 8 exercises regardless of history depth.                                                    | Mock adapter returning 20 frequent exercises; assert only 8 appear in the "FREQUENT" section.                                                      |
| A-005 | Tapping a frequent exercise calls `onExerciseSelected` with the full `Exercise` object.                                | Simulate tap on a frequent exercise item; assert `onExerciseSelected` called with the correct exercise.                                            |
| A-006 | Frequency ranking orders exercises by descending completed-set count within the 90-day window.                         | Unit test adapter/hook: fixture with 3 exercises at different set counts; assert returned order matches descending count.                           |
| A-007 | An exercise already in the active workout is still shown in the frequent list (not filtered out).                      | Render picker with `loggedGroups` containing exercise A; assert exercise A is still present in the frequent section.                               |
| A-008 | `getFrequentExercises` returns exercises as full typed `Exercise` objects (not just IDs).                              | Unit test adapter method; assert each returned item satisfies the `exerciseSchema`.                                                                 |

## Open Questions

- [x] Should the 90-day window be configurable or hard-coded?
  **Decision:** Hard-coded for V1. Revisit if users request longer history windows.
- [x] Should exercises already in the current workout be filtered from frequent suggestions?
  **Decision:** No -- athletes legitimately add the same movement twice (e.g., warmup + working sets as separate groups).
- [x] Use existing `useRecentlyUsedExercises` hook or build a new `useFrequentExercises` hook?
  **Decision:** Build a new `useFrequentExercises` hook backed by a new adapter method that aggregates by set count, not just recency. The existing hook is recency-based and would require breaking changes to re-purpose.

## Revision History

| Date       | Change       | ADR |
|------------|--------------|-----|
| 2026-04-16 | Initial spec | --  |
