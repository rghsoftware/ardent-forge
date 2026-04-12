# ADR-021-05: Dirty-state guard via `useBlocker` + `beforeunload`

**Status:** Proposed
**Date:** 2026-04-11
**Feature:** 021 -- Template Builder Route

## Context

Spec Q2 -- guard against losing unsaved work. Moving the template editor from a bottom sheet to a full-page route makes it substantially easier for a user to navigate away (browser back, link click, tab close, reload) mid-edit. The sheet pattern had implicit dismissal friction; the route pattern does not.

## Decision

Use TanStack Router `useBlocker` for in-app navigation and a `beforeunload` listener for tab close / reload. Both attach only when the form is dirty and detach on save.

## Alternatives Considered

- LocalStorage autosave. Rejected (Spec W1 -- explicitly out of scope for this feature).
- No guard at all. Rejected because one of the motivating user stories is "reloading the page should not lose my draft."

## Consequences

- Dependency on `useBlocker` API availability in the installed TanStack Router version. If unavailable, fall back to a custom navigate wrapper on form cancel + back link (covers in-app navigation minimally) and the `beforeunload` listener (covers tab close). Confirm during Step 1 of implementation.

## Addendum: useBlocker API verification (2026-04-11)

- `@tanstack/react-router` v1.168.7 confirms `useBlocker({ shouldBlockFn, enableBeforeUnload?, disabled?, withResolver? })`.
- Built-in `enableBeforeUnload` option means no separate `window.addEventListener('beforeunload')` needed.
- `withResolver: true` returns a `BlockerResolver` for custom UI dialogs.
