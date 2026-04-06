# Feature 015: New User Onboarding System

## Overview

A comprehensive onboarding system that guides new users from first login to first logged set. Three layers: (1) consistent empty states across every page, (2) a first-run welcome experience on the Today page, and (3) progressive disclosure with contextual hints, feature discovery indicators, and a guided first-workout flow.

## Problem Statement

Today, a new user who signs up and lands on the Today page sees a faded ghost session preview, a short description, and an "Execute Workout" button. There is no orientation about what the app does, where to start, or what the other sections (Library, Vault, Groups, Comms) offer. Empty states across pages are inconsistent: some use the shared `<EmptyState>` component, others are ad-hoc inline JSX, and a few pages have no empty state at all (Vault 1RM tab, Profile). Feature discovery relies entirely on the user tapping through navigation on their own.

The result is a cold first impression that undercuts the "commanding confidence" brand and leaves new users uncertain about where to begin their training workflow.

## User Stories

- As a new user landing on the Today page for the first time, I want a brief orientation that shows me the three key paths (log a workout, browse exercises, build a program) so I can choose where to start based on my intent.
- As a new user exploring a feature for the first time, I want contextual hints at point of use so I understand what the feature does without reading external docs.
- As a new user logging my first workout, I want guided prompts that walk me through adding exercises, entering sets, and completing the session so I reach my first "aha moment" quickly.
- As a new user viewing an empty page (History, Vault, Library), I want a consistent, informative empty state with a clear next action so I never hit a dead end.
- As a returning user who has completed onboarding, I want all hints and welcome cards permanently dismissed so they never reappear.

## Requirements

### Must Have

- **M-1**: All empty states across authenticated pages use the shared `<EmptyState>` component with icon + heading + subtext + optional CTA action.
- **M-2**: Fill empty state gaps: Vault 1RM tab, Profile (no data state), Group detail (invites and members sub-sections).
- **M-3**: Add actionable CTAs to empty states that currently lack them: exercises index (unfiltered), exercise history list, 1RM management.
- **M-4**: Onboarding state store (Zustand + localStorage) that tracks: welcome dismissed, hints seen (by key), features visited (by route), first workout completed.
- **M-5**: Welcome card on Today page for first-login users showing three guided paths: (a) log a workout, (b) browse exercises, (c) build a program. Each path navigates to the relevant page.
- **M-6**: Welcome card dismisses permanently on any path selection or explicit close. Never reappears after dismissal.
- **M-7**: Contextual hint component (`<OnboardingHint>`) that renders a non-modal, dismissable tooltip/callout anchored to a UI element. Tracks seen state per hint key.
- **M-8**: Hints placed at key discovery points: (a) first visit to Library page, (b) first visit to Vault page, (c) first visit to Builder page.
- **M-9**: Guided first-workout flow with contextual hints during workout logging: (a) "Add your first exercise" prompt, (b) "Log your first set" prompt, (c) "Complete your workout" prompt.
- **M-10**: All onboarding UI follows Iron & Ember design system: zero border-radius, tonal layering (no shadows), ember accent used sparingly, 48px+ touch targets.
- **M-11**: Onboarding state persists across sessions via localStorage. Store validates at its own boundary per state management conventions.

### Should Have

- **S-1**: Feature discovery indicators (subtle dot/badge) on bottom nav items for features the user has not yet visited. Indicators disappear after first visit.
- **S-2**: "Reset onboarding" option in Profile/Settings for users who want to re-experience the guided flow.
- **S-3**: Animate hint entry/exit with a brief fade (respecting `prefers-reduced-motion`).

### Won't Have (this iteration)

- **W-1**: Multi-step guided tour with spotlight/overlay dimming. Hints are standalone, not sequenced tours.
- **W-2**: Server-side onboarding state. All state is client-side localStorage only.
- **W-3**: Onboarding for social features (Groups, Connections, Comms). Those empty states get consistency fixes but no guided flows.
- **W-4**: A/B testing or analytics tracking for onboarding completion rates.

## Testable Assertions

| ID    | Assertion                                                                                        | Verification                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| A-001 | Every authenticated page with a "no data" state renders the shared `<EmptyState>` component.     | Manual: visit each page with empty data, verify consistent component usage.                  |
| A-002 | Vault 1RM tab shows an empty state when no 1RM data exists for the selected exercise.            | Manual: select an exercise with no 1RM history, verify empty state renders.                  |
| A-003 | Profile page shows an empty state when user has no profile data populated.                       | Manual: view profile as new user, verify empty state with guidance.                          |
| A-004 | Group detail invites/members sections use `<EmptyState>` with icon and CTA.                      | Manual: view a group with no invites and no members, verify proper empty states.             |
| A-005 | First-time authenticated user sees the welcome card on the Today page.                           | Manual: sign in with a new account, verify welcome card renders above other content.         |
| A-006 | Selecting any path on the welcome card navigates to the correct page and dismisses the card.     | Manual: click each path, verify navigation and that the card is gone on return.              |
| A-007 | Closing the welcome card via the dismiss action persists dismissal across page reloads.          | Manual: dismiss card, reload page, verify card does not reappear.                            |
| A-008 | Contextual hint appears on first visit to Library page and does not appear on subsequent visits. | Manual: visit Library as new user, verify hint. Navigate away and back, verify hint is gone. |
| A-009 | Contextual hint appears on first visit to Vault page.                                            | Manual: visit Vault as new user, verify hint renders.                                        |
| A-010 | Contextual hint appears on first visit to Builder page.                                          | Manual: visit Builder as new user, verify hint renders.                                      |
| A-011 | During first workout, "Add your first exercise" hint appears when exercise list is empty.        | Manual: start a workout as new user, verify hint on the empty exercise list.                 |
| A-012 | During first workout, "Log your first set" hint appears after adding an exercise.                | Manual: add exercise during first workout, verify set-logging hint.                          |
| A-013 | During first workout, "Complete your workout" hint appears after logging at least one set.       | Manual: log a set during first workout, verify completion hint.                              |
| A-014 | All hints are dismissable and do not reappear after dismissal.                                   | Manual: dismiss each hint, verify it does not return.                                        |
| A-015 | (Should) Unvisited nav items show a discovery indicator that disappears after first visit.       | Manual: check nav as new user, verify indicators. Visit each page, verify indicators clear.  |
| A-016 | (Should) "Reset onboarding" in Profile resets all hint and welcome state.                        | Manual: reset onboarding, verify welcome card and hints reappear.                            |
| A-017 | All onboarding UI has zero border-radius, no box shadows, and uses tonal layering.               | Visual: inspect all new components, verify design system compliance.                         |
| A-018 | Touch targets on welcome card paths and hint dismiss buttons are at least 48px.                  | Manual: measure touch targets in dev tools.                                                  |
| A-019 | Hints respect `prefers-reduced-motion` by skipping animations when reduced motion is preferred.  | Manual: enable reduced motion in OS settings, verify no animation on hints.                  |

## Open Questions

- [ ] Should the welcome card use the same ghost preview pattern as the current Today empty state, or replace it entirely?
- [ ] Should feature discovery indicators appear on the mobile bottom nav, the web sidebar nav, or both?
- [ ] What icon should the Profile empty state use? `person` or `badge`?

## Dependencies

- Shared `<EmptyState>` component (`src/components/shared/empty-state.tsx`) -- exists, untracked
- `<GhostSessionPreview>` component -- exists
- `<Icon>` component supporting Material Symbols -- exists
- Zustand already in use for other stores
- Bottom nav and sidebar nav components -- need to accept optional indicator props

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-05 | Initial spec | --  |
