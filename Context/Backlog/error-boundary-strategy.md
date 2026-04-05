# ErrorBoundary Strategy

**Source:** PR #65 review (P7-012)
**Priority:** Medium
**Severity:** High

## Problem

No `ErrorBoundary` components exist in the application. If any Radix/vaul component throws during render, the entire form crashes and the user loses all unsaved state.

## Recommendation

1. Add an `ErrorBoundary` wrapper around `HelpTrigger` internals so a failure degrades to a hidden help icon
2. Add boundaries around `ActivityGroupEditor` and `BlockEditor` so a single group/block error does not destroy the whole form
3. Consider an app-wide error boundary strategy with graceful degradation

## Context

This was identified during the progressive disclosure PR (#65) which adds new Popover/Drawer subtrees via `HelpTrigger` and complex conditional rendering in builders.
