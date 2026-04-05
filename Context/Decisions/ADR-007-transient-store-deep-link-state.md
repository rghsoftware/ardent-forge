# ADR-007: Transient Zustand Store for Cross-Route Deep Link State

## Status

Accepted

## Context

Feature 011 (Deep Link Handler) needs to pass backend credentials from a deep link event to the BackendSettings component on the `/profile` page. This happens when a configured user taps an `ardentforge://connect` link for a different server -- the app navigates to settings so the user can review and confirm the backend change.

The deep link handler runs outside React's render cycle (in the Tauri `onOpenUrl` callback or during a `/connect` route redirect). It needs to communicate structured data (`url` and `key`) to a component that mounts later on a different route.

## Options Considered

### Option A: Route search params on `/profile`

Add `connectUrl` and `connectKey` search params to the profile route. The deep link handler navigates to `/profile?connectUrl=X&connectKey=Y`, and BackendSettings reads them.

**Pros:** No new state management. Pure URL-driven.
**Cons:** Couples `/profile` to deep link concerns. Exposes backend credentials in the URL bar and browser history. The profile route's `validateSearch` gains parameters unrelated to profile functionality.

### Option B: Transient Zustand store

Create a small Zustand store (`usePendingConnect`) with `pending: { url, key } | null`, `setPending()`, and `clear()`. The handler sets values before navigating; BackendSettings reads and clears on mount.

**Pros:** Decoupled from routing. No credential leakage into URL/history. Zustand stores are accessible outside React via `getState()`, which the non-React deep link handler needs. Values are ephemeral (cleared on consumption, lost on reload).
**Cons:** Adds a small module. Values don't survive a full page reload (acceptable -- deep links trigger fresh app launches, so the store is populated before the target component mounts).

### Option C: sessionStorage

Store pending values in `sessionStorage`, read and clear in BackendSettings.

**Pros:** Survives page reload. No framework dependency.
**Cons:** Requires manual serialization. Not type-safe without wrapper. Zustand is already the project's state management tool -- adding a parallel mechanism for one use case is inconsistent.

## Decision

**Option B: Transient Zustand store.**

The store is 10 lines of code, follows the project's existing state management pattern, and cleanly handles the non-React-to-React handoff that this feature requires. Route search params (Option A) would work functionally but leak credentials and pollute the profile route's API surface.

## Consequences

- New file: `src/lib/pending-connect.ts`
- BackendSettings gains a `useEffect` that checks for pending values on mount
- If future features need similar cross-route handoffs, this pattern can be replicated (but should not be abstracted into a framework until 3+ stores exist)
