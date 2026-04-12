# ADR-021-01: Top-level `/templates/*` namespace

**Status:** Proposed
**Date:** 2026-04-11
**Feature:** 021 -- Template Builder Route

## Context

Spec Q1 -- where should the new routes live? Feature 021 introduces dedicated builder routes for session and event templates, replacing the bottom-sheet pattern currently used from `library.tsx`. The routes need a stable namespace that communicates their relationship to the rest of the app.

## Decision

Top-level `/templates/new` and `/templates/$templateId/edit`, parallel to `/builder`.

## Alternatives Considered

- `/builder/templates/*` -- nests templates under builder. Rejected because programs and templates are structural peers (a program references templates, not the other way around), and nesting would suggest templates are a sub-feature of programs.
- `/library/templates/*` -- nests editor under library. Rejected because the library is a list-view concept and the editor is a distinct long-lived destination.

## Consequences

- `/events/$templateId` (existing) and `/templates/$templateId/edit` (new) coexist as sibling namespaces. No route collision risk.
- Deep links can be shared as `/templates/{uuid}/edit`.
