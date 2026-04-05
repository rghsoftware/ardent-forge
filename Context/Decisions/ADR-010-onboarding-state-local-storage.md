# ADR-010: Onboarding State in Client-Side localStorage

**Date:** 2026-04-05
**Status:** Proposed
**Feature:** 015-Onboarding

## Context

The onboarding system needs to persist state across sessions: which hints have been seen, whether the welcome card was dismissed, which routes have been visited, and whether the first workout has been completed. Two persistence strategies are available: client-side localStorage or server-side (Supabase).

## Decision

Store all onboarding state in localStorage via a Zustand store with manual persistence (matching the `useBlockedUsersStore` pattern). No server-side storage.

## Rationale

- **Simplicity:** No migration, no RLS policy, no new table. Frontend-only change.
- **Performance:** Zero network requests for onboarding state reads. Instant on page load.
- **Precedent:** Existing stores (`useBlockedUsersStore`) use this exact pattern. No new middleware or patterns to introduce.
- **Acceptable trade-off:** If a user clears localStorage or switches devices, they see onboarding again. This is a brief, dismissable experience -- re-seeing it is a minor annoyance, not a functional failure.

## Alternatives Rejected

- **Zustand `persist` middleware:** No existing store uses it. Introducing a new pattern for one store is not worth the inconsistency.
- **Server-side (Supabase `user_preferences` table):** Adds backend complexity (migration, RLS, sync) for state that has no value to other users or to analytics. Cross-device sync of onboarding state is not a requirement (W-2).

## Consequences

- Onboarding resets if localStorage is cleared or user switches to a new device/browser.
- State is keyed by userId to support multi-account usage on one device.
- A `try/catch` wrapper is needed for environments where localStorage is unavailable (some private browsing modes).
